/**
 * ObservabilityComponent — Live backend telemetry with 3 tabs.
 *
 * Traces: Queries Tempo via the Grafana datasource proxy (http://localhost:3000).
 *   Supports TraceQL and tag-based search. Each trace links to Grafana Explore.
 *   Displays expandable span waterfall on row click.
 *
 * Loggers: Lists Spring Boot loggers from /actuator/loggers and lets the
 *   operator tune levels live.
 *
 * Logs: Queries Loki directly via Nginx CORS proxy on port 3100.
 *   Color-coded by level (ERROR/WARN/INFO/DEBUG). Optional 5s live polling.
 *
 * The previous Latency-histogram and Live-Feeds tabs were retired in
 * ADR-0007 (docs/adr/0007-retire-prometheus-ui-visualisations.md) because
 * they polled /actuator/prometheus — Grafana now owns that view.
 */
import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

/**
 * An assembled trace with its root span metadata and all child spans.
 * Built by combining Tempo's search summary and the full OTLP trace detail.
 */
interface Trace {
  /** Hex-encoded trace ID (16 bytes = 32 hex chars). */
  traceId: string;
  /** All spans belonging to this trace, sorted by start time for waterfall rendering. */
  spans: Span[];
  /** Total trace duration in milliseconds from earliest span start to latest span end. */
  durationMs: number;
  /** Root span's service name (e.g., `'customer-service'`). */
  serviceName: string;
  /** Root span operation name (e.g., `'GET /customers'`). */
  operationName: string;
  /** Wall-clock start time of the root span. */
  timestamp: Date;
}

/**
 * A single span in a distributed trace.
 * Duration is stored in microseconds (standard for OTLP) and converted to ms for display.
 */
interface Span {
  /** Hex trace ID linking this span to its parent trace. */
  traceId: string;
  /** Hex span ID — unique within the trace. */
  spanId: string;
  /** Hex span ID of the parent span. Undefined for the root span. */
  parentSpanId?: string;
  /** Human-readable operation name (e.g., `'SELECT customers'`). */
  operationName: string;
  /** Name of the service that emitted this span. */
  serviceName: string;
  /** Start time as Unix nanoseconds (OTLP format). */
  startTimeUnixNano: number;
  /** Span duration in microseconds (OTLP format — divide by 1000 for milliseconds). */
  duration: number; // microseconds
  /** Key/value span attributes from OTLP (e.g., `http.method`, `db.statement`). */
  tags: Record<string, string>;
  /** Span status string: `'OK'`, `'ERROR'`, or undefined for unset. */
  status?: string;
}

/**
 * Trace summary row returned by the Tempo `/api/search` endpoint.
 * Contains just enough information to render the search results list.
 */
interface TempoTraceSummary {
  /** Tempo's hex trace ID field (capital ID — matches Tempo API). */
  traceID: string;
  /** Root span's service name. */
  rootServiceName: string;
  /** Root span operation name. */
  rootTraceName: string;
  /** Root span start time as a nanosecond Unix timestamp string. */
  startTimeUnixNano: string;
  /** Total trace duration in milliseconds. */
  durationMs: number;
}

/**
 * A single parsed log line from a Loki query response.
 * Level is extracted from the log line text by pattern matching.
 */
interface LogEntry {
  /** ISO-8601 timestamp of the log line. */
  timestamp: string;
  /** Full log line text. */
  line: string;
  /** Log level extracted from the line: `'ERROR'`, `'WARN'`, `'INFO'`, `'DEBUG'`. */
  level?: string;
}

/**
 * Minimal OTLP ResourceSpans shape returned by Tempo GET /api/traces/:id.
 * Only the fields actually parsed in parseOtlpTrace() are typed here.
 */
interface OtlpAttribute {
  key: string;
  value?: { stringValue?: string; intValue?: string | number; boolValue?: boolean };
}
interface OtlpSpan {
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpAttribute[];
  status?: { code?: number };
}
interface OtlpTrace {
  batches?: Array<{
    resource?: { attributes?: OtlpAttribute[] };
    scopeSpans?: Array<{ spans?: OtlpSpan[] }>;
  }>;
}

