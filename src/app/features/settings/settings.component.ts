import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { RouterLink } from '@angular/router';

interface ActuatorEnv {
  propertySources?: Array<{
    name: string;
    properties: Record<string, { value: string }>;
  }>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, JsonPipe, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  // ── Actuator info ──────────────────────────────────────────────────────────
  actuatorInfo = signal<unknown>(null);
  actuatorEnv = signal<unknown>(null);
  actuatorBeans = signal<number | null>(null);
  loading = signal(false);
  error = signal('');

  // ── Config values (read from actuator/env) ────────────────────────────────
  configValues = signal<Array<{ key: string; value: string; source: string }>>([]);

  // ── Actuator endpoints ─────────────────────────────────────────────────────
  readonly endpoints = [
    { label: 'Health', path: '/actuator/health' },
    { label: 'Info', path: '/actuator/info' },
    { label: 'Env', path: '/actuator/env' },
    { label: 'Beans', path: '/actuator/beans' },
    { label: 'Metrics', path: '/actuator/metrics' },
    { label: 'Loggers', path: '/actuator/loggers' },
    { label: 'Prometheus', path: '/actuator/prometheus' },
  ];

  selectedEndpoint = signal<string | null>(null);
  endpointResult = signal<string | null>(null);
  endpointLoading = signal(false);

  // ── Loggers ───────────────────────────────────────────────────────────────
  loggers = signal<Array<{ name: string; level: string }>>([]);
  loggerFilter = '';
  loggerLoading = signal(false);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.loadInfo();
    }
  }

  loadInfo(): void {
    this.loading.set(true);
    this.error.set('');
    const base = this.env.baseUrl();

    this.http.get(`${base}/actuator/info`).subscribe({
      next: (v) => {
        this.actuatorInfo.set(v);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not reach Actuator endpoints');
        this.loading.set(false);
      },
    });

    this.http.get<ActuatorEnv>(`${base}/actuator/env`).subscribe({
      next: (v) => {
        this.actuatorEnv.set(v);
        const configs: Array<{ key: string; value: string; source: string }> = [];
        for (const src of v.propertySources ?? []) {
          for (const [key, val] of Object.entries(src.properties ?? {})) {
            if (
              key.includes('rate') ||
              key.includes('timeout') ||
              key.includes('circuit') ||
              key.includes('resilience') ||
              key.includes('kafka') ||
              key.includes('bucket') ||
              key.includes('server.port') ||
              key.includes('spring.application')
            ) {
              configs.push({ key, value: String(val.value), source: src.name });
            }
          }
        }
        this.configValues.set(configs.slice(0, 50));
      },
      error: () => {},
    });

    this.http.get<{ contexts: unknown }>(`${base}/actuator/beans`).subscribe({
      next: (v) => {
        const ctx = Object.values(v.contexts ?? {});
        let count = 0;
        for (const c of ctx as any[]) {
          count += Object.keys(c.beans ?? {}).length;
        }
        this.actuatorBeans.set(count);
      },
      error: () => {},
    });
  }

  // ── Endpoint explorer ─────────────────────────────────────────────────────
  callEndpoint(path: string): void {
    this.selectedEndpoint.set(path);
    this.endpointResult.set(null);
    this.endpointLoading.set(true);

    const isText = path.includes('prometheus');

    if (isText) {
      this.http.get(`${this.env.baseUrl()}${path}`, { responseType: 'text' }).subscribe({
        next: (v) => {
          this.endpointResult.set(v);
          this.endpointLoading.set(false);
        },
        error: (e) => {
          this.endpointResult.set(`Error ${e.status}: ${e.message}`);
          this.endpointLoading.set(false);
        },
      });
      return;
    }

    this.http.get(`${this.env.baseUrl()}${path}`).subscribe({
      next: (v: any) => {
        this.endpointResult.set(JSON.stringify(v, null, 2));
        this.endpointLoading.set(false);
      },
      error: (e) => {
        this.endpointResult.set(`Error ${e.status}: ${e.message}`);
        this.endpointLoading.set(false);
      },
    });
  }

  // ── Loggers ───────────────────────────────────────────────────────────────
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
          this.loggers.set(entries);
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
    if (!this.loggerFilter) return this.loggers().slice(0, 50);
    const q = this.loggerFilter.toLowerCase();
    return this.loggers()
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, 50);
  }

  // ── SQL Explorer ──────────────────────────────────────────────────────────
  sqlQuery = 'SELECT id, name, email FROM customer LIMIT 20';
  sqlResult = signal<{ columns: string[]; rows: string[][] } | null>(null);
  sqlError = signal('');
  sqlLoading = signal(false);

  readonly sqlPresets = [
    'SELECT id, name, email FROM customer LIMIT 20',
    'SELECT COUNT(*) as total FROM customer',
    'SELECT name, email, created_at FROM customer ORDER BY created_at DESC LIMIT 10',
    'SELECT email, COUNT(*) as cnt FROM customer GROUP BY email HAVING COUNT(*) > 1',
  ];

  executeSql(): void {
    this.sqlLoading.set(true);
    this.sqlError.set('');
    this.sqlResult.set(null);

    // Uses H2 console or a custom endpoint — fallback to showing the query
    // Since most Spring Boot apps don't expose raw SQL, we simulate via /customers endpoint
    // This is a best-effort SQL explorer that works if the backend has a /sql endpoint
    this.http.post<any>(`${this.env.baseUrl()}/sql`, { query: this.sqlQuery }).subscribe({
      next: (res) => {
        if (Array.isArray(res) && res.length > 0) {
          const columns = Object.keys(res[0]);
          const rows = res.map((r: any) => columns.map((c) => String(r[c] ?? '')));
          this.sqlResult.set({ columns, rows });
        } else {
          this.sqlResult.set({ columns: ['result'], rows: [[JSON.stringify(res)]] });
        }
        this.sqlLoading.set(false);
      },
      error: (e) => {
        this.sqlError.set(
          `SQL endpoint not available (${e.status || 'error'}). Add a /sql endpoint to the backend or use pgAdmin at localhost:5050.`,
        );
        this.sqlLoading.set(false);
      },
    });
  }
}
