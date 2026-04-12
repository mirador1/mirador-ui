import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

interface LogLine {
  kind: 'req' | 'res' | 'err' | 'info';
  text: string;
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

@Component({
  selector: 'app-diagnostic',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './diagnostic.component.html',
  styleUrl: './diagnostic.component.scss'
})
export class DiagnosticComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  // ── 1. API Versioning ──────────────────────────────────────────────────────
  versionLog = signal<LogLine[]>([]);
  versionRunning = signal(false);

  runVersionComparison(): void {
    this.versionRunning.set(true);
    this.versionLog.set([{ kind: 'info', text: 'Fetching v1 and v2 side by side…' }]);

    forkJoin({
      v1: this.api.getCustomers(0, 3, '1.0').pipe(catchError(e => of({ error: e.status }))),
      v2: this.api.getCustomers(0, 3, '2.0').pipe(catchError(e => of({ error: e.status })))
    }).subscribe(({ v1, v2 }) => {
      this.versionLog.update(l => [
        ...l,
        { kind: 'req', text: `[${ts()}] GET /customers  X-API-Version: 1.0` },
        { kind: 'res', text: `v1 content[0]: ${JSON.stringify((v1 as any).content?.[0])}` },
        { kind: 'req', text: `[${ts()}] GET /customers  X-API-Version: 2.0` },
        { kind: 'res', text: `v2 content[0]: ${JSON.stringify((v2 as any).content?.[0])}` },
        { kind: 'info', text: 'v2 adds "createdAt" field — controlled by X-API-Version header.' }
      ]);
      this.versionRunning.set(false);
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
    const key = this.idemKey();
    const payload = { name: this.idemName, email: this.idemEmail };
    this.idemLog.set([
      { kind: 'info', text: `Idempotency-Key: ${key}` },
      { kind: 'req', text: `[${ts()}] POST /customers  (request 1)` }
    ]);

    this.api.createCustomer(payload, key).subscribe({
      next: r1 => {
        this.idemLog.update(l => [
          ...l,
          { kind: 'res', text: `201 → id=${r1.id}  name=${r1.name}` },
          { kind: 'req', text: `[${ts()}] POST /customers  (request 2 — same key)` }
        ]);
        this.api.createCustomer(payload, key).subscribe({
          next: r2 => {
            const match = r1.id === r2.id;
            this.idemLog.update(l => [
              ...l,
              { kind: 'res', text: `${match ? '200' : '201'} → id=${r2.id}  name=${r2.name}` },
              {
                kind: match ? 'info' : 'err',
                text: match
                  ? '✓ Same ID returned — idempotency cache hit, no duplicate created.'
                  : '⚠ Different ID — idempotency did not fire (key may have expired).'
              }
            ]);
            this.idemRunning.set(false);
          },
          error: e => {
            this.idemLog.update(l => [...l, { kind: 'err', text: `Error ${e.status}` }]);
            this.idemRunning.set(false);
          }
        });
      },
      error: e => {
        this.idemLog.update(l => [
          ...l,
          { kind: 'err', text: `Error ${e.status}: ${e.error?.detail ?? e.message}` }
        ]);
        this.idemRunning.set(false);
      }
    });
  }

  // ── 3. Rate Limiting ───────────────────────────────────────────────────────
  rateLimitLog = signal<LogLine[]>([]);
  rateLimitRunning = signal(false);
  rateLimitCount = 6;

  runRateLimit(): void {
    this.rateLimitRunning.set(true);
    this.rateLimitLog.set([{ kind: 'info', text: `Firing ${this.rateLimitCount} concurrent GET /customers requests…` }]);

    const requests = Array.from({ length: this.rateLimitCount }, (_, i) =>
      this.api.getCustomers(0, 1).pipe(
        catchError(e => of({ __error: e.status as number, index: i }))
      )
    );

    forkJoin(requests).subscribe(results => {
      const lines: LogLine[] = results.map((r, i) => {
        const err = (r as any).__error;
        if (err === 429) {
          return { kind: 'err' as const, text: `Request ${i + 1}: 429 Too Many Requests — rate limit hit` };
        }
        return { kind: 'res' as const, text: `Request ${i + 1}: 200 OK` };
      });

      const hits = lines.filter(l => l.kind === 'err').length;
      lines.push({
        kind: hits > 0 ? 'info' : 'info',
        text: hits > 0
          ? `✓ ${hits}/${this.rateLimitCount} requests rate-limited. Limit: 100 req/min per IP.`
          : `All ${this.rateLimitCount} requests succeeded — rate limit (100/min) not reached in this burst.`
      });

      this.rateLimitLog.update(l => [...l, ...lines]);
      this.rateLimitRunning.set(false);
    });
  }

  // ── 4. Kafka Enrich ────────────────────────────────────────────────────────
  enrichCustomerId = signal(1);
  enrichLog = signal<LogLine[]>([]);
  enrichRunning = signal(false);

  runEnrich(): void {
    const id = this.enrichCustomerId();
    this.enrichRunning.set(true);
    this.enrichLog.set([
      { kind: 'req', text: `[${ts()}] GET /customers/${id}/enrich` },
      { kind: 'info', text: 'Backend publishes to customer.request, awaits reply on customer.reply (5 s timeout)…' }
    ]);

    const t0 = Date.now();
    this.api.enrichCustomer(id).subscribe({
      next: r => {
        const elapsed = Date.now() - t0;
        this.enrichLog.update(l => [
          ...l,
          { kind: 'res', text: `200 in ${elapsed} ms → displayName: "${r.displayName}"` },
          { kind: 'res', text: JSON.stringify(r, null, 2) }
        ]);
        this.enrichRunning.set(false);
      },
      error: e => {
        const elapsed = Date.now() - t0;
        this.enrichLog.update(l => [
          ...l,
          {
            kind: 'err',
            text: e.status === 504
              ? `504 after ${elapsed} ms — Kafka reply timed out (consumer not running?)`
              : `${e.status} after ${elapsed} ms`
          }
        ]);
        this.enrichRunning.set(false);
      }
    });
  }

  // ── 5. Aggregate (Virtual Threads) ─────────────────────────────────────────
  aggregateLog = signal<LogLine[]>([]);
  aggregateRunning = signal(false);

  runAggregate(): void {
    this.aggregateRunning.set(true);
    this.aggregateLog.set([
      { kind: 'req', text: `[${ts()}] GET /customers/aggregate` },
      { kind: 'info', text: 'Backend spawns two virtual threads in parallel: customer list + stats…' }
    ]);

    const t0 = Date.now();
    this.api.getAggregate().subscribe({
      next: r => {
        const elapsed = Date.now() - t0;
        this.aggregateLog.update(l => [
          ...l,
          { kind: 'res', text: `200 in ${elapsed} ms` },
          { kind: 'res', text: JSON.stringify(r, null, 2) }
        ]);
        this.aggregateRunning.set(false);
      },
      error: e => {
        this.aggregateLog.update(l => [
          ...l,
          { kind: 'err', text: `${e.status}: ${e.message}` }
        ]);
        this.aggregateRunning.set(false);
      }
    });
  }
}
