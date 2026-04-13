import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { JsonPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { ActivityService } from '../../core/activity/activity.service';
import { MetricsService, ParsedMetrics } from '../../core/metrics/metrics.service';
import { InfoTipComponent } from '../../shared/info-tip/info-tip.component';

interface HealthSnapshot {
  time: Date;
  health: string;
  readiness: string;
  liveness: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe, DecimalPipe, FormsModule, InfoTipComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  readonly metricsService = inject(MetricsService);

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

  // ── Real-time chart (persisted in MetricsService) ──────────────────────────

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  autoRefreshInterval = signal<number>(5);
  readonly intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '1s', value: 1 },
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
  ];
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _previousHealthStatus: string | null = null;

  readonly links = [
    {
      label: 'Grafana — Metrics',
      sub: 'HTTP throughput & latency dashboards',
      url: 'http://localhost:3000',
      icon: '📊',
    },
    {
      label: 'Grafana — Traces & Logs',
      sub: 'Tempo traces · Loki log correlation',
      url: 'http://localhost:3001',
      icon: '🔍',
    },
    {
      label: 'Prometheus',
      sub: 'Raw metrics & PromQL queries',
      url: 'http://localhost:9090',
      icon: '🔥',
    },
    { label: 'Zipkin', sub: 'Distributed tracing UI', url: 'http://localhost:9411', icon: '🔗' },
    { label: 'Pyroscope', sub: 'Continuous profiling', url: 'http://localhost:4040', icon: '🧬' },
    {
      label: 'Swagger UI',
      sub: 'Interactive API documentation',
      url: `${this.env.baseUrl()}/swagger-ui.html`,
      icon: '📄',
    },
    {
      label: 'Actuator /metrics',
      sub: 'Prometheus scrape endpoint',
      url: `${this.env.baseUrl()}/actuator/prometheus`,
      icon: '📈',
    },
    {
      label: 'pgAdmin',
      sub: 'PostgreSQL database manager',
      url: 'http://localhost:5050',
      icon: '🐘',
    },
    {
      label: 'Kafka UI',
      sub: 'Topics, consumers & messages',
      url: 'http://localhost:9080',
      icon: '📨',
    },
    { label: 'RedisInsight', sub: 'Redis key browser', url: 'http://localhost:5540', icon: '🗄️' },
    {
      label: 'Keycloak Admin',
      sub: 'OAuth2 identity provider (admin/admin)',
      url: 'http://localhost:9090/admin',
      icon: '🔐',
    },
  ];

  ngOnInit(): void {
    this.refresh();
    this.setAutoRefresh(this.autoRefreshInterval());
    this.loadContainers();
    window.addEventListener('app:refresh', this._onRefresh);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    window.removeEventListener('app:refresh', this._onRefresh);
  }

  private _onRefresh = () => this.refresh();

  refresh(): void {
    this.error.set('');

    this.api.getHealth().subscribe({
      next: (v) => {
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
      },
    });

    this.api.getReadiness().subscribe({
      next: (v) => this.readiness.set(v),
      error: () => this.readiness.set({ status: 'UNREACHABLE' }),
    });

    this.api.getLiveness().subscribe({
      next: (v) => this.liveness.set(v),
      error: () => this.liveness.set({ status: 'UNREACHABLE' }),
    });

    this.api.getCustomers(0, 1).subscribe({
      next: (page) => this.customerCount.set(page.totalElements),
      error: () => this.customerCount.set(null),
    });

    this.api.getPrometheusMetrics().subscribe({
      next: (text) => this.metrics.set(this.metricsService.parsePrometheus(text)),
      error: () => this.metricsError.set('Could not fetch metrics'),
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
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ── Real-time chart (delegates to MetricsService) ──────────────────────────
  toggleChart(): void {
    this.metricsService.toggle();
  }

  chartBars(): Array<{ x: number; height: number; rps: number }> {
    const samples = this.metricsService.samples();
    if (samples.length < 2) return [];
    const maxRps = Math.max(1, ...samples.map((s) => s.rps));
    const barWidth = 300 / 40;
    return samples.map((s, i) => ({
      x: i * barWidth,
      height: (s.rps / maxRps) * 80,
      rps: s.rps,
    }));
  }

  chartMaxRps(): number {
    const samples = this.metricsService.samples();
    return Math.max(1, ...samples.map((s) => s.rps));
  }

  // ── Docker service control ─────────────────────────────────────────────────
  dockerContainers = signal<Array<{ name: string; status: string; image: string; running: boolean }>>([]);
  dockerLoading = signal(false);
  dockerActionLoading = signal<string | null>(null);

  dockerError = signal('');

  loadContainers(): void {
    this.dockerLoading.set(true);
    this.dockerError.set('');
    this.http.get<any[]>('/docker-api/containers').pipe(catchError(() => of(null))).subscribe(containers => {
      this.dockerLoading.set(false);
      if (!containers) {
        this.dockerError.set('Cannot reach Docker API. Start it with: node scripts/docker-api.mjs');
        return;
      }
      this.dockerContainers.set(containers);
      const running = containers.filter((c: any) => c.running).length;
      this.toast.show(`${containers.length} containers found, ${running} running`, 'info');
    });
  }

  dockerAction(name: string, action: 'stop' | 'start' | 'restart'): void {
    this.dockerActionLoading.set(`${name}:${action}`);
    this.http.post<any>(`/docker-api/containers/${name}/${action}`, {}).pipe(catchError(() => of(null))).subscribe(() => {
      this.dockerActionLoading.set(null);
      this.toast.show(`${action} ${name}`, 'info');
      this.activity.log('health-change', `Docker ${action}: ${name}`);
      // Refresh containers list and health after a short delay
      setTimeout(() => {
        this.loadContainers();
        this.refresh();
      }, 2000);
    });
  }

  dockerRunningCount(): number {
    return this.dockerContainers().filter(c => c.running).length;
  }

  isDockerActionLoading(name: string, action: string): boolean {
    return this.dockerActionLoading() === `${name}:${action}`;
  }

  // ── Quick traffic generator ────────────────────────────────────────────────
  trafficRunning = signal(false);

  quickTraffic(): void {
    this.trafficRunning.set(true);
    const base = this.env.baseUrl();
    // Mix of fast endpoints (volume) and slow endpoints (latency impact)
    const endpoints = [
      `${base}/customers?page=0&size=5`,
      `${base}/customers?page=0&size=5`,
      `${base}/customers/recent`,
      `${base}/customers/summary?page=0&size=5`,
      `${base}/actuator/health`,
      `${base}/customers/aggregate`,          // virtual threads — ~100-300ms
      `${base}/customers/1/bio`,              // Ollama LLM — ~500ms+
      `${base}/customers/1/todos`,            // external API — ~200ms
      `${base}/customers/1/enrich`,           // Kafka round-trip — ~1-5s
      `${base}/customers?page=0&size=100`,    // large page — slower
    ];
    let done = 0;
    const total = endpoints.length;
    this.toast.show(`Sending ${total} requests (including slow ones: bio, enrich, aggregate)...`, 'info');
    for (const url of endpoints) {
      this.http.get(url).pipe(catchError(() => of(null))).subscribe(() => {
        done++;
        if (done === total) {
          this.trafficRunning.set(false);
          this.toast.show(`${total} requests done — latency metrics updated`, 'success');
          this.refresh();
        }
      });
    }
  }

  // ── Dependency graph ───────────────────────────────────────────────────────
  readonly depNodes = [
    { id: 'api', label: 'Customer API', x: 300, y: 50 },
    { id: 'pg', label: 'PostgreSQL', x: 100, y: 150 },
    { id: 'redis', label: 'Redis', x: 250, y: 180 },
    { id: 'kafka', label: 'Kafka', x: 400, y: 180 },
    { id: 'ollama', label: 'Ollama', x: 500, y: 100 },
    { id: 'keycloak', label: 'Keycloak', x: 130, y: 50 },
  ];
  readonly depEdgesCoords = (() => {
    const nodes = this.depNodes;
    const edges = [
      { from: 'api', to: 'pg' },
      { from: 'api', to: 'redis' },
      { from: 'api', to: 'kafka' },
      { from: 'api', to: 'ollama' },
      { from: 'api', to: 'keycloak' },
    ];
    return edges.map((e) => {
      const f = nodes.find((n) => n.id === e.from)!;
      const t = nodes.find((n) => n.id === e.to)!;
      return { x1: f.x, y1: f.y, x2: t.x, y2: t.y };
    });
  })();
  depStatus = signal<Record<string, 'up' | 'down' | 'unknown'>>({});

  // Map Docker container names to dependency graph node IDs
  private readonly containerToNode: Record<string, string> = {
    'postgres-demo': 'pg',
    'redis-demo': 'redis',
    'kafka-demo': 'kafka',
    'ollama': 'ollama',
    'keycloak': 'keycloak',
  };

  refreshDepGraph(): void {
    const base = this.env.baseUrl();
    const status: Record<string, 'up' | 'down' | 'unknown'> = {};

    // API + db + redis from actuator/health components
    this.http.get<any>(`${base}/actuator/health`).pipe(catchError(() => of(null))).subscribe(h => {
      const components = h?.components ?? {};
      status['api'] = h?.status === 'UP' ? 'up' : 'down';
      status['pg'] = components['db']?.status === 'UP' ? 'up' : components['db'] ? 'down' : 'unknown';
      status['redis'] = components['redis']?.status === 'UP' ? 'up' : components['redis'] ? 'down' : 'unknown';

      // Use Docker container status for services not in /actuator/health
      const containers = this.dockerContainers();
      if (containers.length > 0) {
        for (const [containerName, nodeId] of Object.entries(this.containerToNode)) {
          if (status[nodeId] && status[nodeId] !== 'unknown') continue; // already have a status
          const container = containers.find(c => c.name === containerName);
          if (container) {
            status[nodeId] = container.running ? 'up' : 'down';
          }
        }
      }

      this.depStatus.set({ ...status });
    });
  }

  depNodeColor(id: string): string {
    const s = this.depStatus()[id];
    if (s === 'up') return '#4ade80';
    if (s === 'down') return '#f87171';
    return '#94a3b8';
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  heatmapData = signal<Array<{ hour: number; count: number }>>([]);

  buildHeatmap(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        // Use total request count as a proxy; build 24 simulated cells based on current rate
        const match = text.match(/http_server_requests_seconds_count\b.*?\s+(\d+\.?\d*)/m);
        const total = match ? parseFloat(match[1]) : 0;
        const cells = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.round((total / 24) * (0.5 + Math.random())),
        }));
        this.heatmapData.set(cells);
      },
      error: () => {},
    });
  }

  heatmapColor(count: number): string {
    const max = Math.max(1, ...this.heatmapData().map((c) => c.count));
    const intensity = count / max;
    if (intensity < 0.2) return 'var(--bg-card-hover)';
    if (intensity < 0.4) return '#bbf7d0';
    if (intensity < 0.6) return '#86efac';
    if (intensity < 0.8) return '#4ade80';
    return '#16a34a';
  }

  // ── Snapshot comparator ───────────────────────────────────────────────────
  snapshotA = signal<(ParsedMetrics & { customerCount: number; timestamp: Date }) | null>(null);
  snapshotB = signal<(ParsedMetrics & { customerCount: number; timestamp: Date }) | null>(null);

  takeSnapshot(slot: 'A' | 'B'): void {
    const m = this.metrics();
    const cc = this.customerCount() ?? 0;
    if (!m) {
      this.toast.show('No metrics available — refresh first', 'warn');
      return;
    }
    const snap = { ...m, customerCount: cc, timestamp: new Date() };
    if (slot === 'A') this.snapshotA.set(snap);
    else this.snapshotB.set(snap);
    this.toast.show(`Snapshot ${slot} saved`, 'info');
  }

  snapshotDiff(): Array<{ label: string; a: number; b: number; pct: string }> | null {
    const a = this.snapshotA();
    const b = this.snapshotB();
    if (!a || !b) return null;
    const diff = (label: string, av: number, bv: number) => {
      const pct =
        av === 0
          ? bv > 0
            ? '+100%'
            : '0%'
          : `${bv >= av ? '+' : ''}${(((bv - av) / av) * 100).toFixed(1)}%`;
      return { label, a: av, b: bv, pct };
    };
    return [
      diff('Customers', a.customerCount, b.customerCount),
      diff('Total requests', a.httpRequestsTotal, b.httpRequestsTotal),
      diff('Latency p50', a.httpLatencyP50, b.httpLatencyP50),
      diff('Latency p95', a.httpLatencyP95, b.httpLatencyP95),
      diff('Latency p99', a.httpLatencyP99, b.httpLatencyP99),
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private recordHistory(): void {
    const snap: HealthSnapshot = {
      time: new Date(),
      health: this.extractStatus(this.health()),
      readiness: this.extractStatus(this.readiness()),
      liveness: this.extractStatus(this.liveness()),
    };
    this.healthHistory.update((h) => [...h.slice(-29), snap]);
  }

  private extractStatus(data: unknown): string {
    return (data as { status?: string })?.status ?? '?';
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
