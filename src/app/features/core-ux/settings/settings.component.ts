/**
 * SettingsComponent — Backend configuration explorer.
 *
 * Sections:
 * - Actuator explorer: call any actuator endpoint and view raw response
 * - Loggers: browse/filter Spring loggers, change levels live via POST
 * - Application info: /actuator/info metadata
 *
 * SQL Explorer has moved to DatabaseComponent (/database).
 */
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EnvService } from '../../../core/env/env.service';
import { ToastService } from '../../../core/toast/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeatureFlagService } from '../../../core/feature-flags/feature-flag.service';
import { RouterLink } from '@angular/router';
import type { ScheduledJob, ActuatorEnv, ActuatorBeans } from './settings-types';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, JsonPipe, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  /** Feature flags from unleash-proxy — isAvailable() false on Local compose. */
  readonly flags = inject(FeatureFlagService);

  /** Flag names sorted alphabetically for deterministic rendering.
   *  Explicit `localeCompare` — JS `Array.sort()` with no comparator coerces
   *  to string and uses UTF-16 code-unit order, which is locale-unaware
   *  (Sonar typescript:S2871). Flag names are ASCII today but this guards
   *  against future non-ASCII identifiers. */
  readonly flagNames = computed(() =>
    Object.keys(this.flags.flags()).sort((a, b) => a.localeCompare(b)),
  );

  // ── Actuator info ──────────────────────────────────────────────────────────

  /** Signal: raw JSON from `/actuator/info` (app name, version, Git metadata, etc.). */
  actuatorInfo = signal<unknown>(null);

  /** Signal: raw JSON from `/actuator/env`. Shown as collapsible property sources. */
  actuatorEnv = signal<unknown>(null);

  /** Signal: count of Spring beans in the application context. Null until loaded. */
  actuatorBeans = signal<number | null>(null);

  /** Signal: true while the `/actuator/info` load is in flight. */
  loading = signal(false);

  /** Signal: error message if actuator endpoints are unreachable. */
  error = signal('');

  // ── Actuator endpoints ─────────────────────────────────────────────────────

  /** Pre-defined actuator endpoints shown in the explorer dropdown. */
  readonly endpoints = [
    { label: 'Health', path: '/actuator/health', icon: '💚' },
    { label: 'Info', path: '/actuator/info', icon: 'ℹ️' },
    { label: 'Env', path: '/actuator/env', icon: '⚙️' },
    { label: 'Beans', path: '/actuator/beans', icon: '🫘' },
    { label: 'Metrics', path: '/actuator/metrics', icon: '📈' },
    { label: 'Loggers', path: '/actuator/loggers', icon: '📝' },
    { label: 'Prometheus', path: '/actuator/prometheus', icon: '🔥' },
  ];

  /** Signal: path of the currently selected actuator endpoint. */
  selectedEndpoint = signal<string | null>(null);

  /** Signal: raw response text from the selected actuator endpoint call. */
  endpointResult = signal<string | null>(null);

  /** Signal: true while an actuator endpoint call is in flight. */
  endpointLoading = signal(false);

  // ── Loggers ───────────────────────────────────────────────────────────────

  /** Signal: list of Spring loggers with their current effective log level. */
  loggers = signal<{ name: string; level: string }[]>([]);

  /** Logger name filter bound via ngModel — filters the displayed logger list. */
  loggerFilter = '';

  /** Signal: true while the loggers list or a level-change request is in flight. */
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
      },
      // /actuator/env is restricted to ROLE_ADMIN — anonymous or basic-auth
      // sessions get 401/403. Surface the failure as a left-pane null state
      // (the template renders "—" when actuatorEnv is null) rather than a
      // toast (it's not actionable for non-admin users).
      error: () => {
        this.actuatorEnv.set(null);
      },
    });

    this.http.get<ActuatorBeans>(`${base}/actuator/beans`).subscribe({
      next: (v) => {
        const ctx = Object.values(v.contexts ?? {});
        let count = 0;
        for (const c of ctx) {
          count += Object.keys(c.beans ?? {}).length;
        }
        this.actuatorBeans.set(count);
      },
      // Same rationale as above: /actuator/beans requires ROLE_ADMIN.
      // We reset the count to 0 to indicate "unknown / not authorised".
      error: () => {
        this.actuatorBeans.set(0);
      },
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
      next: (v) => {
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

  // ── Scheduled Jobs ────────────────────────────────────────────────────────
  scheduledJobs = signal<ScheduledJob[]>([]);
  scheduledJobsLoading = signal(false);
  scheduledJobsError = signal('');

  loadScheduledJobs(): void {
    this.scheduledJobsLoading.set(true);
    this.scheduledJobsError.set('');
    const base = this.env.baseUrl();
    const token = this.auth.token();
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    this.http.get<ScheduledJob[]>(`${base}/scheduled/jobs`, { headers }).subscribe({
      next: (jobs) => {
        this.scheduledJobs.set(jobs);
        this.scheduledJobsLoading.set(false);
      },
      error: (e) => {
        this.scheduledJobsError.set(`Error ${e.status}: ${e.message}`);
        this.scheduledJobsLoading.set(false);
      },
    });
  }

  /** A job is "active" (locked) when lockUntil is in the future */
  isJobActive(job: ScheduledJob): boolean {
    if (!job.lockUntil) return false;
    return new Date(job.lockUntil) > new Date();
  }
}
