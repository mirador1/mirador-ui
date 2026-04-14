/**
 * ObservabilityComponent — Live backend telemetry with 4 tabs.
 *
 * Traces: Queries Tempo via the Grafana datasource proxy (http://localhost:3001).
 *   Supports TraceQL and tag-based search. Each trace links to Grafana Explore.
 *   Displays expandable span waterfall on row click.
 *
 * Logs: Queries Loki directly via Nginx CORS proxy on port 3100.
 *   Color-coded by level (ERROR/WARN/INFO/DEBUG). Optional 5s live polling.
 *
 * Latency: Parses Prometheus histogram buckets to render a latency distribution
 *   bar chart. Converts cumulative buckets to differential counts.
 *
 * Live Feed: Polls /actuator/prometheus every 2s and extracts HTTP request
 *   metrics to display a scrolling feed of method/URI/status entries.
 */
import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

/** Aggregated trace with root span info and child spans */
interface Trace {
  traceId: string;
  spans: Span[];
  durationMs: number;
  serviceName: string;
  operationName: string;
  timestamp: Date;
}

/** Individual span within a trace — duration is in microseconds */
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTimeUnixNano: number;
  duration: number; // microseconds
  tags: Record<string, string>;
  status?: string;
}

/** Summary row returned by Tempo /api/search */
interface TempoTraceSummary {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano: string;
  durationMs: number;
}

/** Single log line parsed from Loki query response */
interface LogEntry {
  timestamp: string;
  line: string;
  level?: string;
}

/** Histogram bucket for latency distribution chart */
interface LatencyBucket {
  le: string;
  count: number;
}

interface LiveCustomer {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isNew: boolean;
}

type SseStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const MAX_SSE_EVENTS = 50;
const NEW_BADGE_MS = 5_000;
const RECONNECT_DELAY_MS = 3_000;

type ObsTab = 'traces' | 'logger' | 'logs' | 'latency' | 'live';

