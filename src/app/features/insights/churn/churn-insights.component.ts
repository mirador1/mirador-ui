/**
 * Customer Churn insights page (`/insights/churn`).
 *
 * Phase D of the Customer Churn capability — see [shared
 * ADR-0061](file:///../../../../../infra/common/docs/adr/0061-customer-churn-prediction.md).
 *
 * Three widgets :
 *
 * 1. **Search by customer id** — submit an id, see the prediction shape
 *    + risk band + model version. Demonstrates the full ML inference
 *    path end-to-end through the UI.
 * 2. **Top-N at-risk customers** — fetches the first page of customers
 *    (max 50, capped to keep the round-trip fast), runs predictions in
 *    parallel via `forkJoin`, sorts by descending probability, surfaces
 *    the top 10. Slow paths land in the loading overlay rather than
 *    blocking the page.
 * 3. **Drift over 30 days** — placeholder until Phase E (MLflow
 *    tracking + drift SLO) ships the real series. The widget lays out
 *    the panel + axes so the data plumbing in Phase E is a one-line
 *    swap.
 *
 * Backend independence is preserved : every call goes through
 * {@link ApiService.predictCustomerChurn}, so swapping the Java
 * backend for the Python one (or vice versa) is invisible from this
 * component.
 */
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import {
  ApiService,
  ChurnPrediction,
  ChurnRiskBand,
  Customer,
} from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';
import {
  canSubmitChurnSearch,
  formatProbability,
  riskClass,
} from './churn-insights-helpers';

interface RankedPrediction {
  readonly customer: Customer;
  readonly prediction: ChurnPrediction;
}

