import { Component, inject, signal } from '@angular/core';
import { JsonPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly api = inject(ApiService);

  health = signal<unknown>(null);
  readiness = signal<unknown>(null);
  liveness = signal<unknown>(null);
  error = signal('');
  lastRefresh = signal<Date | null>(null);

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
      url: `${this.api.baseUrl}/swagger-ui.html`,
      icon: '📄'
    },
    {
      label: 'Actuator /metrics',
      sub: 'Prometheus scrape endpoint',
      url: `${this.api.baseUrl}/actuator/prometheus`,
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

  refresh(): void {
    this.error.set('');

    this.api.getHealth().subscribe({
      next: v => {
        this.health.set(v);
        this.lastRefresh.set(new Date());
      },
      error: () => this.error.set('Backend not reachable at http://localhost:8080')
    });

    this.api.getReadiness().subscribe({
      next: v => this.readiness.set(v),
      error: () => this.readiness.set({ status: 'UNREACHABLE' })
    });

    this.api.getLiveness().subscribe({
      next: v => this.liveness.set(v),
      error: () => this.liveness.set({ status: 'UNREACHABLE' })
    });
  }

  statusClass(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return 'badge-unknown';
    if (d.status === 'UP') return 'badge-up';
    return 'badge-down';
  }

  statusLabel(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return '…';
    return d.status ?? '?';
  }
}
