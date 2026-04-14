/**
 * ObservabilityComponent — Live backend telemetry with 4 tabs.
 *
 * Traces: Fetches distributed traces from Zipkin API directly (CORS enabled via env var).
 *   Displays trace list, expandable span waterfall, and flame graph view.
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
import { Component, inject, signal, OnDestroy } from '@angular/core';
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
  operationName: string;
  serviceName: string;
  duration: number; // microseconds
  tags: Record<string, string>;
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

type ObsTab = 'traces' | 'logs' | 'latency';

@Component({
  selector: 'app-observability',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './observability.component.html',
  styleUrl: './observability.component.scss',
})
export class ObservabilityComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  activeTab = signal<ObsTab>('traces');

  // ── Traces (Zipkin/Tempo API) ─────────────────────────────────────────────
  traces = signal<Trace[]>([]);
  tracesLoading = signal(false);
  tracesError = signal('');
  traceLimit = 20;
  traceService = 'customer-service';
  selectedTrace = signal<Trace | null>(null);

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

  // ── Flame graph ───────────────────────────────────────────────────────────
  flameViewTrace = signal<Trace | null>(null);

  ngOnDestroy(): void {
    this.stopLogsPolling();
  }

  switchTab(tab: ObsTab): void {
    this.activeTab.set(tab);
  }

  // ── Traces ────────────────────────────────────────────────────────────────
  fetchTraces(): void {
    this.tracesLoading.set(true);
    this.tracesError.set('');

    // Call Zipkin directly — CORS enabled via ZIPKIN_HTTP_ALLOWED_ORIGINS in docker-compose
    this.http
      .get<any[][]>('http://localhost:9411/api/v2/traces', {
        params: {
          serviceName: this.traceService,
          limit: this.traceLimit.toString(),
          lookback: '3600000', // 1 hour
        },
      })
      .subscribe({
        next: (data) => {
          this.traces.set(
            data.map((spans) => {
              const root = spans[0];
              const totalDuration = spans.reduce((max, s) => Math.max(max, s.duration || 0), 0);
              return {
                traceId: root.traceID || root.traceId,
                spans: spans.map((s: any) => ({
                  traceId: s.traceID || s.traceId,
                  spanId: s.spanID || s.id,
                  operationName: s.operationName || s.name || '?',
                  serviceName: s.localEndpoint?.serviceName || s.process?.serviceName || '?',
                  duration: s.duration || 0,
                  tags: s.tags || {},
                })),
                durationMs: totalDuration / 1000,
                serviceName: root.localEndpoint?.serviceName || this.traceService,
                operationName: root.name || root.operationName || '?',
                timestamp: new Date((root.timestamp || 0) / 1000),
              };
            }),
          );
          this.tracesLoading.set(false);
        },
        error: (e) => {
          this.tracesError.set(
            `Could not fetch traces from Zipkin (localhost:9411) — ${e.status || 'unreachable'}. Is Zipkin running?`,
          );
          this.tracesLoading.set(false);
        },
      });
  }

  selectTrace(t: Trace): void {
    this.selectedTrace.set(this.selectedTrace()?.traceId === t.traceId ? null : t);
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
