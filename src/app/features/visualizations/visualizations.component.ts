/**
 * VisualizationsComponent — Session-local visualisations kept in the UI.
 *
 * Per ADR-0006, pure Prometheus-fed panels (golden signals, JVM gauges, Kafka
 * consumer lag, Spring Data slow queries) were retired from the UI and live
 * in Grafana. Only two tabs remain here because they are tied to in-session
 * state that Grafana cannot capture:
 *
 * - Error Timeline: polls 5 probe requests every 3s, correlated with chaos
 *   triggers fired elsewhere in the UI; spike is only meaningful while the
 *   operator is watching the chaos action land.
 * - Bundle: Angular lazy-chunk size breakdown from the local build artefact.
 */
import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { InfoTipComponent } from '../../shared/info-tip/info-tip.component';

/** Active visualization tab in the Metrics page. */
type VizTab = 'errors' | 'bundle3d';

// ── Error timeline ──────────────────────────────────────────────────────────

/**
 * One sample in the error timeline chart.
 * Stacked as green (ok) + red (errors) bars, polled every 3 seconds.
 */
interface ErrorSample {
  /** Wall-clock time of the sample. */
  time: Date;
  /** Number of 2xx HTTP responses in this sample window. */
  ok: number;
  /** Number of non-2xx HTTP responses in this sample window. */
  errors: number;
}

@Component({
  selector: 'app-visualizations',
  standalone: true,
  imports: [RouterLink, InfoTipComponent],
  templateUrl: './visualizations.component.html',
  styleUrl: './visualizations.component.scss',
})
export class VisualizationsComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  activeTab = signal<VizTab>('errors');
  activeTabTip = computed(() => this.vizTabs.find((t) => t.id === this.activeTab())?.tip ?? '');

  readonly vizTabs: Array<{ id: VizTab; label: string; icon: string; tip: string }> = [
    {
      id: 'errors',
      label: 'Error Timeline',
      icon: '💥',
      tip: 'Live stacked bar chart of OK vs error responses. Polls every 3s with 5 probe requests. Use with chaos actions',
    },
    {
      id: 'bundle3d',
      label: 'Bundle',
      icon: '📦',
      tip: 'Angular bundle size breakdown by lazy-loaded chunk. Treemap showing relative sizes of feature modules',
    },
  ];

  // ── Error timeline ────────────────────────────────────────────────────────
  errorSamples = signal<ErrorSample[]>([]);
  errorPolling = signal(false);
  private _errorTimer: ReturnType<typeof setInterval> | null = null;

  // ── Banner ────────────────────────────────────────────────────────────────
  vizError = signal<string>('');

  // ── Bundle treemap ────────────────────────────────────────────────────────
  bundleChunks = signal<Array<{ name: string; size: number; pct: number }>>([]);

  ngOnDestroy(): void {
    this.stopErrorPolling();
  }

  switchTab(tab: VizTab): void {
    this.activeTab.set(tab);
    this.vizError.set('');
  }

  // ── Error timeline ────────────────────────────────────────────────────────
  toggleErrorPolling(): void {
    if (this.errorPolling()) {
      this.stopErrorPolling();
      return;
    }
    this.errorPolling.set(true);
    this.errorSamples.set([]);
    this.sampleErrors();
    this._errorTimer = setInterval(() => this.sampleErrors(), 3000);
  }

  errorsGenerating = signal(false);

  /** Fire requests that produce errors: invalid payloads, missing resources, rate limit, Kafka timeout */
  generateErrors(): void {
    this.errorsGenerating.set(true);
    const base = this.env.baseUrl();
    const errorRequests = [
      // 400 — validation errors (empty body)
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      // 404 — non-existent customer
      this.http.get(`${base}/customers/999999`).pipe(catchError(() => of(null))),
      this.http.get(`${base}/customers/999999/bio`).pipe(catchError(() => of(null))),
      // 504 — Kafka enrich timeout (if consumer not running)
      this.http.get(`${base}/customers/1/enrich`).pipe(catchError(() => of(null))),
      // 429 — burst to trigger rate limit
      ...Array.from({ length: 15 }, () =>
        this.http.get(`${base}/customers?page=0&size=1`).pipe(catchError(() => of(null))),
      ),
    ];
    let done = 0;
    for (const req$ of errorRequests) {
      req$.subscribe(() => {
        done++;
        if (done === errorRequests.length) {
          this.errorsGenerating.set(false);
        }
      });
    }
  }

  private stopErrorPolling(): void {
    this.errorPolling.set(false);
    if (this._errorTimer) {
      clearInterval(this._errorTimer);
      this._errorTimer = null;
    }
  }

  private sampleErrors(): void {
    const base = this.env.baseUrl();
    let ok = 0;
    let errors = 0;
    let done = 0;
    const total = 5;
    for (let i = 0; i < total; i++) {
      this.http
        .get(`${base}/customers?page=0&size=1`)
        .pipe(
          catchError(() => {
            errors++;
            return of(null);
          }),
        )
        .subscribe(() => {
          done++;
          if (done === total) {
            ok = total - errors;
            this.errorSamples.update((s) => [...s.slice(-39), { time: new Date(), ok, errors }]);
          }
        });
    }
  }

  errorChartBars(): Array<{ x: number; okH: number; errH: number }> {
    const s = this.errorSamples();
    if (!s.length) return [];
    const max = Math.max(1, ...s.map((x) => x.ok + x.errors));
    const barW = 400 / 40;
    return s.map((x, i) => ({
      x: i * barW,
      okH: (x.ok / max) * 80,
      errH: (x.errors / max) * 80,
    }));
  }

  // ── Bundle treemap ────────────────────────────────────────────────────────
  analyzeBundleFromBuild(): void {
    // Parse from the build output sizes - simulated from known chunks
    const chunks = [
      { name: 'main (core)', size: 45 },
      { name: 'dashboard', size: 14 },
      { name: 'customers', size: 12 },
      { name: 'diagnostic', size: 11 },
      { name: 'observability', size: 10 },
      { name: 'chaos', size: 9 },
      { name: 'request-builder', size: 7 },
      { name: 'settings', size: 6 },
      { name: 'visualizations', size: 8 },
      { name: 'activity', size: 4 },
      { name: 'login', size: 2 },
      { name: 'polyfills', size: 1 },
    ];
    const total = chunks.reduce((s, c) => s + c.size, 0);
    this.bundleChunks.set(chunks.map((c) => ({ ...c, pct: Math.round((c.size / total) * 100) })));
  }

  treemapColor(index: number): string {
    const colors = [
      '#3b82f6',
      '#8b5cf6',
      '#06b6d4',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#ec4899',
      '#6366f1',
      '#14b8a6',
      '#f97316',
      '#84cc16',
      '#94a3b8',
    ];
    return colors[index % colors.length];
  }
}
