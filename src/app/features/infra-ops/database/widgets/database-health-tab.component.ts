/**
 * DatabaseHealthTabComponent — health checks grid + maintenance actions.
 *
 * Fully self-contained :
 * - owns healthResults + healthRunning signals
 * - owns vacuumRunning / vacuumResult / vacuumError signals
 * - injects HttpClient + EnvService + DestroyRef directly
 *
 * Cross-widget dependency : the "See raw data" button on each health
 * card forwards the check's SQL query to the SQL Explorer widget.
 * That's done via the `rawDataRequested` output — parent catches it
 * and pipes the query into the SQL Explorer's signal, avoiding a
 * shared DatabaseStateService (single-emit event is lighter than a
 * new injected service for this one hop).
 *
 * Extracted from database.component.html per Phase B-7-7, 2026-04-24.
 */
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../../../../core/env/env.service';
import type { HealthCheck, SqlQueryResult, MaintenanceResult } from '../database-types';

type HealthStatus = 'ok' | 'warn' | 'crit' | 'loading' | 'error';

interface HealthResult {
  check: HealthCheck;
  status: HealthStatus;
  detail: string;
  rows: string[][];
}

@Component({
  selector: 'app-database-health-tab',
  standalone: true,
  styleUrl: '../database.component.scss',
  template: `
    <div class="presets-area health-area">
      <div class="health-intro">
        <p class="health-desc">
          Run 8 diagnostic checks in parallel — cache ratio, bloat, locks, idle transactions, long
          queries, duplicate emails, seq scan patterns, unused indexes.
        </p>
        <button class="magic-btn" (click)="runHealthChecks()" [disabled]="healthRunning()">
          @if (healthRunning()) {
            <span class="magic-spin">⟳</span> Running checks…
          } @else {
            🪄 Run Diagnostic
          }
        </button>
      </div>

      @if (healthResults().length > 0) {
        <div class="health-grid">
          @for (r of healthResults(); track r.check.id) {
            <div class="health-card" [class]="'hc-' + r.status">
              <div class="hc-header">
                <span class="hc-icon">
                  @switch (r.status) {
                    @case ('ok') {
                      ✅
                    }
                    @case ('warn') {
                      ⚠️
                    }
                    @case ('crit') {
                      ❌
                    }
                    @case ('loading') {
                      ⟳
                    }
                    @case ('error') {
                      🔌
                    }
                  }
                </span>
                <span class="hc-label">{{ r.check.label }}</span>
              </div>
              <p class="hc-desc">{{ r.check.description }}</p>
              <p class="hc-detail">{{ r.detail }}</p>
              @if (r.status !== 'loading' && r.status !== 'error') {
                <button class="hc-query-btn" (click)="rawDataRequested.emit(r.check.query)">
                  ▶ See raw data
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Maintenance actions — VACUUM via /actuator/maintenance (pgweb is read-only) -->
      <div class="maintenance-area">
        <div class="maintenance-header">
          <span class="maintenance-title">🧹 Maintenance</span>
          <span class="maintenance-hint"
            >Requires Spring Boot running — uses <code>/actuator/maintenance</code></span
          >
        </div>
        <div class="maintenance-btns">
          <button
            class="maint-btn"
            (click)="runVacuum('vacuum')"
            [disabled]="vacuumRunning()"
            title="VACUUM ANALYZE — reclaims dead tuples for reuse and refreshes planner stats. Fast, safe at any time."
          >
            🧹 VACUUM ANALYZE
          </button>
          <button
            class="maint-btn maint-btn-warn"
            (click)="runVacuum('vacuumFull')"
            [disabled]="vacuumRunning()"
            title="VACUUM FULL ANALYZE — physically compacts the table, shrinks file on disk. Requires exclusive lock, slower than regular VACUUM."
          >
            🗜️ VACUUM FULL
          </button>
          <button
            class="maint-btn"
            (click)="runVacuum('vacuumVerbose')"
            [disabled]="vacuumRunning()"
            title="VACUUM VERBOSE ANALYZE — same as VACUUM ANALYZE but logs detailed output to Spring Boot logs."
          >
            📋 VACUUM VERBOSE
          </button>
        </div>
        @if (vacuumRunning()) {
          <p class="maint-status maint-running">⟳ Running…</p>
        }
        @if (vacuumResult()) {
          <p class="maint-status maint-ok">
            ✅ {{ vacuumResult()!.operation }} completed in {{ vacuumResult()!.durationMs }} ms
          </p>
        }
        @if (vacuumError()) {
          <p class="maint-status maint-err">❌ {{ vacuumError() }}</p>
        }
      </div>
    </div>
  `,
})
export class DatabaseHealthTabComponent {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly destroyRef = inject(DestroyRef);

  /** Parent passes the health-check definitions (data-only). */
  readonly healthChecks = input.required<HealthCheck[]>();

  /** Emitted when user clicks "See raw data" on a health card. Parent pipes
   *  the query into the SQL Explorer widget (single-hop event drilling). */
  readonly rawDataRequested = output<string>();

  readonly healthResults = signal<HealthResult[]>([]);
  readonly healthRunning = signal(false);
  readonly vacuumRunning = signal(false);
  readonly vacuumResult = signal<MaintenanceResult | null>(null);
  readonly vacuumError = signal('');

  runHealthChecks(): void {
    this.healthRunning.set(true);
    this.healthResults.set(
      this.healthChecks().map((c) => ({
        check: c,
        status: 'loading' as HealthStatus,
        detail: '…',
        rows: [],
      })),
    );
    let done = 0;
    const pgweb = this.env.pgwebUrl();
    if (!pgweb) {
      // Belt-and-braces: the template already gates the "Run Diagnostic" button on
      // `@if (env.pgwebUrl())`, but keep a runtime check so a future code path
      // that forgets the template guard cannot silently 404.
      this.healthRunning.set(false);
      return;
    }
    for (const check of this.healthChecks()) {
      this.http
        .get<SqlQueryResult>(`${pgweb}/api/query`, { params: { query: check.query } })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const rows: string[][] = (res.rows ?? []).map((r) =>
              (r as unknown[]).map((c) => String(c ?? '')),
            );
            const evaluation = check.evaluate(rows);
            this.healthResults.update((prev) =>
              prev.map((r) => (r.check.id === check.id ? { ...r, ...evaluation, rows } : r)),
            );
            if (++done === this.healthChecks().length) this.healthRunning.set(false);
          },
          error: () => {
            this.healthResults.update((prev) =>
              prev.map((r) =>
                r.check.id === check.id
                  ? { ...r, status: 'error' as const, detail: 'pgweb unreachable' }
                  : r,
              ),
            );
            if (++done === this.healthChecks().length) this.healthRunning.set(false);
          },
        });
    }
  }

  runVacuum(operation: 'vacuum' | 'vacuumFull' | 'vacuumVerbose'): void {
    this.vacuumRunning.set(true);
    this.vacuumResult.set(null);
    this.vacuumError.set('');
    this.http
      .post<MaintenanceResult>(`${this.env.baseUrl()}/actuator/maintenance`, { operation })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.vacuumResult.set(r);
          this.vacuumRunning.set(false);
        },
        error: (e) => {
          this.vacuumError.set(
            e.error?.message ??
              `Maintenance endpoint unreachable (${e.status || 'check Spring Boot'})`,
          );
          this.vacuumRunning.set(false);
        },
      });
  }
}