@Component({
  selector: 'app-churn-insights',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="churn-insights">
      <header class="page-header">
        <h1>Churn Insights</h1>
        <p class="lede">
          ML-driven churn probability for any customer. Backed by an
          <strong>ONNX</strong> model trained in Python and served
          in-process by both backends (Java + Python — see
          <a href="https://gitlab.com/mirador1/mirador-service-shared/-/blob/main/docs/adr/0061-customer-churn-prediction.md" target="_blank" rel="noopener">
            ADR-0061
          </a>). This page calls
          <code>POST /customers/&#123;id&#125;/churn-prediction</code>
          on whichever backend is currently selected.
        </p>
      </header>

      <!-- Widget 1 — Search by id -->
      <article class="widget" data-widget="search">
        <header>
          <h2>Predict for a single customer</h2>
          <span class="hint">Enter a numeric customer id and submit.</span>
        </header>
        <form (submit)="onSubmitSearch($event)" class="search-form">
          <label for="customerId">
            Customer id
            <input
              id="customerId"
              type="number"
              min="1"
              [(ngModel)]="searchIdRaw"
              name="customerId"
              placeholder="e.g. 42"
              [disabled]="searchLoading()"
              autocomplete="off"
            />
          </label>
          <button type="submit" [disabled]="!canSubmitSearch() || searchLoading()">
            {{ searchLoading() ? 'Predicting…' : 'Predict' }}
          </button>
        </form>
        @if (searchError(); as err) {
          <div class="alert alert-error" role="alert">{{ err }}</div>
        }
        @if (searchResult(); as r) {
          <div class="prediction-card" [class]="riskClass(r.riskBand)">
            <div class="prediction-row">
              <span class="risk-dot" [class]="riskClass(r.riskBand)"></span>
              <strong>Customer #{{ r.customerId }}</strong>
              <span class="band">{{ r.riskBand }}</span>
              <span class="prob">probability {{ formatProbability(r.probability) }}</span>
            </div>
            <dl class="prediction-meta">
              <dt>Top features</dt>
              <dd>
                @for (f of r.topFeatures; track f) {
                  <span class="chip">{{ f }}</span>
                }
              </dd>
              <dt>Model version</dt>
              <dd><code>{{ r.modelVersion }}</code></dd>
              <dt>Predicted at</dt>
              <dd>
                <time [attr.datetime]="r.predictedAt">{{ r.predictedAt }}</time>
              </dd>
            </dl>
          </div>
        }
      </article>

      <!-- Widget 2 — Top-10 at-risk -->
      <article class="widget" data-widget="top-at-risk">
        <header>
          <h2>Top 10 at-risk customers</h2>
          <span class="hint">
            Predicts the first {{ topRiskScanSize }} customers and ranks by descending probability.
            HIGH = needs attention.
          </span>
          <button
            class="refresh-btn"
            type="button"
            (click)="loadTopAtRisk()"
            [disabled]="topLoading()"
          >
            {{ topLoading() ? 'Scanning…' : 'Refresh' }}
          </button>
        </header>
        @if (topError(); as err) {
          <div class="alert alert-error" role="alert">{{ err }}</div>
        }
        @if (topAtRisk().length === 0 && !topLoading() && !topError()) {
          <p class="empty-state">No predictions yet — click Refresh to scan.</p>
        }
        @if (topAtRisk().length > 0) {
          <table class="top-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Customer</th>
                <th scope="col">Email</th>
                <th scope="col">Probability</th>
                <th scope="col">Band</th>
              </tr>
            </thead>
            <tbody>
              @for (row of topAtRisk(); track row.customer.id; let i = $index) {
                <tr [class]="riskClass(row.prediction.riskBand)">
                  <td>{{ i + 1 }}</td>
                  <td>
                    <a [routerLink]="['/customers']" [queryParams]="{ id: row.customer.id }">
                      #{{ row.customer.id }} {{ row.customer.name }}
                    </a>
                  </td>
                  <td>{{ row.customer.email }}</td>
                  <td>{{ formatProbability(row.prediction.probability) }}</td>
                  <td>
                    <span class="risk-dot" [class]="riskClass(row.prediction.riskBand)"></span>
                    {{ row.prediction.riskBand }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </article>

      <!-- Widget 3 — Drift over 30 days (placeholder) -->
      <article class="widget" data-widget="drift">
        <header>
          <h2>Model drift — 30 days</h2>
          <span class="hint">
            Population probability distribution vs. training-set baseline. KS-test stat per day
            (lower = closer to training distribution).
          </span>
        </header>
        <div class="drift-placeholder">
          <p>
            <strong>Coming in Phase E.</strong>
            MLflow tracking + drift SLO + Grafana dashboard will surface the daily KS-test
            statistic here. Until then, this panel is a layout sketch — the data plumbing is
            an isolated swap.
          </p>
          <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" class="drift-svg">
            <line x1="40" y1="180" x2="580" y2="180" class="axis" />
            <line x1="40" y1="20" x2="40" y2="180" class="axis" />
            <text x="40" y="195" class="axis-label">today − 30d</text>
            <text x="540" y="195" class="axis-label">today</text>
            <text x="6" y="100" class="axis-label">drift</text>
            <line x1="40" y1="60" x2="580" y2="60" class="threshold" stroke-dasharray="4 4" />
            <text x="46" y="56" class="axis-label">SLO threshold (Phase E)</text>
          </svg>
        </div>
      </article>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 1200px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
      }
      .page-header {
        margin-bottom: 1.5rem;
      }
      .page-header h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(1.5rem, 3vw, 2rem);
      }
      .page-header .lede {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.5;
        color: var(--color-text-muted, #555);
      }
      .widget {
        background: var(--color-card-bg, #fff);
        border: 1px solid var(--color-border, #e0e0e0);
        border-radius: 8px;
        padding: 1.25rem 1rem 1.5rem;
        margin-bottom: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .widget header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .widget header h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      .widget header .hint {
        flex: 1 1 240px;
        font-size: 0.85rem;
        color: var(--color-text-muted, #666);
      }
      .refresh-btn {
        margin-left: auto;
      }
      .search-form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: end;
      }
      .search-form label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.85rem;
      }
      .search-form input {
        padding: 0.45rem 0.6rem;
        font-size: 1rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 4px;
        min-width: 8rem;
      }
      .search-form button,
      .refresh-btn {
        padding: 0.5rem 1.1rem;
        font-size: 0.9rem;
        background: var(--color-accent, #2563eb);
        color: var(--color-on-accent, #fff);
        border: 0;
        border-radius: 4px;
        cursor: pointer;
        min-height: 44px;
      }
      .search-form button:disabled,
      .refresh-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .alert {
        margin-top: 1rem;
        padding: 0.6rem 0.75rem;
        border-radius: 4px;
        font-size: 0.9rem;
      }
      .alert-error {
        background: rgba(220, 38, 38, 0.08);
        color: #b91c1c;
        border: 1px solid rgba(220, 38, 38, 0.25);
      }
      .prediction-card {
        margin-top: 1rem;
        padding: 0.9rem 1rem;
        border-radius: 6px;
        border: 1px solid var(--color-border, #e0e0e0);
        background: var(--color-card-bg-soft, #fafafa);
      }
      .prediction-card.risk-low {
        border-left: 4px solid #16a34a;
      }
      .prediction-card.risk-medium {
        border-left: 4px solid #d97706;
      }
      .prediction-card.risk-high {
        border-left: 4px solid #dc2626;
      }
      .prediction-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem 0.9rem;
        align-items: center;
      }
      .prediction-row .band {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .prediction-row .prob {
        font-variant-numeric: tabular-nums;
        font-size: 0.95rem;
      }
      .prediction-meta {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.4rem 1rem;
        margin: 0.85rem 0 0;
        font-size: 0.85rem;
      }
      .prediction-meta dt {
        color: var(--color-text-muted, #666);
        font-weight: 500;
      }
      .prediction-meta dd {
        margin: 0;
      }
      .chip {
        display: inline-block;
        padding: 0.1rem 0.5rem;
        margin-right: 0.35rem;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.08);
        color: #1d4ed8;
        font-size: 0.75rem;
      }
      .risk-dot {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 50%;
        background: #999;
      }
      .risk-dot.risk-low {
        background: #16a34a;
      }
      .risk-dot.risk-medium {
        background: #d97706;
      }
      .risk-dot.risk-high {
        background: #dc2626;
      }
      .top-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      .top-table th,
      .top-table td {
        padding: 0.5rem 0.6rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border, #eee);
      }
      .top-table tr.risk-high {
        background: rgba(220, 38, 38, 0.04);
      }
      .empty-state {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text-muted, #666);
      }
      .drift-placeholder {
        font-size: 0.9rem;
      }
      .drift-svg {
        width: 100%;
        margin-top: 0.75rem;
      }
      .drift-svg .axis {
        stroke: var(--color-border, #ccc);
        stroke-width: 1;
      }
      .drift-svg .threshold {
        stroke: #d97706;
        stroke-width: 1;
      }
      .drift-svg .axis-label {
        fill: var(--color-text-muted, #777);
        font-size: 11px;
      }
      @media (max-width: 600px) {
        :host {
          padding: 1rem 0.75rem 2.5rem;
        }
        .top-table {
          font-size: 0.8rem;
        }
        .top-table th,
        .top-table td {
          padding: 0.35rem 0.4rem;
        }
      }
    `,
  ],
})
export class ChurnInsightsComponent {
  /** Cap on the customer-list scan for the Top-N widget — keeps the
   * forkJoin round-trip ≤ ~5 s on the seeded demo dataset. */
  readonly topRiskScanSize = 50;
  /** How many predictions to surface in the Top-at-risk table. */
  readonly topRiskDisplaySize = 10;

  readonly searchIdRaw = signal<number | null>(null);
  readonly searchLoading = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly searchResult = signal<ChurnPrediction | null>(null);

  readonly topLoading = signal(false);
  readonly topError = signal<string | null>(null);
  readonly topAtRisk = signal<RankedPrediction[]>([]);

  readonly canSubmitSearch = computed(() => canSubmitChurnSearch(this.searchIdRaw()));

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  onSubmitSearch(event: Event): void {
    event.preventDefault();
    const id = this.searchIdRaw();
    if (typeof id !== 'number' || id < 1) {
      this.searchError.set('Enter a customer id ≥ 1.');
      return;
    }
    this.searchError.set(null);
    this.searchResult.set(null);
    this.searchLoading.set(true);
    this.api.predictCustomerChurn(id).subscribe({
      next: (prediction) => {
        this.searchResult.set(prediction);
        this.searchLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.searchLoading.set(false);
        this.searchError.set(this.formatHttpError(err));
      },
    });
  }

  loadTopAtRisk(): void {
    this.topError.set(null);
    this.topLoading.set(true);
    this.api.getCustomers(0, this.topRiskScanSize).subscribe({
      next: (page) => {
        // Drop entries without a server-assigned id — they're in-flight
        // create stubs that the backend hasn't materialised yet, so the
        // /churn-prediction endpoint would 404 on them.
        const customers = (page.content ?? []).filter(
          (c): c is Customer & { id: number } => typeof c.id === 'number',
        );
        if (customers.length === 0) {
          this.topAtRisk.set([]);
          this.topLoading.set(false);
          return;
        }
        const calls = customers.map((customer) =>
          this.api.predictCustomerChurn(customer.id).pipe(
            // Skip individual failures so the rest of the page still ranks —
            // commonly happens during the boot window when the model isn't
            // loaded yet (503) ; we surface a banner the first time.
            catchError((err: HttpErrorResponse) => {
              if (this.topError() === null) {
                this.topError.set(this.formatHttpError(err));
              }
              return of<ChurnPrediction | null>(null);
            }),
          ),
        );
        forkJoin(calls).subscribe({
          next: (results) => {
            const ranked: RankedPrediction[] = [];
            results.forEach((prediction, idx) => {
              if (prediction !== null) {
                ranked.push({ customer: customers[idx], prediction });
              }
            });
            ranked.sort((a, b) => b.prediction.probability - a.prediction.probability);
            this.topAtRisk.set(ranked.slice(0, this.topRiskDisplaySize));
            this.topLoading.set(false);
          },
          error: (err: HttpErrorResponse) => {
            this.topLoading.set(false);
            this.topError.set(this.formatHttpError(err));
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.topLoading.set(false);
        this.topError.set(this.formatHttpError(err));
      },
    });
  }

  riskClass(band: ChurnRiskBand): string {
    return riskClass(band);
  }

  formatProbability(p: number): string {
    return formatProbability(p);
  }

  private formatHttpError(err: HttpErrorResponse): string {
    if (err.status === 503) {
      return 'Churn model not loaded yet — provision the ConfigMap (shared ADR-0062) and retry.';
    }
    if (err.status === 404) {
      return 'Customer not found.';
    }
    if (err.status === 422) {
      return 'Invalid customer id.';
    }
    const message =
      typeof err.error === 'object' && err.error && 'detail' in err.error
        ? String((err.error as { detail: unknown }).detail)
        : (err.message ?? 'Unexpected error');
    this.toast.show(`Churn prediction failed (${err.status})`, 'error', 6000);
    return message;
  }
}
