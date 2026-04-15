/**
 * ChaosComponent — Failure injection, traffic generation, and impact monitoring.
 *
 * Chaos actions:
 * - Exhaust Rate Limit: 120 rapid requests to exceed the 100 req/min bucket
 * - Kafka Timeout: triggers 5s enrich timeout via /customers/1/enrich
 * - Circuit Breaker Trip: 10 rapid /bio calls to open Ollama's circuit breaker
 * - Invalid Payload Flood: 50 empty POST /customers for validation errors
 * - Concurrent Writes: 20 simultaneous customer creates
 * - Generate Traffic: mixed GET/POST for N seconds
 *
 * Impact monitor: polls every 2s with 5 health pings + Prometheus traffic breakdown.
 * Shows a live stacked bar chart (OK vs errors) and top-10 endpoint breakdown with RPS.
 *
 * Faker generator: creates N customers with realistic random names/emails
 * using a configurable delay between requests. Abortable mid-run.
 */
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { ActivityService } from '../../core/activity/activity.service';

/**
 * Definition of a single chaos engineering action shown as a button in the UI.
 * The `action` callback performs the actual HTTP calls when the button is clicked.
 */
interface ChaosAction {
  /** Short label displayed on the button. */
  name: string;
  /** Explanation of what the action does and which backend behavior it triggers. */
  description: string;
  /** Emoji icon displayed on the button for quick visual identification. */
  icon: string;
  /** CSS color string for the button border/glow effect. */
  color: string;
  /** Callback executed when the user clicks the action button. */
  action: () => void;
}

/**
 * A single impact monitoring sample from the 2-second health poll.
 * Used to build the live stacked bar chart (OK vs errors over time).
 */
interface ImpactSample {
  /** Wall-clock time of this sample. */
  time: Date;
  /** Number of health probe requests that returned 2xx in this sample. */
  ok: number;
  /** Number of health probe requests that returned non-2xx in this sample. */
  errors: number;
  /** Average response latency in milliseconds across all probes in this sample. */
  avgMs: number;
}

