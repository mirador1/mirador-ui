import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { JsonPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, catchError, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { ActivityService } from '../../core/activity/activity.service';

interface HealthSnapshot {
  time: Date;
  health: string;
  readiness: string;
  liveness: string;
}

interface ParsedMetrics {
  httpRequestsTotal: number;
  httpLatencyP50: number;
  httpLatencyP95: number;
  httpLatencyP99: number;
}

interface MetricsSample {
  time: Date;
  requestsTotal: number;
  rps: number;
}

interface LatencyResult {
  envName: string;
  avgMs: number;
  p95Ms: number;
  errors: number;
  total: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  health = signal<unknown>(null);
  readiness = signal<unknown>(null);
  liveness = signal<unknown>(null);
  error = signal('');
  lastRefresh = signal<Date | null>(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  customerCount = signal<number | null>(null);
  metrics = signal<ParsedMetrics | null>(null);
  metricsError = signal('');

  // ── Health history ─────────────────────────────────────────────────────────
  healthHistory = signal<HealthSnapshot[]>([]);

  // ── Real-time chart ───────────────────────────────────────────────────────
  metricsSamples = signal<MetricsSample[]>([]);
  private _chartTimer: ReturnType<typeof setInterval> | null = null;
  chartRunning = signal(false);

  // ── Latency comparator ────────────────────────────────────────────────────
  latencyEnvA = signal(0); // index in env.environments
  latencyEnvB = signal(1);
  latencyCount = signal(10);
  latencyResults = signal<LatencyResult[]>([]);
  latencyRunning = signal(false);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  autoRefreshInterval = signal<number>(0);
  readonly intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1min', value: 60 }
  ];
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _previousHealthStatus: string | null = null;

  readonly links = [
    { label: 'Grafana — Metrics', sub: 'HTTP throughput & latency dashboards', url: 'http://localhost:3000', icon: '📊' },
    { label: 'Grafana — Traces & Logs', sub: 'Tempo traces · Loki log correlation', url: 'http://localhost:3001', icon: '🔍' },
    { label: 'Prometheus', sub: 'Raw metrics & PromQL queries', url: 'http://localhost:9090', icon: '🔥' },
    { label: 'Zipkin', sub: 'Distributed tracing UI', url: 'http://localhost:9411', icon: '🔗' },
    { label: 'Pyroscope', sub: 'Continuous profiling', url: 'http://localhost:4040', icon: '🧬' },
    { label: 'Swagger UI', sub: 'Interactive API documentation', url: `${this.env.baseUrl()}/swagger-ui.html`, icon: '📄' },
    { label: 'Actuator /metrics', sub: 'Prometheus scrape endpoint', url: `${this.env.baseUrl()}/actuator/prometheus`, icon: '📈' },
    { label: 'pgAdmin', sub: 'PostgreSQL database manager', url: 'http://localhost:5050', icon: '🐘' },
    { label: 'Kafka UI', sub: 'Topics, consumers & messages', url: 'http://localhost:9080', icon: '📨' },
    { label: 'RedisInsight', sub: 'Redis key browser', url: 'http://localhost:5540', icon: '🗄️' },
    { label: 'Keycloak Admin', sub: 'OAuth2 identity provider (admin/admin)', url: 'http://localhost:9090/admin', icon: '🔐' }
  ];

  ngOnInit(): void {
    this.refresh();
    window.addEventListener('app:refresh', this._onRefresh);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.stopChart();
    window.removeEventListener('app:refresh', this._onRefresh);
  }

  private _onRefresh = () => this.refresh();

  refresh(): void {
    this.error.set('');

    this.api.getHealth().subscribe({
      next: v => {
        const newStatus = (v as { status?: string })?.status ?? '?';
        if (this._previousHealthStatus && this._previousHealthStatus !== newStatus) {
          if (newStatus === 'UP') {
            this.toast.show('Backend is back UP', 'success');
            this.activity.log('health-change', 'Backend health → UP');
          } else {
            this.toast.show(`Backend health changed to ${newStatus}`, 'error', 6000);
            this.activity.log('health-change', `Backend health → ${newStatus}`);
          }
        }
        this._previousHealthStatus = newStatus;
        this.health.set(v);
        this.lastRefresh.set(new Date());
        this.recordHistory();
      },
      error: () => {
        if (this._previousHealthStatus && this._previousHealthStatus !== 'UNREACHABLE') {
          this.toast.show('Backend is unreachable!', 'error', 6000);
          this.activity.log('health-change', 'Backend unreachable');
        }
        this._previousHealthStatus = 'UNREACHABLE';
        this.health.set({ status: 'UNREACHABLE' });
        this.error.set(`Backend not reachable at ${this.env.baseUrl()}`);
        this.recordHistory();
      }
    });

    this.api.getReadiness().subscribe({
      next: v => this.readiness.set(v),
      error: () => this.readiness.set({ status: 'UNREACHABLE' })
    });

    this.api.getLiveness().subscribe({
      next: v => this.liveness.set(v),
      error: () => this.liveness.set({ status: 'UNREACHABLE' })
    });

    this.api.getCustomers(0, 1).subscribe({
      next: page => this.customerCount.set(page.totalElements),
      error: () => this.customerCount.set(null)
    });

    this.api.getPrometheusMetrics().subscribe({
      next: text => this.metrics.set(this.parsePrometheus(text)),
      error: () => this.metricsError.set('Could not fetch metrics')
    });
  }

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  setAutoRefresh(seconds: number): void {
    this.autoRefreshInterval.set(seconds);
    this.stopTimer();
    if (seconds > 0) {
      this._timer = setInterval(() => this.refresh(), seconds * 1000);
    }
  }

  private stopTimer(): void {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  // ── Real-time chart ───────────────────────────────────────────────────────
  toggleChart(): void {
    if (this.chartRunning()) {
      this.stopChart();
    } else {
      this.startChart();
    }
  }

  private startChart(): void {
    this.chartRunning.set(true);
    this.metricsSamples.set([]);
    this.sampleMetrics();
    this._chartTimer = setInterval(() => this.sampleMetrics(), 3000);
  }

  private stopChart(): void {
    this.chartRunning.set(false);
    if (this._chartTimer) { clearInterval(this._chartTimer); this._chartTimer = null; }
  }

  private sampleMetrics(): void {
    this.api.getPrometheusMetrics().subscribe({
      next: text => {
        const parsed = this.parsePrometheus(text);
        const samples = this.metricsSamples();
        const prevTotal = samples.length > 0 ? samples[samples.length - 1].requestsTotal : parsed.httpRequestsTotal;
        const rps = Math.max(0, (parsed.httpRequestsTotal - prevTotal) / 3);
        this.metricsSamples.update(s => [...s.slice(-39), {
          time: new Date(),
          requestsTotal: parsed.httpRequestsTotal,
          rps
        }]);
      },
      error: () => {}
    });
  }

  chartBars(): Array<{ x: number; height: number; rps: number }> {
    const samples = this.metricsSamples();
    if (samples.length < 2) return [];
    const maxRps = Math.max(1, ...samples.map(s => s.rps));
    const barWidth = 300 / 40;
    return samples.map((s, i) => ({
      x: i * barWidth,
      height: (s.rps / maxRps) * 80,
      rps: s.rps
    }));
  }

  chartMaxRps(): number {
    const samples = this.metricsSamples();
    return Math.max(1, ...samples.map(s => s.rps));
  }

  // ── Latency comparator ────────────────────────────────────────────────────
  runLatencyComparison(): void {
    this.latencyRunning.set(true);
    this.latencyResults.set([]);

    const envs = [
      this.env.environments[this.latencyEnvA()],
      this.env.environments[this.latencyEnvB()]
    ];

    const count = this.latencyCount();
    let completed = 0;

    for (const envDef of envs) {
      const timings: number[] = [];
      let errors = 0;
      let done = 0;

      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        this.http.get(`${envDef.baseUrl}/actuator/health`).pipe(
          catchError(() => { errors++; return of(null); })
        ).subscribe(() => {
          timings.push(performance.now() - t0);
          done++;
          if (done === count) {
            timings.sort((a, b) => a - b);
            const avg = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
            const p95 = timings.length ? timings[Math.floor(timings.length * 0.95)] : 0;
            this.latencyResults.update(r => [...r, {
              envName: envDef.name,
              avgMs: Math.round(avg * 10) / 10,
              p95Ms: Math.round(p95 * 10) / 10,
              errors,
              total: count
            }]);
            completed++;
            if (completed === 2) this.latencyRunning.set(false);
          }
        });
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private recordHistory(): void {
    const snap: HealthSnapshot = {
      time: new Date(),
      health: this.extractStatus(this.health()),
      readiness: this.extractStatus(this.readiness()),
      liveness: this.extractStatus(this.liveness())
    };
    this.healthHistory.update(h => [...h.slice(-29), snap]);
  }

  private extractStatus(data: unknown): string {
    return (data as { status?: string })?.status ?? '?';
  }

  private parsePrometheus(raw: string): ParsedMetrics {
    const getCounter = (name: string): number => {
      const match = raw.match(new RegExp(`^${name}\\b.*?\\s+(\\d+\\.?\\d*)`, 'm'));
      return match ? parseFloat(match[1]) : 0;
    };
    const getQuantile = (name: string, q: string): number => {
      const match = raw.match(new RegExp(`^${name}\\{.*quantile="${q}".*\\}\\s+(\\d+\\.?\\d*(?:E[+-]?\\d+)?)`, 'm'));
      return match ? parseFloat(match[1]) * 1000 : 0;
    };
    return {
      httpRequestsTotal: getCounter('http_server_requests_seconds_count'),
      httpLatencyP50: getQuantile('http_server_requests_seconds', '0.5'),
      httpLatencyP95: getQuantile('http_server_requests_seconds', '0.95'),
      httpLatencyP99: getQuantile('http_server_requests_seconds', '0.99')
    };
  }

  statusClass(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return 'badge-unknown';
    if (d.status === 'UP') return 'badge-up';
    return 'badge-down';
  }

  statusLabel(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return '...';
    return d.status ?? '?';
  }

  sparklinePath(): string {
    const history = this.healthHistory();
    if (history.length < 2) return '';
    const w = 200;
    const h = 30;
    const step = w / (history.length - 1);
    return history
      .map((s, i) => {
        const y = s.health === 'UP' ? 5 : h - 5;
        return `${i === 0 ? 'M' : 'L'}${i * step},${y}`;
      })
      .join(' ');
  }
}
