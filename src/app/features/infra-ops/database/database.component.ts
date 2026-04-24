/**
 * DatabaseComponent — PostgreSQL explorer via pgweb.
 *
 * Sections:
 * - SQL Explorer: execute read-only SQL via pgweb REST API (port 8081)
 * - 35 preset queries in 5 categories: Customer Data, PG Diagnostics,
 *   Schema & Flyway, Production Investigation, Performance Optimization
 *
 * Data is split across sibling files per B-7-7b file-length hygiene
 * (2026-04-24, svc 1.0.51 wave) :
 * - `database-health-checks.ts` → 8 `HEALTH_CHECKS` for the Health tab
 * - `database-sql-presets.ts`   → 35 `SQL_PRESET_CATEGORIES` for the tabs
 * - `database-types.ts`         → shared interfaces (DbTab, HealthCheck…)
 * This file keeps component class + signals + `executeSql()` only.
 */
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { EnvService } from '../../../core/env/env.service';
import { RouterLink } from '@angular/router';
import type { DbTab, SqlQueryResult } from './database-types';
import { HEALTH_CHECKS } from './database-health-checks';
import { SQL_PRESET_CATEGORIES } from './database-sql-presets';
import { DatabaseHealthTabComponent } from './widgets/database-health-tab.component';

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [FormsModule, RouterLink, DatabaseHealthTabComponent],
  templateUrl: './database.component.html',
  styleUrl: './database.component.scss',
})
export class DatabaseComponent {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  /**
   * Env-aware URLs for the DB admin buttons. `cloudbeaverUrl()` is only set on
   * the Local environment (compose) — in Prod tunnel mode the button is hidden.
   * Ad-hoc SQL in prod goes through a local CloudBeaver pointed at
   * `kubectl port-forward svc/postgresql 15432:5432`.
   */
  readonly env = inject(EnvService);

  /**
   * DestroyRef used by `takeUntilDestroyed()` on every HTTP subscribe to
   * stop the post-destroy `signal.set()` callback (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);
  /** Signal: currently active tab in the Database page. */
  activeTab = signal<DbTab>('health');

  // ── Health checks (data lives in `database-health-checks.ts` — this is
  //    a view-alias so the template can keep `healthChecks` unchanged). ──

  readonly healthChecks = HEALTH_CHECKS;

  /**
   * Called when DatabaseHealthTabComponent emits `rawDataRequested` —
   * pipes the health-check's SQL into the SQL Explorer + runs it.
   * Parent acts as the bridge between the 2 widgets rather than
   * introducing a shared DatabaseStateService for one event hop.
   */
  onRawDataRequested(query: string): void {
    this.sqlQuery = query;
    this.executeSql();
  }

  // ── SQL Explorer ──────────────────────────────────────────────────────────
  sqlQuery = 'SELECT id, name, email FROM customer LIMIT 20';
  sqlResult = signal<{ columns: string[]; rows: string[][] } | null>(null);
  sqlError = signal('');
  sqlLoading = signal(false);

  // ── SQL presets (data lives in `database-sql-presets.ts` — this is
  //    a view-alias so the template can keep `sqlPresetCategories` unchanged). ──

  readonly sqlPresetCategories = SQL_PRESET_CATEGORIES;

  /**
   * Calls pgweb REST API — read-only SQL proxy. The endpoint is env-aware:
   *   Local       → http://localhost:8081  (pgweb-local → compose `db:5432`)
   *   Prod tunnel → http://localhost:8082  (pgweb-prod  → host.docker.internal:15432)
   * Per ADR-0026 in mirador-service, Spring Boot is not on this path.
   */
  executeSql(): void {
    const pgweb = this.env.pgwebUrl();
    if (!pgweb) {
      this.sqlError.set(
        'SQL Explorer is unavailable in this environment. Start pgweb (bin/pgweb-prod-up.sh) or use CloudBeaver locally.',
      );
      return;
    }
    this.sqlLoading.set(true);
    this.sqlError.set('');
    this.sqlResult.set(null);

    this.http
      .get<SqlQueryResult>(`${pgweb}/api/query`, {
        params: { query: this.sqlQuery },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = res.rows ?? [];
          const columns = res.columns ?? [];
          if (columns.length > 0) {
            this.sqlResult.set({
              columns,
              rows: rows.map((r) => (r as unknown[]).map((c) => String(c ?? ''))),
            });
          } else if (res.error) {
            this.sqlError.set(res.error);
          } else {
            this.sqlResult.set({ columns: ['result'], rows: [[JSON.stringify(res)]] });
          }
          this.sqlLoading.set(false);
        },
        error: (e) => {
          this.sqlError.set(
            `pgweb not available at ${pgweb} (${e.status || 'error'}). Start it with: docker compose up -d pgweb-local  — or for Prod tunnel: bin/pgweb-prod-up.sh`,
          );
          this.sqlLoading.set(false);
        },
      });
  }
}