@Component({
  selector: 'app-chaos',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './chaos.component.html',
  styleUrl: './chaos.component.scss',
})
export class ChaosComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  /**
   * Signal: rolling list of impact monitoring samples (last N entries).
   * Rendered as a stacked bar chart in the template.
   */
  impactSamples = signal<ImpactSample[]>([]);

  /** Signal: true while the 2-second impact monitor polling is active. */
  monitoring = signal(false);

  /** Handle for the impact monitor `setInterval`. Null when monitoring is stopped. */
  private _monitorTimer: ReturnType<typeof setInterval> | null = null;

  /** Last seen total request count from Prometheus — used to compute RPS delta. */
  private _lastTotalRequests = 0;

  // ── Traffic breakdown ─────────────────────────────────────────────────────

  /**
   * Signal: top-10 endpoint breakdown sorted by request count.
   * Parsed from Prometheus `http_server_requests_seconds_count` metrics.
   */
  trafficBreakdown = signal<Array<{ uri: string; count: number; status: string }>>([]);

  /** Signal: estimated total requests per second across all endpoints. */
  totalRps = signal(0);

  // ── Chaos log ─────────────────────────────────────────────────────────────

  /**
   * Signal: timestamped log of chaos events and impact readings.
   * Shown in the terminal-style log panel below the action buttons.
   * Types: `'action'`=cyan (user-triggered), `'impact'`=orange (monitor), `'info'`=gray.
   */
  chaosLog = signal<Array<{ time: Date; message: string; type: 'action' | 'impact' | 'info' }>>([]);

  // ── Faker generator ───────────────────────────────────────────────────────

  /** Number of customers to generate in the next faker run. Bound via ngModel. */
  fakerCount = 10;

  /** Delay in milliseconds between consecutive faker create requests. Bound via ngModel. */
  fakerDelay = 100; // ms between requests

  /** Signal: true while the faker generator is running. Disables the start button. */
  fakerRunning = signal(false);

  /** Signal: number of customers created so far in the current faker run. */
  fakerProgress = signal(0);

  /**
   * Abort flag checked between faker requests.
   * Set to true by the stop button to cancel a running faker without completing it.
   */
  private _fakerAbort = false;

  readonly actions: ChaosAction[] = [
    {
      name: 'Exhaust Rate Limit',
      description: 'Send 120 rapid requests to exceed the 100 req/min bucket',
      icon: '🔥',
      color: '#dc2626',
      action: () => this.exhaustRateLimit(),
    },
    {
      name: 'Kafka Timeout',
      description: 'Request /enrich when Kafka is likely down — triggers 5s timeout + 504',
      icon: '⏱️',
      color: '#d97706',
      action: () => this.triggerKafkaTimeout(),
    },
    {
      name: 'Circuit Breaker Trip',
      description: 'Hit /bio repeatedly — if Ollama is down, circuit breaker opens',
      icon: '⚡',
      color: '#7c3aed',
      action: () => this.tripCircuitBreaker(),
    },
    {
      name: 'Invalid Payload Flood',
      description: 'Send 50 POST /customers with empty body to trigger validation errors',
      icon: '💥',
      color: '#b91c1c',
      action: () => this.invalidPayloadFlood(),
    },
    {
      name: 'Concurrent Writes',
      description: 'Create 20 customers simultaneously to test DB concurrency',
      icon: '📝',
      color: '#0369a1',
      action: () => this.concurrentWrites(),
    },
    {
      name: 'Generate Traffic',
      description: 'Mixed GET/POST traffic for N seconds to fill dashboards and traces',
      icon: '📊',
      color: '#059669',
      action: () => this.generateTraffic(),
    },
  ];

  // ── Traffic generator ─────────────────────────────────────────────────────
  trafficDuration = 15;
  trafficRunning = signal(false);
  private _trafficAbort = false;

  ngOnDestroy(): void {
    this.stopMonitoring();
    this._fakerAbort = true;
    this._trafficAbort = true;
  }

  // ── Impact monitoring ─────────────────────────────────────────────────────
  toggleMonitoring(): void {
    if (this.monitoring()) {
      this.stopMonitoring();
    } else {
      this.monitoring.set(true);
      this.impactSamples.set([]);
      this.sampleImpact();
      this._monitorTimer = setInterval(() => this.sampleImpact(), 2000);
    }
  }

  private stopMonitoring(): void {
    this.monitoring.set(false);
    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
    }
  }

  private sampleImpact(): void {
    const base = this.env.baseUrl();
    let ok = 0;
    let errors = 0;
    const timings: number[] = [];
    const count = 5;
    let done = 0;

    // Health pings
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      this.http
        .get(`${base}/actuator/health`)
        .pipe(
          catchError(() => {
            errors++;
            return of(null);
          }),
        )
        .subscribe(() => {
          if (errors === 0 || done < count - errors) ok++;
          timings.push(performance.now() - start);
          done++;
          if (done === count) {
            ok = count - errors;
            const avg = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
            this.impactSamples.update((s) => [
              ...s.slice(-29),
              {
                time: new Date(),
                ok,
                errors,
                avgMs: Math.round(avg * 10) / 10,
              },
            ]);
          }
        });
    }

    // Traffic breakdown from Prometheus
    this.http
      .get(`${base}/actuator/prometheus`, { responseType: 'text' })
      .pipe(catchError(() => of('')))
      .subscribe((text: string) => {
        if (!text) return;
        const entries: Array<{ uri: string; count: number; status: string }> = [];
        const regex =
          /http_server_requests_seconds_count\{[^}]*method="(\w+)"[^}]*status="(\d+)"[^}]*uri="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let m;
        let total = 0;
        while ((m = regex.exec(text)) !== null) {
          const count = parseFloat(m[4]);
          total += count;
          entries.push({ uri: `${m[1]} ${m[3]}`, count, status: m[2] });
        }
        entries.sort((a, b) => b.count - a.count);
        this.trafficBreakdown.set(entries.slice(0, 10));

        // RPS = delta since last sample / 2s
        const rps =
          this._lastTotalRequests > 0 ? Math.max(0, (total - this._lastTotalRequests) / 2) : 0;
        this._lastTotalRequests = total;
        this.totalRps.set(Math.round(rps * 10) / 10);
      });
  }

  impactChartBars(): Array<{ x: number; okH: number; errH: number }> {
    const s = this.impactSamples();
    if (!s.length) return [];
    const max = Math.max(1, ...s.map((x) => x.ok + x.errors));
    const barW = 300 / 30;
    return s.map((x, i) => ({
      x: i * barW,
      okH: (x.ok / max) * 80,
      errH: (x.errors / max) * 80,
    }));
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  private logAction(msg: string): void {
    this.chaosLog.update((l) => [
      { time: new Date(), message: msg, type: 'action' as const },
      ...l.slice(0, 49),
    ]);
  }

  private logImpact(msg: string): void {
    this.chaosLog.update((l) => [
      { time: new Date(), message: msg, type: 'impact' as const },
      ...l.slice(0, 49),
    ]);
  }

  private exhaustRateLimit(): void {
    this.logAction('Exhausting rate limit — sending 120 requests...');
    const base = this.env.baseUrl();
    let ok = 0;
    let limited = 0;
    let done = 0;
    const total = 120;

    for (let i = 0; i < total; i++) {
      this.http
        .get(`${base}/customers?page=0&size=1`)
        .pipe(
          catchError((e) => {
            if (e.status === 429) limited++;
            return of(null);
          }),
        )
        .subscribe(() => {
          if (limited === done) ok++;
          done++;
          if (done === total) {
            ok = total - limited;
            this.logImpact(`Rate limit result: ${ok} OK, ${limited} rate-limited (429)`);
            this.toast.show(
              `Rate limit: ${limited}/${total} blocked`,
              limited > 0 ? 'warn' : 'info',
            );
          }
        });
    }
  }

  private triggerKafkaTimeout(): void {
    this.logAction('Triggering Kafka enrich timeout (5s)...');
    const base = this.env.baseUrl();
    this.api.getFirstCustomerId().subscribe((id) => {
      const t0 = Date.now();
      this.http
        .get(`${base}/customers/${id}/enrich`)
        .pipe(catchError((e) => of({ error: true, status: e.status })))
        .subscribe((res: { error?: boolean; status?: number }) => {
          const elapsed = Date.now() - t0;
          if (res.error) {
            this.logImpact(`Kafka timeout: ${res.status} after ${elapsed} ms`);
          } else {
            this.logImpact(`Kafka responded OK in ${elapsed} ms (consumer is running)`);
          }
        });
    });
  }

  private tripCircuitBreaker(): void {
    this.logAction('Hitting /bio 10 times to trip circuit breaker...');
    const base = this.env.baseUrl();
    this.api.getFirstCustomerId().subscribe((id) => {
      let opened = 0;
      let done = 0;
      for (let i = 0; i < 10; i++) {
        this.http
          .get(`${base}/customers/${id}/bio`)
          .pipe(
            catchError((e) => {
              if (e.status === 503 || e.status === 500) opened++;
              return of(null);
            }),
          )
          .subscribe(() => {
            done++;
            if (done === 10) {
              this.logImpact(
                opened > 0
                  ? `Circuit breaker tripped: ${opened}/10 rejected`
                  : 'Circuit stayed closed — Ollama is reachable',
              );
            }
          });
      }
    }); // end getFirstCustomerId
  }

  private invalidPayloadFlood(): void {
    this.logAction('Sending 50 invalid POST requests...');
    const base = this.env.baseUrl();
    let errors = 0;
    let done = 0;
    for (let i = 0; i < 50; i++) {
      this.http
        .post(`${base}/customers`, {})
        .pipe(
          catchError(() => {
            errors++;
            return of(null);
          }),
        )
        .subscribe(() => {
          done++;
          if (done === 50) {
            this.logImpact(`Validation flood: ${errors}/50 rejected (expected)`);
          }
        });
    }
  }

  private concurrentWrites(): void {
    this.logAction('Creating 20 customers concurrently...');
    const base = this.env.baseUrl();
    let ok = 0;
    let errors = 0;
    let done = 0;
    for (let i = 0; i < 20; i++) {
      this.http
        .post(`${base}/customers`, {
          name: `Chaos-${Date.now()}-${i}`,
          email: `chaos${i}@test.com`,
        })
        .pipe(
          catchError(() => {
            errors++;
            return of(null);
          }),
        )
        .subscribe(() => {
          if (errors === done) ok++;
          done++;
          if (done === 20) {
            ok = 20 - errors;
            this.logImpact(`Concurrent writes: ${ok} created, ${errors} failed`);
            this.activity.log('customer-create', `Chaos: created ${ok} customers concurrently`);
          }
        });
    }
  }

  async generateTraffic(): Promise<void> {
    this.trafficRunning.set(true);
    this._trafficAbort = false;
    this.logAction(`Generating mixed traffic for ${this.trafficDuration}s...`);
    const base = this.env.baseUrl();
    let total = 0;

    const endpoints = [
      () => this.http.get(`${base}/customers?page=0&size=5`),
      () => this.http.get(`${base}/customers/summary?page=0&size=5`),
      () => this.http.get(`${base}/actuator/health`),
      () => this.http.get(`${base}/customers/recent`),
      () =>
        this.http.post(`${base}/customers`, {
          name: `Traffic-${Date.now()}`,
          email: `t${Date.now()}@test.com`,
        }),
    ];

    for (let sec = 0; sec < this.trafficDuration && !this._trafficAbort; sec++) {
      const batch = Array.from({ length: 5 }, () => {
        const fn = endpoints[Math.floor(Math.random() * endpoints.length)];
        return fn()
          .pipe(catchError(() => of(null)))
          .toPromise();
      });
      await Promise.all(batch);
      total += 5;
      await new Promise((r) => setTimeout(r, 200));
    }

    this.trafficRunning.set(false);
    this.logImpact(`Traffic generation done: ~${total} requests in ${this.trafficDuration}s`);
    this.toast.show(`Generated ~${total} requests`, 'success');
  }

  stopTraffic(): void {
    this._trafficAbort = true;
  }

  // ── Faker ─────────────────────────────────────────────────────────────────
  private readonly firstNames = [
    'Alice',
    'Bob',
    'Charlie',
    'Diana',
    'Eve',
    'Frank',
    'Grace',
    'Hugo',
    'Iris',
    'Jack',
    'Kate',
    'Leo',
    'Mia',
    'Noah',
    'Olivia',
    'Paul',
    'Quinn',
    'Rose',
    'Sam',
    'Tina',
  ];
  private readonly lastNames = [
    'Martin',
    'Bernard',
    'Dubois',
    'Thomas',
    'Robert',
    'Richard',
    'Petit',
    'Durand',
    'Leroy',
    'Moreau',
    'Simon',
    'Laurent',
    'Lefebvre',
    'Michel',
    'Garcia',
  ];
  private readonly domains = ['example.com', 'test.io', 'demo.org', 'mail.dev', 'corp.net'];

  private fakeName(): string {
    const f = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const l = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    return `${f} ${l}`;
  }

  private fakeEmail(name: string): string {
    const d = this.domains[Math.floor(Math.random() * this.domains.length)];
    return `${name.toLowerCase().replace(' ', '.')}.${Date.now() % 1000}@${d}`;
  }

  async runFaker(): Promise<void> {
    this.fakerRunning.set(true);
    this._fakerAbort = false;
    this.fakerProgress.set(0);
    this.logAction(`Generating ${this.fakerCount} fake customers...`);

    const base = this.env.baseUrl();
    let ok = 0;
    let errors = 0;

    for (let i = 0; i < this.fakerCount && !this._fakerAbort; i++) {
      const name = this.fakeName();
      const email = this.fakeEmail(name);
      try {
        await this.http.post(`${base}/customers`, { name, email }).toPromise();
        ok++;
      } catch {
        errors++;
      }
      this.fakerProgress.set(i + 1);
      if (this.fakerDelay > 0) await new Promise((r) => setTimeout(r, this.fakerDelay));
    }

    this.fakerRunning.set(false);
    this.logImpact(`Faker done: ${ok} created, ${errors} failed`);
    this.toast.show(`Generated ${ok} customers`, 'success');
    this.activity.log('customer-create', `Faker: generated ${ok} customers`);
  }

  stopFaker(): void {
    this._fakerAbort = true;
  }
}