/** Minimal Loki /api/v1/query_range response shape. */
interface LokiQueryResult {
  data?: { result?: Array<{ values?: [string, string][] }> };
}

type ObsTab = 'traces' | 'logger' | 'logs';

@Component({
  selector: 'app-observability',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  templateUrl: './observability.component.html',
  styleUrl: './observability.component.scss',
})
export class ObservabilityComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  activeTab = signal<ObsTab>('traces');

  // ── Traces (Tempo API via Grafana proxy) ──────────────────────────────────
  private readonly TEMPO_BASE = 'http://localhost:3000/api/datasources/proxy/uid/tempo';

  tempoSummaries = signal<TempoTraceSummary[]>([]);
  tempoLoading = signal(false);
  tempoError = signal('');
  tempoQuery = ''; // TraceQL expression — empty = tag search
  tempoTagKey = 'http.url';
  tempoTagValue = '';
  tempoLimit = 20;
  tempoLookback = '1h';
  tempoSelectedId = signal<string | null>(null);
  tempoSelectedTrace = signal<Trace | null>(null);
  tempoDetailLoading = signal(false);
  tempoTags = signal<string[]>([]);

  // ── Logs (Loki API) ───────────────────────────────────────────────────────
  logs = signal<LogEntry[]>([]);
  logsLoading = signal(false);
  logsError = signal('');
  logsQueried = signal(false);
  lokiQuery = '{service_name="customer-service"}';
  lokiLimit = 100;
  logsPolling = signal(false);
  private _logsTimer: ReturnType<typeof setInterval> | null = null;

  // ── Loggers ───────────────────────────────────────────────────────────────
  loggersList = signal<Array<{ name: string; level: string }>>([]);
  loggerFilter = '';
  loggerLoading = signal(false);

  loadLoggers(): void {
    this.loggerLoading.set(true);
    this.http
      .get<{
        loggers: Record<string, { effectiveLevel: string }>;
      }>(`${this.env.baseUrl()}/actuator/loggers`)
      .subscribe({
        next: (v) => {
          const entries = Object.entries(v.loggers ?? {})
            .map(([name, val]) => ({ name, level: val.effectiveLevel }))
            .filter((l) => l.level !== 'OFF');
          this.loggersList.set(entries);
          this.loggerLoading.set(false);
        },
        error: () => {
          this.toast.show('Could not load loggers', 'error');
          this.loggerLoading.set(false);
        },
      });
  }

  setLoggerLevel(name: string, level: string): void {
    this.http
      .post(`${this.env.baseUrl()}/actuator/loggers/${name}`, { configuredLevel: level })
      .subscribe({
        next: () => {
          this.toast.show(`Logger "${name}" set to ${level}`, 'success');
          this.loadLoggers();
        },
        error: () => this.toast.show('Failed to set logger level', 'error'),
      });
  }

  get filteredLoggers() {
    if (!this.loggerFilter) return this.loggersList().slice(0, 50);
    const q = this.loggerFilter.toLowerCase();
    return this.loggersList()
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, 50);
  }

  // ── Flame graph (trace-scoped, triggered only via Traces tab) ─────────────
  flameViewTrace = signal<Trace | null>(null);

  ngOnInit(): void {
    // Pre-load Tempo tag list for the search autocomplete
    this.loadTempoTags();
  }

  ngOnDestroy(): void {
    this.stopLogsPolling();
  }

  switchTab(tab: ObsTab): void {
    this.activeTab.set(tab);
    if (tab === 'logger' && this.loggersList().length === 0) {
      this.loadLoggers();
    }
    if (tab === 'traces' && this.tempoTags().length === 0) {
      this.loadTempoTags();
    }
  }

  // ── Tempo search ──────────────────────────────────────────────────────────

  /**
   * Returns a Grafana Explore deep-link for the given Tempo trace ID.
   * When traceId is omitted, returns the general Tempo search page.
   */
  /**
   * Grafana Explore URL for Tempo — TraceQL search pre-filtered on customer-service.
   * The filters array uses scope="resource" + tag="service.name" so results appear
   * immediately without any manual input from the user.
   */
  private readonly TEMPO_SEARCH_URL =
    'http://localhost:3000/explore?schemaVersion=1&panes=' +
    encodeURIComponent(
      JSON.stringify({
        t: {
          datasource: 'tempo',
          queries: [
            {
              refId: 'A',
              datasource: { type: 'tempo', uid: 'tempo' },
              queryType: 'traceqlSearch',
              limit: 20,
              tableType: 'traces',
              filters: [
                {
                  id: 'svc',
                  operator: '=',
                  scope: 'resource',
                  tag: 'service.name',
                  value: 'customer-service',
                },
              ],
              metricsQueryType: 'range',
              serviceMapUseNativeHistograms: false,
            },
          ],
          range: { from: 'now-1h', to: 'now' },
          compact: false,
        },
      }),
    ) +
    '&orgId=1';

  tempoExploreUrl(traceId?: string): string {
    if (traceId) {
      const panes = encodeURIComponent(
        JSON.stringify({
          t: {
            datasource: 'tempo',
            queries: [
              {
                refId: 'A',
                datasource: { type: 'tempo', uid: 'tempo' },
                queryType: 'traceId',
                query: traceId,
              },
            ],
            range: { from: 'now-1h', to: 'now' },
          },
        }),
      );
      return `http://localhost:3000/explore?schemaVersion=1&panes=${panes}&orgId=1`;
    }
    return this.TEMPO_SEARCH_URL;
  }

  fetchTempoSearch(): void {
    this.tempoLoading.set(true);
    this.tempoError.set('');
    this.tempoSelectedId.set(null);
    this.tempoSelectedTrace.set(null);

    const now = Date.now();
    const lookbackMs: Record<string, number> = {
      '15m': 15 * 60_000,
      '1h': 3_600_000,
      '3h': 3 * 3_600_000,
      '6h': 6 * 3_600_000,
      '24h': 24 * 3_600_000,
    };
    const startMs = now - (lookbackMs[this.tempoLookback] ?? 3_600_000);

    const params: Record<string, string> = {
      limit: this.tempoLimit.toString(),
      start: Math.floor(startMs / 1000).toString(),
      end: Math.floor(now / 1000).toString(),
    };

    // TraceQL mode — send q= parameter when query is non-empty
    if (this.tempoQuery.trim()) {
      params['q'] = this.tempoQuery.trim();
    } else if (this.tempoTagValue.trim()) {
      // Tag-based search mode
      params['tags'] = `${this.tempoTagKey}=${this.tempoTagValue.trim()}`;
    } else {
      // No filter — add a service.name filter so results are relevant
      params['tags'] = 'service.name=customer-service';
    }

    this.http
      .get<{ traces?: TempoTraceSummary[] }>(`${this.TEMPO_BASE}/api/search`, { params })
      .subscribe({
        next: (r) => {
          this.tempoSummaries.set(r.traces ?? []);
          this.tempoLoading.set(false);
        },
        error: (e) => {
          this.tempoError.set(
            `Tempo unreachable (Grafana proxy http://localhost:3000) — ${e.status || 'check that LGTM is running'}.`,
          );
          this.tempoLoading.set(false);
        },
      });
  }

  loadTempoTags(): void {
    this.http
      .get<{ tagNames?: string[] }>(`${this.TEMPO_BASE}/api/search/tags`)
      .subscribe({ next: (r) => this.tempoTags.set(r.tagNames ?? []) });
  }

  selectTempoTrace(id: string): void {
    if (this.tempoSelectedId() === id) {
      this.tempoSelectedId.set(null);
      this.tempoSelectedTrace.set(null);
      return;
    }
    this.tempoSelectedId.set(id);
    this.tempoDetailLoading.set(true);
    this.http.get<OtlpTrace>(`${this.TEMPO_BASE}/api/traces/${id}`).subscribe({
      next: (otlp) => {
        this.tempoSelectedTrace.set(this.parseOtlpTrace(id, otlp));
        this.tempoDetailLoading.set(false);
      },
      error: () => {
        this.tempoDetailLoading.set(false);
      },
    });
  }

  /** Parse OTLP ResourceSpans format into our internal Trace/Span model. */
  private parseOtlpTrace(traceId: string, otlp: OtlpTrace): Trace {
    const spans: Span[] = (otlp.batches ?? []).flatMap((batch) => {
      const svcName = this.extractServiceName(batch);
      return (batch.scopeSpans ?? []).flatMap((scope) =>
        (scope.spans ?? []).map((s) => this.parseOtlpSpan(s, traceId, svcName)),
      );
    });
    spans.sort((a, b) => a.startTimeUnixNano - b.startTimeUnixNano);
    const root = spans[0];
    const traceStartNs = root?.startTimeUnixNano ?? 0;
    const traceEndNs = Math.max(...spans.map((s) => s.startTimeUnixNano + s.duration * 1000));
    const totalMs = Math.round((traceEndNs - traceStartNs) / 1e6);
    return {
      traceId,
      spans,
      durationMs: totalMs,
      serviceName: root?.serviceName ?? 'unknown',
      operationName: root?.operationName ?? '?',
      timestamp: new Date(Math.round((traceStartNs ?? 0) / 1e6)),
    };
  }

  /** Extract service.name from an OTLP ResourceSpans batch. */
  private extractServiceName(batch: { resource?: { attributes?: OtlpAttribute[] } }): string {
    const attr = (batch.resource?.attributes ?? []).find((a) => a.key === 'service.name');
    return attr?.value?.stringValue ?? 'unknown';
  }

  /** Convert a single OTLP span proto to our internal Span model. */
  private parseOtlpSpan(s: OtlpSpan, traceId: string, serviceName: string): Span {
    const spanId = this.b64toHex(s.spanId ?? '');
    const parentSpanId = s.parentSpanId ? this.b64toHex(s.parentSpanId) : undefined;
    const start = Number(s.startTimeUnixNano ?? 0);
    const end = Number(s.endTimeUnixNano ?? 0);
    const durUs = Math.round((end - start) / 1000); // ns → µs
    const tags: Record<string, string> = {};
    for (const attr of s.attributes ?? []) {
      const v = attr.value;
      tags[attr.key] = v?.stringValue ?? v?.intValue?.toString() ?? v?.boolValue?.toString() ?? '';
    }
    return {
      traceId,
      spanId,
      parentSpanId,
      operationName: s.name ?? '?',
      serviceName,
      startTimeUnixNano: start,
      duration: durUs,
      tags,
      status: s.status?.code === 2 ? 'error' : 'ok',
    };
  }

  private b64toHex(b64: string): string {
    try {
      return Array.from(atob(b64), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    } catch {
      return b64; // already hex (older Tempo versions)
    }
  }

  /** Span waterfall rows with relative position/width inside the selected Tempo trace. */
  tempoWaterfallRows(): Array<{
    span: Span;
    depth: number;
    left: number;
    width: number;
    color: string;
  }> {
    const t = this.tempoSelectedTrace();
    if (!t || t.spans.length === 0) return [];

    const traceStartNs = t.spans[0].startTimeUnixNano;
    const totalDurNs = t.durationMs * 1e6;
    if (totalDurNs === 0) return [];

    // Build parent→children map for depth calculation
    const depthMap = new Map<string, number>();
    const parentMap = new Map<string, string | undefined>();
    t.spans.forEach((s) => parentMap.set(s.spanId, s.parentSpanId));

    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const parentId = parentMap.get(id);
      if (!parentId || !depthMap.has(parentId)) return 0;
      return (depthMap.get(parentId) ?? 0) + 1;
    };

    const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    return t.spans.map((s) => {
      const d = getDepth(s.spanId);
      depthMap.set(s.spanId, d);
      const offsetNs = s.startTimeUnixNano - traceStartNs;
      const left = (offsetNs / totalDurNs) * 100;
      const width = Math.max(0.3, ((s.duration * 1000) / totalDurNs) * 100);
      return {
        span: s,
        depth: d,
        left,
        width,
        color: s.status === 'error' ? '#ef4444' : COLORS[d % COLORS.length],
      };
    });
  }

  /** Format nanoseconds timestamp as HH:mm:ss.SSS */
  formatNs(ns: number): string {
    return new Date(Math.round(ns / 1e6)).toISOString().slice(11, 23);
  }

  // ── Logs ──────────────────────────────────────────────────────────────────
  fetchLogs(): void {
    this.logsLoading.set(true);
    this.logsError.set('');
    this.logsQueried.set(true);

    // Call Loki directly — CORS enabled via Nginx proxy in docker-compose
    const end = Date.now() * 1e6; // nanoseconds
    const start = (Date.now() - 3600000) * 1e6; // 1 hour ago

    this.http
      .get<LokiQueryResult>('http://localhost:3100/loki/api/v1/query_range', {
        params: {
          query: this.lokiQuery,
          limit: this.lokiLimit.toString(),
          start: start.toString(),
          end: end.toString(),
        },
      })
      .subscribe({
        next: (data) => {
          const entries: LogEntry[] = [];
          for (const stream of data?.data?.result ?? []) {
            for (const [ts, line] of stream.values ?? []) {
              const level = line.match(/\b(ERROR|WARN|INFO|DEBUG|TRACE)\b/)?.[1];
              entries.push({
                timestamp: new Date(Number(ts) / 1e6).toISOString().slice(11, 23),
                line,
                level,
              });
            }
          }
          entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          this.logs.set(entries);
          this.logsLoading.set(false);
        },
        error: (e) => {
          this.logsError.set(
            `Could not fetch logs from Loki (localhost:3100) — ${e.status || 'unreachable'}. Is Loki running?`,
          );
          this.logsLoading.set(false);
        },
      });
  }

  toggleLogsPolling(): void {
    if (this.logsPolling()) {
      this.stopLogsPolling();
    } else {
      this.logsPolling.set(true);
      this.fetchLogs();
      this._logsTimer = setInterval(() => this.fetchLogs(), 5000);
    }
  }

  logsTrafficRunning = signal(false);

  /** Generate varied backend traffic to produce logs, then auto-query Loki */
  generateTrafficForLogs(): void {
    this.logsTrafficRunning.set(true);
    const base = this.env.baseUrl();
    const endpoints = [
      `${base}/customers?page=0&size=5`,
      `${base}/customers?page=0&size=5`,
      `${base}/actuator/health`,
      `${base}/customers/recent`,
      `${base}/customers/summary?page=0&size=5`,
      `${base}/customers/1/bio`,
      `${base}/customers/1/todos`,
      `${base}/customers/1/enrich`,
      `${base}/customers/aggregate`,
      `${base}/customers?page=999&size=1`,
    ];
    let done = 0;
    for (const url of endpoints) {
      this.http
        .get(url)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          done++;
          if (done === endpoints.length) {
            this.logsTrafficRunning.set(false);
            this.toast.show(
              `${endpoints.length} requests sent — waiting 3s for logs to reach Loki...`,
              'info',
            );
            setTimeout(() => this.fetchLogs(), 3000);
          }
        });
    }
  }

  tryBroadQuery(): void {
    this.lokiQuery = '{}';
    this.fetchLogs();
  }

  private stopLogsPolling(): void {
    this.logsPolling.set(false);
    if (this._logsTimer) {
      clearInterval(this._logsTimer);
      this._logsTimer = null;
    }
  }

  logLevelClass(level?: string): string {
    switch (level) {
      case 'ERROR':
        return 'log-error';
      case 'WARN':
        return 'log-warn';
      case 'INFO':
        return 'log-info';
      case 'DEBUG':
        return 'log-debug';
      default:
        return 'log-default';
    }
  }

  // ── Flame graph ───────────────────────────────────────────────────────────
  openFlameGraph(t: Trace): void {
    this.flameViewTrace.set(this.flameViewTrace()?.traceId === t.traceId ? null : t);
  }

  flameRows(): Array<{
    name: string;
    service: string;
    left: number;
    width: number;
    depth: number;
  }> {
    const t = this.flameViewTrace();
    if (!t || !t.spans.length) return [];
    const totalDuration = t.durationMs * 1000; // microseconds
    if (totalDuration === 0) return [];

    return t.spans.map((s, i) => ({
      name: s.operationName,
      service: s.serviceName,
      left: (i / t.spans.length) * 100, // simplified positioning
      width: Math.max(2, (s.duration / totalDuration) * 100),
      depth: i % 3, // simplified depth
    }));
  }
}
