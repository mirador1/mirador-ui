/**
 * DiagnosticComponent — Interactive test scenarios with terminal-style output.
 *
 * Seven scenarios that exercise backend features and display results as
 * color-coded log lines (req=blue, res=green, err=red, info=gray):
 *
 * 1. API Versioning — Side-by-side v1 vs v2 response comparison
 * 2. Idempotency — Same key sent twice, verifies cached response
 * 3. Rate Limiting — Burst N concurrent requests, observe 429s
 * 4. Kafka Enrich — Request-reply timing, 504 on timeout
 * 5. Virtual Threads — Parallel task execution via /customers/aggregate
 * 6. Version Diff — Colored JSON diff between v1 and v2 responses
 * 7. Stress Test — Sustained load with live SVG chart of throughput + errors
 *
 * "Run All" executes scenarios 1-5 sequentially (polls `running` signal).
 * History is kept in-memory (last 50 runs) and exportable as JSON.
 */
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { forkJoin, catchError, of } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { EnvService } from '../../../core/env/env.service';

/**
 * A ShedLock scheduled job entry from `GET /scheduled/jobs`.
 * Shows which jobs are currently locked (i.e., running on another node).
 */
import type {
  ScheduledJob,
  WaterfallEntry,
  SankeyFlow,
  DiffLine,
  StressSample,
  LogLine,
  RunRecord,
} from './diagnostic-types';
import { DiagnosticScenarioComponent } from './widgets/diagnostic-scenario.component';

/**
 * Format the current time as `HH:MM:SS.mmm` for use as a log line timestamp prefix.
 * Kept in this file (not extracted to diagnostic-types) because it's a
 * runtime helper, not a type.
 */
function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

@Component({
  selector: 'app-diagnostic',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, DiagnosticScenarioComponent],
  templateUrl: './diagnostic.component.html',
  styleUrl: './diagnostic.component.scss',
})
export class DiagnosticComponent {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  private readonly env = inject(EnvService);