@Component({
  selector: 'app-observability',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink],
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
  private readonly TEMPO_BASE = 'http://localhost:3001/api/datasources/proxy/uid/tempo';

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

  // ── Latency histograms ────────────────────────────────────────────────────
  latencyBuckets = signal<LatencyBucket[]>([]);
  latencyLoading = signal(false);

  // ── Live Feeds ────────────────────────────────────────────────────────────
  liveSub = signal<'sse' | 'activity'>('sse');

  // SSE
  sseEvents = signal<LiveCustomer[]>([]);
  sseStatus = signal<SseStatus>('disconnected');
  sseTrafficRunning = signal(false);
  private _es: EventSource | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _badgeTimers = new Map<number, ReturnType<typeof setTimeout>>();

  // Endpoint Activity (Prometheus polling)
  activityFeed = signal<Array<{ time: string; method: string; uri: string; status: string }>>([]);
  activityPolling = signal(false);
  activityTrafficRunning = signal(false);
  private _activityTimer: ReturnType<typeof setInterval> | null = null;

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

  // ── Flame graph ───────────────────────────────────────────────────────────
  flameViewTrace = signal<Trace | null>(null);

  ngOnInit(): void {
    // Pre-connect SSE so it's ready by the time the user opens the Live tab
    this.connectSse();
    // Pre-load Tempo tag list for the search autocomplete
    this.loadTempoTags();
  }

  ngOnDestroy(): void {
    this.stopLogsPolling();
    this.cleanupSse();
    this.stopActivityPolling();
  }

  switchTab(tab: ObsTab): void {
    this.activeTab.set(tab);
    if (tab === 'logger' && this.loggersList().length === 0) {
      this.loadLoggers();
    }
    if (tab === 'traces' && this.tempoTags().length === 0) {
      this.loadTempoTags();
    }
    if (tab === 'live' && this._es === null && this.sseStatus() === 'disconnected') {
      this.connectSse();
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
    'http://localhost:3001/explore?schemaVersion=1&panes=' +
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
      return `http://localhost:3001/explore?schemaVersion=1&panes=${panes}&orgId=1`;
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
            `Tempo unreachable (Grafana proxy http://localhost:3001) — ${e.status || 'check that LGTM is running'}.`,
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
    this.http.get<any>(`${this.TEMPO_BASE}/api/traces/${id}`).subscribe({
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
  private parseOtlpTrace(traceId: string, otlp: any): Trace {
    const spans: Span[] = [];
    for (const batch of otlp.batches ?? []) {
      const svcAttr = (batch.resource?.attributes ?? []).find((a: any) => a.key === 'service.name');
      const svcName: string = svcAttr?.value?.stringValue ?? 'unknown';
      for (const scope of batch.scopeSpans ?? []) {
        for (const s of scope.spans ?? []) {
          // traceId and spanId are base64-encoded bytes in OTLP
          const spanId: string = this.b64toHex(s.spanId ?? '');
          const parentId: string | undefined = s.parentSpanId
            ? this.b64toHex(s.parentSpanId)
            : undefined;
          const start = Number(s.startTimeUnixNano ?? 0);
          const end = Number(s.endTimeUnixNano ?? 0);
          const durUs = Math.round((end - start) / 1000); // ns → µs
          const tags: Record<string, string> = {};
          for (const attr of s.attributes ?? []) {
            const v = attr.value;
            tags[attr.key] =
              v?.stringValue ?? v?.intValue?.toString() ?? v?.boolValue?.toString() ?? '';
          }
          spans.push({
            traceId,
            spanId,
            parentSpanId: parentId,
            operationName: s.name ?? '?',
            serviceName: svcName,
            startTimeUnixNano: start,
            duration: durUs,
            tags,
            status: s.status?.code === 2 ? 'error' : 'ok',
          });
        }
      }
    }
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
      .get<any>('http://localhost:3100/loki/api/v1/query_range', {
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

  // ── Live Feeds — SSE ─────────────────────────────────────────────────────
  private connectSse(): void {
    this.cleanupSse();
    this.sseStatus.set('connecting');
    const url = `${this.env.baseUrl()}/customers/stream`;
    try {
      this._es = new EventSource(url);
      this._es.addEventListener('customer', (e: MessageEvent) => {
        this.sseStatus.set('connected');
        try {
          const c = JSON.parse(e.data) as LiveCustomer;
          c.isNew = true;
          this.sseEvents.update((prev) => [c, ...prev].slice(0, MAX_SSE_EVENTS));
          const t = setTimeout(() => {
            this.sseEvents.update((prev) =>
              prev.map((ev) => (ev.id === c.id ? { ...ev, isNew: false } : ev)),
            );
            this._badgeTimers.delete(c.id);
          }, NEW_BADGE_MS);
          this._badgeTimers.set(c.id, t);
        } catch {
          /* ignore */
        }
      });
      this._es.addEventListener('ping', () => this.sseStatus.set('connected'));
      this._es.onopen = () => this.sseStatus.set('connected');
      this._es.onerror = () => {
        if (!this._es) return;
        if (this._es.readyState === EventSource.CLOSED) {
          // Connection truly closed — manual reconnect needed.
          this.sseStatus.set('reconnecting');
          this._es.close();
          this._es = null;
          this._reconnectTimer = setTimeout(() => this.connectSse(), RECONNECT_DELAY_MS);
        }
        // readyState === CONNECTING: browser is already auto-reconnecting.
        // Don't touch the status — onopen will fire when it succeeds.
      };
    } catch {
      this.sseStatus.set('disconnected');
    }
  }

  reconnectSse(): void {
    this.connectSse();
  }

  stopSse(): void {
    this.cleanupSse();
    this.sseStatus.set('disconnected');
  }

  private cleanupSse(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._badgeTimers.forEach((t) => clearTimeout(t));
    this._badgeTimers.clear();
    if (this._es) {
      this._es.close();
      this._es = null;
    }
  }

  sseStatusLabel(s: SseStatus): string {
    switch (s) {
      case 'connected':
        return '● Connected';
      case 'connecting':
        return '◌ Connecting…';
      case 'reconnecting':
        return '⟳ Reconnecting…';
      case 'disconnected':
        return '○ Disconnected';
    }
  }

  sseStatusClass(s: SseStatus): string {
    switch (s) {
      case 'connected':
        return 'sse-connected';
      case 'connecting':
        return 'sse-connecting';
      case 'reconnecting':
        return 'sse-reconnecting';
      case 'disconnected':
        return 'sse-disconnected';
    }
  }

  generateSseTraffic(count = 3): void {
    this.sseTrafficRunning.set(true);
    const firstNames = ['Alice', 'Bob', 'Carlos', 'Diana', 'Eve', 'Frank', 'Grace', 'Hiro'];
    const lastNames = ['Smith', 'Jones', 'Tanaka', 'Müller', 'Dupont', 'Kim', 'Rossi', 'Patel'];
    const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const base = this.env.baseUrl();
    let done = 0;
    for (let i = 0; i < count; i++) {
      const first = rand(firstNames);
      const last = rand(lastNames);
      const suffix = Math.floor(Math.random() * 9000 + 1000);
      this.http
        .post(`${base}/customers`, {
          firstName: first,
          lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@demo.dev`,
        })
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          done++;
          if (done === count) {
            this.sseTrafficRunning.set(false);
            this.toast.show(`${count} customer(s) created — SSE events incoming`, 'success');
          }
        });
    }
  }

  // ── Live Feeds — Endpoint Activity ────────────────────────────────────────
  toggleActivityPolling(): void {
    if (this.activityPolling()) {
      this.stopActivityPolling();
    } else {
      this.activityPolling.set(true);
      this.pollActivity();
      this._activityTimer = setInterval(() => this.pollActivity(), 2000);
    }
  }

  private stopActivityPolling(): void {
    this.activityPolling.set(false);
    if (this._activityTimer) {
      clearInterval(this._activityTimer);
      this._activityTimer = null;
    }
  }

  private pollActivity(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const entries: Array<{ time: string; method: string; uri: string; status: string }> = [];
        const regex =
          /http_server_requests_seconds_count\{[^}]*method="(\w+)"[^}]*status="(\d+)"[^}]*uri="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
          entries.push({
            time: new Date().toISOString().slice(11, 23),
            method: m[1],
            uri: m[3],
            status: m[2],
          });
        }
        if (entries.length > 0) {
          this.activityFeed.update((f) => [...entries.slice(0, 5), ...f].slice(0, 100));
        }
      },
      error: () => {},
    });
  }

  generateActivityTraffic(): void {
    this.activityTrafficRunning.set(true);
    const base = this.env.baseUrl();
    const urls = [
      `${base}/customers?page=0&size=10`,
      `${base}/customers?page=0&size=10`,
      `${base}/actuator/health`,
      `${base}/customers/recent`,
      `${base}/customers/summary?page=0&size=5`,
      `${base}/customers/aggregate`,
      `${base}/customers/1/todos`,
      `${base}/customers/1/enrich`,
      `${base}/customers?page=999&size=1`,
      `${base}/actuator/info`,
    ];
    let done = 0;
    for (const url of urls) {
      this.http
        .get(url)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          done++;
          if (done === urls.length) this.activityTrafficRunning.set(false);
        });
    }
  }

  // ── Latency histograms ────────────────────────────────────────────────────
  /** Human-readable bucket boundaries (in seconds) to group Micrometer's fine-grained buckets */
  private readonly displayBuckets = [
    0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
  ];

  fetchLatencyHistogram(): void {
    this.latencyLoading.set(true);

    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        // Parse all raw cumulative buckets, aggregated across URIs/methods/statuses
        const rawMap = new Map<number, number>();
        const regex =
          /http_server_requests_seconds_bucket\{[^}]*le="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const le = parseFloat(match[1]);
          if (isFinite(le)) {
            rawMap.set(le, (rawMap.get(le) || 0) + parseFloat(match[2]));
          }
        }

        if (rawMap.size === 0) {
          this.latencyBuckets.set([]);
          this.latencyLoading.set(false);
          return;
        }

        // Sort raw buckets by le value
        const rawSorted = [...rawMap.entries()].sort((a, b) => a[0] - b[0]);

        // Interpolate cumulative count at each display boundary
        const cumulativeAt = (target: number): number => {
          for (const [le, count] of rawSorted) {
            if (le >= target) return count;
          }
          return rawSorted[rawSorted.length - 1][1];
        };

        // Build display buckets with differential counts
        const result: LatencyBucket[] = [];
        let prevCount = 0;
        for (const boundary of this.displayBuckets) {
          const cumulative = cumulativeAt(boundary);
          const diff = cumulative - prevCount;
          if (diff > 0) {
            const label = boundary < 1 ? `${boundary * 1000}` : `${boundary}`;
            result.push({ le: label, count: diff });
          }
          prevCount = cumulative;
        }

        this.latencyBuckets.set(result);
        this.latencyLoading.set(false);
      },
      error: () => {
        this.toast.show('Could not fetch Prometheus metrics', 'error');
        this.latencyLoading.set(false);
      },
    });
  }

  histogramBars(): Array<{ label: string; height: number; count: number }> {
    const buckets = this.latencyBuckets();
    if (!buckets.length) return [];
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({
      label: parseFloat(b.le) >= 1000 ? `${(parseFloat(b.le) / 1000).toFixed(1)}s` : `${b.le}ms`,
      height: (b.count / max) * 100,
      count: b.count,
    }));
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
