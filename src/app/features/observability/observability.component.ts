import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';

interface Trace {
  traceId: string;
  spans: Span[];
  durationMs: number;
  serviceName: string;
  operationName: string;
  timestamp: Date;
}

interface Span {
  traceId: string;
  spanId: string;
  operationName: string;
  serviceName: string;
  duration: number; // microseconds
  tags: Record<string, string>;
}

interface LogEntry {
  timestamp: string;
  line: string;
  level?: string;
}

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
  styleUrl: './observability.component.scss'
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
  lokiQuery = '{service_name="customer-service"}';
  lokiLimit = 100;
  logsPolling = signal(false);
  private _logsTimer: ReturnType<typeof setInterval> | null = null;

  // ── Latency histograms ────────────────────────────────────────────────────
  latencyBuckets = signal<LatencyBucket[]>([]);
  latencyLoading = signal(false);

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

    // Zipkin API (Tempo exposes it at /api/v2/traces)
    const zipkinUrl = 'http://localhost:9411';
    this.http.get<any[][]>(`${zipkinUrl}/api/v2/traces`, {
      params: {
        serviceName: this.traceService,
        limit: this.traceLimit.toString(),
        lookback: '3600000' // 1 hour
      }
    }).subscribe({
      next: data => {
        this.traces.set(data.map(spans => {
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
              tags: s.tags || {}
            })),
            durationMs: totalDuration / 1000,
            serviceName: root.localEndpoint?.serviceName || this.traceService,
            operationName: root.name || root.operationName || '?',
            timestamp: new Date((root.timestamp || 0) / 1000)
          };
        }));
        this.tracesLoading.set(false);
      },
      error: e => {
        this.tracesError.set(`Could not fetch traces from ${zipkinUrl} — ${e.status || 'unreachable'}`);
        this.tracesLoading.set(false);
      }
    });
  }

  selectTrace(t: Trace): void {
    this.selectedTrace.set(this.selectedTrace()?.traceId === t.traceId ? null : t);
  }

  // ── Logs ──────────────────────────────────────────────────────────────────
  fetchLogs(): void {
    this.logsLoading.set(true);
    this.logsError.set('');

    const lokiUrl = 'http://localhost:3100';
    const end = Date.now() * 1e6; // nanoseconds
    const start = (Date.now() - 3600000) * 1e6; // 1 hour ago

    this.http.get<any>(`${lokiUrl}/loki/api/v1/query_range`, {
      params: {
        query: this.lokiQuery,
        limit: this.lokiLimit.toString(),
        start: start.toString(),
        end: end.toString()
      }
    }).subscribe({
      next: data => {
        const entries: LogEntry[] = [];
        for (const stream of data?.data?.result ?? []) {
          for (const [ts, line] of stream.values ?? []) {
            const level = line.match(/\b(ERROR|WARN|INFO|DEBUG|TRACE)\b/)?.[1];
            entries.push({
              timestamp: new Date(Number(ts) / 1e6).toISOString().slice(11, 23),
              line,
              level
            });
          }
        }
        entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        this.logs.set(entries);
        this.logsLoading.set(false);
      },
      error: e => {
        this.logsError.set(`Could not fetch logs from Loki — ${e.status || 'unreachable'}`);
        this.logsLoading.set(false);
      }
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

  private stopLogsPolling(): void {
    this.logsPolling.set(false);
    if (this._logsTimer) { clearInterval(this._logsTimer); this._logsTimer = null; }
  }

  logLevelClass(level?: string): string {
    switch (level) {
      case 'ERROR': return 'log-error';
      case 'WARN': return 'log-warn';
      case 'INFO': return 'log-info';
      case 'DEBUG': return 'log-debug';
      default: return 'log-default';
    }
  }

  // ── Latency histograms ────────────────────────────────────────────────────
  fetchLatencyHistogram(): void {
    this.latencyLoading.set(true);

    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: text => {
        const buckets: LatencyBucket[] = [];
        const regex = /http_server_requests_seconds_bucket\{[^}]*le="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const existing = buckets.find(b => b.le === match![1]);
          if (existing) {
            existing.count += parseFloat(match[2]);
          } else {
            buckets.push({ le: match[1], count: parseFloat(match[2]) });
          }
        }
        // Convert cumulative to differential
        const sorted = buckets.sort((a, b) => parseFloat(a.le) - parseFloat(b.le));
        const diff: LatencyBucket[] = [];
        for (let i = 0; i < sorted.length; i++) {
          const prev = i > 0 ? sorted[i - 1].count : 0;
          diff.push({ le: sorted[i].le, count: sorted[i].count - prev });
        }
        this.latencyBuckets.set(diff.filter(b => b.le !== '+Inf' && b.count > 0));
        this.latencyLoading.set(false);
      },
      error: () => {
        this.toast.show('Could not fetch Prometheus metrics', 'error');
        this.latencyLoading.set(false);
      }
    });
  }

  histogramBars(): Array<{ label: string; height: number; count: number }> {
    const buckets = this.latencyBuckets();
    if (!buckets.length) return [];
    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => ({
      label: parseFloat(b.le) < 1 ? `${parseFloat(b.le) * 1000}ms` : `${b.le}s`,
      height: (b.count / max) * 100,
      count: b.count
    }));
  }
}