  /**
   * DestroyRef used by `takeUntilDestroyed()` on every HTTP subscribe to
   * stop the post-destroy `signal.set()` callback (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);
  readonly Math = Math;

  // ── Run history ────────────────────────────────────────────────────────────
  runHistory = signal<RunRecord[]>([]);
  showHistory = signal(false);
  runAllRunning = signal(false);

  // ── 1. API Versioning ──────────────────────────────────────────────────────
  versionLog = signal<LogLine[]>([]);
  versionRunning = signal(false);

  runVersionComparison(): void {
    this.versionRunning.set(true);
    const t0 = Date.now();
    this.versionLog.set([{ kind: 'info', text: 'Fetching v1 and v2 side by side...' }]);

    forkJoin({
      v1: this.api.getCustomers(0, 3, '1.0').pipe(catchError((e) => of({ error: e.status }))),
      v2: this.api.getCustomers(0, 3, '2.0').pipe(
        catchError((e) => of({ error: e.status })),
        takeUntilDestroyed(this.destroyRef),
      ),
    }).subscribe(({ v1, v2 }) => {
      const logs: LogLine[] = [
        ...this.versionLog(),
        { kind: 'req', text: `[${ts()}] GET /customers  X-API-Version: 1.0` },
        {
          kind: 'res',
          text: `v1 content[0]: ${JSON.stringify((v1 as { content?: unknown[] }).content?.[0])}`,
        },
        { kind: 'req', text: `[${ts()}] GET /customers  X-API-Version: 2.0` },
        {
          kind: 'res',
          text: `v2 content[0]: ${JSON.stringify((v2 as { content?: unknown[] }).content?.[0])}`,
        },
        { kind: 'info', text: 'v2 adds "createdAt" field — controlled by X-API-Version header.' },
      ];
      this.versionLog.set(logs);
      this.versionRunning.set(false);
      this.recordRun('API Versioning', logs, Date.now() - t0);
    });
  }

  // ── 2. Idempotency ─────────────────────────────────────────────────────────
  idemKey = signal(crypto.randomUUID());
  idemName = 'Test-Idem';
  idemEmail = `test-${Date.now()}@example.com`;
  idemLog = signal<LogLine[]>([]);
  idemRunning = signal(false);

  resetIdemKey(): void {
    this.idemKey.set(crypto.randomUUID());
    this.idemEmail = `test-${Date.now()}@example.com`;
    this.idemLog.set([]);
  }

  runIdempotency(): void {
    this.idemRunning.set(true);
    const t0 = Date.now();
    const key = this.idemKey();
    const payload = { name: this.idemName, email: this.idemEmail };
    this.idemLog.set([
      { kind: 'info', text: `Idempotency-Key: ${key}` },
      { kind: 'req', text: `[${ts()}] POST /customers  (request 1)` },
    ]);

    this.api
      .createCustomer(payload, key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r1) => {
          this.idemLog.update((l) => [
            ...l,
            { kind: 'res', text: `201 → id=${r1.id}  name=${r1.name}` },
            { kind: 'req', text: `[${ts()}] POST /customers  (request 2 — same key)` },
          ]);
          this.api
            .createCustomer(payload, key)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (r2) => {
                const match = r1.id === r2.id;
                const logs: LogLine[] = [
                  ...this.idemLog(),
                  { kind: 'res', text: `${match ? '200' : '201'} → id=${r2.id}  name=${r2.name}` },
                  {
                    kind: match ? 'info' : 'err',
                    text: match
                      ? '✓ Same ID returned — idempotency cache hit, no duplicate created.'
                      : '⚠ Different ID — idempotency did not fire (key may have expired).',
                  },
                ];
                this.idemLog.set(logs);
                this.idemRunning.set(false);
                this.recordRun('Idempotency', logs, Date.now() - t0);
              },
              error: (e) => {
                const logs = [
                  ...this.idemLog(),
                  { kind: 'err' as const, text: `Error ${e.status}` },
                ];
                this.idemLog.set(logs);
                this.idemRunning.set(false);
                this.recordRun('Idempotency', logs, Date.now() - t0);
              },
            });
        },
        error: (e) => {
          const logs = [
            ...this.idemLog(),
            { kind: 'err' as const, text: `Error ${e.status}: ${e.error?.detail ?? e.message}` },
          ];
          this.idemLog.set(logs);
          this.idemRunning.set(false);
          this.recordRun('Idempotency', logs, Date.now() - t0);
        },
      });
  }

  // ── 3. Rate Limiting ───────────────────────────────────────────────────────
  rateLimitLog = signal<LogLine[]>([]);
  rateLimitRunning = signal(false);
  rateLimitCount = 6;

  runRateLimit(): void {
    this.rateLimitRunning.set(true);
    const t0 = Date.now();
    this.rateLimitLog.set([
      { kind: 'info', text: `Firing ${this.rateLimitCount} concurrent GET /customers requests...` },
    ]);

    const requests = Array.from({ length: this.rateLimitCount }, (_, i) =>
      this.api.getCustomers(0, 1).pipe(
        catchError((e) => of({ __error: e.status as number, index: i })),
        takeUntilDestroyed(this.destroyRef),
      ),
    );

    forkJoin(requests).subscribe((results) => {
      const lines: LogLine[] = results.map((r, i) => {
        const err = (r as { __error?: number }).__error;
        if (err === 429) {
          return {
            kind: 'err' as const,
            text: `Request ${i + 1}: 429 Too Many Requests — rate limit hit`,
          };
        }
        return { kind: 'res' as const, text: `Request ${i + 1}: 200 OK` };
      });

      const hits = lines.filter((l) => l.kind === 'err').length;
      lines.push({
        kind: 'info',
        text:
          hits > 0
            ? `✓ ${hits}/${this.rateLimitCount} requests rate-limited. Limit: 100 req/min per IP.`
            : `All ${this.rateLimitCount} requests succeeded — rate limit (100/min) not reached in this burst.`,
      });

      const logs = [...this.rateLimitLog(), ...lines];
      this.rateLimitLog.set(logs);
      this.rateLimitRunning.set(false);
      this.recordRun('Rate Limiting', logs, Date.now() - t0);
    });
  }

  // ── 4. Kafka Enrich ────────────────────────────────────────────────────────
  enrichCustomerId = signal(1);
  enrichLog = signal<LogLine[]>([]);
  enrichRunning = signal(false);

  runEnrich(): void {
    const id = this.enrichCustomerId();
    this.enrichRunning.set(true);
    const t0 = Date.now();
    this.enrichLog.set([
      { kind: 'req', text: `[${ts()}] GET /customers/${id}/enrich` },
      {
        kind: 'info',
        text: 'Backend publishes to customer.request, awaits reply on customer.reply (5 s timeout)...',
      },
    ]);

    this.api
      .enrichCustomer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const elapsed = Date.now() - t0;
          const logs: LogLine[] = [
            ...this.enrichLog(),
            { kind: 'res', text: `200 in ${elapsed} ms → displayName: "${r.displayName}"` },
            { kind: 'res', text: JSON.stringify(r, null, 2) },
          ];
          this.enrichLog.set(logs);
          this.enrichRunning.set(false);
          this.recordRun('Kafka Enrich', logs, elapsed);
        },
        error: (e) => {
          const elapsed = Date.now() - t0;
          const logs: LogLine[] = [
            ...this.enrichLog(),
            {
              kind: 'err',
              text:
                e.status === 504
                  ? `504 after ${elapsed} ms — Kafka reply timed out (consumer not running?)`
                  : `${e.status} after ${elapsed} ms`,
            },
          ];
          this.enrichLog.set(logs);
          this.enrichRunning.set(false);
          this.recordRun('Kafka Enrich', logs, elapsed);
        },
      });
  }

  // ── 5. Aggregate (Virtual Threads) ─────────────────────────────────────────
  aggregateLog = signal<LogLine[]>([]);
  aggregateRunning = signal(false);

  runAggregate(): void {
    this.aggregateRunning.set(true);
    const t0 = Date.now();
    this.aggregateLog.set([
      { kind: 'req', text: `[${ts()}] GET /customers/aggregate` },
      {
        kind: 'info',
        text: 'Backend spawns two virtual threads in parallel: customer list + stats...',
      },
    ]);

    this.api
      .getAggregate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const elapsed = Date.now() - t0;
          const logs: LogLine[] = [
            ...this.aggregateLog(),
            { kind: 'res', text: `200 in ${elapsed} ms` },
            { kind: 'res', text: JSON.stringify(r, null, 2) },
          ];
          this.aggregateLog.set(logs);
          this.aggregateRunning.set(false);
          this.recordRun('Virtual Threads', logs, elapsed);
        },
        error: (e) => {
          const logs: LogLine[] = [
            ...this.aggregateLog(),
            { kind: 'err', text: `${e.status}: ${e.message}` },
          ];
          this.aggregateLog.set(logs);
          this.aggregateRunning.set(false);
          this.recordRun('Virtual Threads', logs, Date.now() - t0);
        },
      });
  }

  // ── 6. Version Diff ────────────────────────────────────────────────────────
  versionDiff = signal<DiffLine[]>([]);

  private computeDiff(v1: unknown, v2: unknown): void {
    const lines1 = JSON.stringify(v1, null, 2).split('\n');
    const lines2 = JSON.stringify(v2, null, 2).split('\n');
    const diff: DiffLine[] = [];
    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
      const l1 = lines1[i] ?? '';
      const l2 = lines2[i] ?? '';
      if (l1 === l2) {
        diff.push({ type: 'same', text: l1 });
      } else {
        if (l1) diff.push({ type: 'remove', text: l1 });
        if (l2) diff.push({ type: 'add', text: l2 });
      }
    }
    this.versionDiff.set(diff);
  }

  runVersionDiff(): void {
    this.versionRunning.set(true);
    this.versionDiff.set([]);
    forkJoin({
      v1: this.api.getCustomers(0, 1, '1.0').pipe(catchError((e) => of({ error: e.status }))),
      v2: this.api.getCustomers(0, 1, '2.0').pipe(
        catchError((e) => of({ error: e.status })),
        takeUntilDestroyed(this.destroyRef),
      ),
    }).subscribe(({ v1, v2 }) => {
      const c1 = (v1 as { content?: unknown[] }).content?.[0] ?? v1;
      const c2 = (v2 as { content?: unknown[] }).content?.[0] ?? v2;
      this.computeDiff(c1, c2);
      this.versionRunning.set(false);
    });
  }

  // ── 7. Stress Test ────────────────────────────────────────────────────────
  stressLog = signal<LogLine[]>([]);
  stressSamples = signal<StressSample[]>([]);
  stressRunning = signal(false);
  stressDuration = 10; // seconds
  stressConcurrency = 5;
  stressEndpoint = '/customers?page=0&size=1';
  private _stressAbort = false;

  async runStressTest(): Promise<void> {
    this.stressRunning.set(true);
    this._stressAbort = false;
    this.stressSamples.set([]);
    this.stressLog.set([
      {
        kind: 'info',
        text: `Stress test: ${this.stressConcurrency} concurrent, ${this.stressDuration}s, endpoint: ${this.stressEndpoint}`,
      },
    ]);

    const baseUrl = this.env.baseUrl();
    const endpoint = this.stressEndpoint;
    let totalOk = 0;
    let totalErr = 0;

    for (let sec = 0; sec < this.stressDuration && !this._stressAbort; sec++) {
      const t0 = Date.now();
      let secOk = 0;
      let secErr = 0;

      const batch = Array.from({ length: this.stressConcurrency }, () =>
        this.http
          .get(`${baseUrl}${endpoint}`)
          .pipe(
            catchError(() => {
              secErr++;
              return of(null);
            }),
          )
          .toPromise()
          .then(() => {
            if (secErr === 0) secOk++;
          }),
      );

      await Promise.all(batch);
      // Correct count: secOk was only incremented when no error
      secOk = this.stressConcurrency - secErr;
      totalOk += secOk;
      totalErr += secErr;

      this.stressSamples.update((s) => [...s, { second: sec + 1, ok: secOk, err: secErr }]);
      this.stressLog.update((l) => [
        ...l,
        {
          kind: secErr > 0 ? ('err' as const) : ('res' as const),
          text: `[${sec + 1}s] ${secOk} OK / ${secErr} errors`,
        },
      ]);

      // Wait remainder of the second
      const elapsed = Date.now() - t0;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    }

    this.stressLog.update((l) => [
      ...l,
      {
        kind: 'info',
        text: `Done: ${totalOk + totalErr} requests (${totalOk} OK, ${totalErr} errors) over ${this.stressDuration}s`,
      },
    ]);
    this.stressRunning.set(false);
    this.recordRun('Stress Test', this.stressLog(), this.stressDuration * 1000);
    this.activity.log(
      'diagnostic-run',
      `Stress test: ${totalOk + totalErr} requests in ${this.stressDuration}s`,
    );
  }

  stopStressTest(): void {
    this._stressAbort = true;
  }

  stressChartBars(): { x: number; okH: number; errH: number }[] {
    const samples = this.stressSamples();
    if (!samples.length) return [];
    const max = Math.max(1, ...samples.map((s) => s.ok + s.err));
    const barW = 300 / Math.max(samples.length, 1);
    return samples.map((s, i) => ({
      x: i * barW,
      okH: (s.ok / max) * 80,
      errH: (s.err / max) * 80,
    }));
  }

  // ── Run All ───────────────────────────────────────────────────────────────
  async runAll(): Promise<void> {
    this.runAllRunning.set(true);
    this.toast.show('Running all 5 diagnostic scenarios...', 'info');

    // Run sequentially to avoid interference
    await this.runScenarioAsync(() => this.runVersionComparison(), this.versionRunning);
    await this.runScenarioAsync(() => this.runIdempotency(), this.idemRunning);
    await this.runScenarioAsync(() => this.runRateLimit(), this.rateLimitRunning);
    await this.runScenarioAsync(() => this.runEnrich(), this.enrichRunning);
    await this.runScenarioAsync(() => this.runAggregate(), this.aggregateRunning);

    this.runAllRunning.set(false);
    this.toast.show('All 5 scenarios completed!', 'success');
  }

  private runScenarioAsync(
    fn: () => void,
    running: ReturnType<typeof signal<boolean>>,
  ): Promise<void> {
    return new Promise((resolve) => {
      fn();
      const check = setInterval(() => {
        if (!running()) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  // ── History ───────────────────────────────────────────────────────────────
  private recordRun(scenario: string, logs: LogLine[], durationMs: number): void {
    this.runHistory.update((h) => [
      { scenario, timestamp: new Date(), logs, durationMs },
      ...h.slice(0, 49),
    ]);
    this.activity.log('diagnostic-run', `${scenario} completed in ${durationMs} ms`);
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  clearHistory(): void {
    this.runHistory.set([]);
  }

  exportHistory(): void {
    const data = this.runHistory().map((r) => ({
      scenario: r.scenario,
      timestamp: r.timestamp.toISOString(),
      durationMs: r.durationMs,
      logs: r.logs,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-runs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Scheduled Jobs ─────────────────────────────────────────────────────────
  scheduledJobs = signal<ScheduledJob[]>([]);
  scheduledJobsLoading = signal(false);
  scheduledJobsError = signal('');

  loadScheduledJobs(): void {
    this.scheduledJobsLoading.set(true);
    this.scheduledJobsError.set('');
    const base = this.env.baseUrl();
    const token = this.auth.token();
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    this.http
      .get<ScheduledJob[]>(`${base}/scheduled/jobs`, { headers })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  isJobActive(job: ScheduledJob): boolean {
    if (!job.lockUntil) return false;
    return new Date(job.lockUntil) > new Date();
  }

  // ── Waterfall ─────────────────────────────────────────────────────────────
  waterfallEntries = signal<WaterfallEntry[]>([]);
  waterfallRunning = signal(false);

  async runWaterfall(): Promise<void> {
    this.waterfallRunning.set(true);
    this.waterfallEntries.set([]);
    const base = this.env.baseUrl();
    const endpoints = [
      { method: 'GET', uri: '/actuator/health' },
      { method: 'GET', uri: '/customers?page=0&size=5' },
      { method: 'GET', uri: '/customers/summary?page=0&size=5' },
      { method: 'GET', uri: '/customers/recent' },
      { method: 'GET', uri: '/actuator/info' },
      { method: 'GET', uri: '/customers/aggregate' },
    ];
    const globalStart = performance.now();

    const promises = endpoints.map(async (ep) => {
      const start = performance.now() - globalStart;
      try {
        const t0 = performance.now();
        await this.http.get(`${base}${ep.uri}`).toPromise();
        return {
          method: ep.method,
          uri: ep.uri,
          status: 200,
          startMs: start,
          durationMs: performance.now() - t0,
        };
      } catch (e) {
        return {
          method: ep.method,
          uri: ep.uri,
          status: (e as { status?: number })?.status ?? 0,
          startMs: start,
          durationMs: performance.now() - globalStart - start,
        };
      }
    });

    const results = await Promise.all(promises);
    this.waterfallEntries.set(results);
    this.waterfallRunning.set(false);
  }

  waterfallMaxMs(): number {
    const entries = this.waterfallEntries();
    return Math.max(1, ...entries.map((e) => e.startMs + e.durationMs));
  }

  // ── Sankey ────────────────────────────────────────────────────────────────
  sankeyFlows = signal<SankeyFlow[]>([]);

  fetchSankeyData(): void {
    this.http
      .get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (text) => {
          const flows: SankeyFlow[] = [];
          const regex =
            /http_server_requests_seconds_count\{[^}]*method="(\w+)"[^}]*status="(\d+)"[^}]*uri="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
          let m;
          const byEndpoint: Record<string, Record<string, number>> = {};
          while ((m = regex.exec(text)) !== null) {
            const uri = m[3];
            const status = m[2][0] + 'xx';
            const count = parseFloat(m[4]);
            if (!byEndpoint[uri]) byEndpoint[uri] = {};
            byEndpoint[uri][status] = (byEndpoint[uri][status] || 0) + count;
          }
          const colors: Record<string, string> = {
            '2xx': '#4ade80',
            '3xx': '#60a5fa',
            '4xx': '#fbbf24',
            '5xx': '#f87171',
          };
          for (const [uri, statuses] of Object.entries(byEndpoint)) {
            for (const [status, count] of Object.entries(statuses)) {
              if (count > 0) {
                flows.push({
                  from: uri.length > 25 ? uri.slice(0, 25) + '...' : uri,
                  to: status,
                  value: count,
                  color: colors[status] || '#94a3b8',
                });
              }
            }
          }
          flows.sort((a, b) => b.value - a.value);
          this.sankeyFlows.set(flows.slice(0, 20));
        },
      });
  }

  sankeyMaxValue(): number {
    return Math.max(1, ...this.sankeyFlows().map((f) => f.value));
  }
}
