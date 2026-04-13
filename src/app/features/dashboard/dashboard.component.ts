import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { JsonPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';

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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);

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

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  autoRefreshInterval = signal<number>(0); // 0 = off, seconds
  readonly intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1min', value: 60 }
  ];
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _previousHealthStatus: string | null = null;

  readonly links = [
    {
      label: 'Grafana — Metrics',
      sub: 'HTTP throughput & latency dashboards',
      url: 'http://localhost:3000',
      icon: '📊'
    },
    {
      label: 'Grafana — Traces & Logs',
      sub: 'Tempo traces · Loki log correlation',
      url: 'http://localhost:3001',
      icon: '🔍'
    },
    {
      label: 'Prometheus',
      sub: 'Raw metrics & PromQL queries',
      url: 'http://localhost:9090',
      icon: '🔥'
    },
    {
      label: 'Swagger UI',
      sub: 'Interactive API documentation',
      url: `${this.env.baseUrl()}/swagger-ui.html`,
      icon: '📄'
    },
    {
      label: 'Actuator /metrics',
      sub: 'Prometheus scrape endpoint',
      url: `${this.env.baseUrl()}/actuator/prometheus`,
      icon: '📈'
    },
    {
      label: 'Keycloak Admin',
      sub: 'OAuth2 identity provider (admin/admin)',
      url: 'http://localhost:9090/admin',
      icon: '🔐'
    }
  ];

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  refresh(): void {
    this.error.set('');

    this.api.getHealth().subscribe({
      next: v => {
        const newStatus = (v as { status?: string })?.status ?? '?';
        if (this._previousHealthStatus && this._previousHealthStatus !== newStatus) {
          if (newStatus === 'UP') {
            this.toast.show('Backend is back UP', 'success');
          } else {
            this.toast.show(`Backend health changed to ${newStatus}`, 'error', 6000);
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

    // Fetch customer count
    this.api.getCustomers(0, 1).subscribe({
      next: page => this.customerCount.set(page.totalElements),
      error: () => this.customerCount.set(null)
    });

    // Fetch prometheus metrics
    this.api.getPrometheusMetrics().subscribe({
      next: text => this.metrics.set(this.parsePrometheus(text)),
      error: () => this.metricsError.set('Could not fetch metrics')
    });
  }

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

  private recordHistory(): void {
    const snap: HealthSnapshot = {
      time: new Date(),
      health: this.extractStatus(this.health()),
      readiness: this.extractStatus(this.readiness()),
      liveness: this.extractStatus(this.liveness())
    };
    this.healthHistory.update(h => [...h.slice(-29), snap]); // keep last 30
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
      return match ? parseFloat(match[1]) * 1000 : 0; // convert to ms
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
