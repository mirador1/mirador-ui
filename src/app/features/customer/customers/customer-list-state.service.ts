/**
 * CustomerListStateService — List + pagination + sort + search state
 * extracted from CustomersComponent.
 *
 * Final D1 step of B-7-2c (step 4) — after ImportExport (step 1),
 * Selection (step 2), Crud (step 3). Completes the customers.component
 * split by moving the list-display concern into its own Injectable.
 *
 * Owns :
 * - customers / summaries (paginated results, one or the other active
 *   depending on summaryMode)
 * - recent (Redis ring buffer of last 10 creates)
 * - apiVersion (X-API-Version header) / summaryMode (full vs slim rows)
 * - currentPage + totalPages computed
 * - searchQuery (with 300 ms debounce on input)
 * - sortField + sortDir
 * - newCustomerCount (live WS counter)
 * - listLoading + listError
 *
 * Methods :
 * - loadCustomers() — main HTTP round-trip, switches to getCustomerSummary
 *   when summaryMode is on, builds the sort param from field+dir
 * - loadRecent() — refresh ring buffer
 * - setVersion / toggleSummaryMode — both reset page + reload
 * - onSearchInput(value) — 300 ms debounced reload
 * - toggleSort(field) / sortIcon(field) — sort state + icon helper
 * - prevPage / nextPage — clamped pagination
 * - dismissNewBanner — clear counter + reload
 *
 * Parent delegates to this service ; other services (Crud, Selection,
 * ImportExport) pass `listState.loadCustomers.bind(listState)` as their
 * onAfterChange callback.
 *
 * Extracted 2026-04-24 per B-7-2c Step 4 — finalises D1.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Customer, CustomerSummary, Page } from '../../../core/api/api.service';
import { httpError } from './customers-helpers';
import type { SortField, SortDir } from './customers-types';

@Injectable({ providedIn: 'root' })
export class CustomerListStateService {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Results ───────────────────────────────────────────────────────────
  readonly customers = signal<Page<Customer> | null>(null);
  readonly summaries = signal<Page<CustomerSummary> | null>(null);
  readonly recent = signal<Customer[] | null>(null);

  // ── Filters / modes ───────────────────────────────────────────────────
  readonly apiVersion = signal<'1.0' | '2.0'>('1.0');
  readonly summaryMode = signal(false);
  readonly searchQuery = signal('');
  readonly sortField = signal<SortField | null>(null);
  readonly sortDir = signal<SortDir>('asc');

  // ── Pagination ────────────────────────────────────────────────────────
  readonly currentPage = signal(0);
  readonly totalPages = computed(() => {
    if (this.summaryMode()) return this.summaries()?.totalPages ?? 1;
    return this.customers()?.totalPages ?? 1;
  });

  // ── Fetch state ───────────────────────────────────────────────────────
  readonly listLoading = signal(false);
  readonly listError = signal('');

  // ── Live new-customer notification (incremented by WS, decremented by user action) ──
  readonly newCustomerCount = signal(0);

  // ── Search debounce ───────────────────────────────────────────────────
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Load the current page. Called on every state change (page / sort /
   * filter / apiVersion / summaryMode) + after every mutation from the
   * sibling services (Crud, Selection, ImportExport).
   *
   * Parent passes `onBeforeLoad` — typically the selection clear — so
   * toggling to a new page doesn't leave stale checkboxes selected.
   */
  loadCustomers(onBeforeLoad?: () => void): void {
    this.listLoading.set(true);
    this.listError.set('');
    onBeforeLoad?.();

    const sort = this.sortField() ? `${this.sortField()},${this.sortDir()}` : undefined;
    const search = this.searchQuery() || undefined;

    if (this.summaryMode()) {
      this.api
        .getCustomerSummary(this.currentPage())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (p) => {
            this.summaries.set(p);
            this.listLoading.set(false);
          },
          error: (err) => {
            this.listError.set(httpError(err));
            this.listLoading.set(false);
          },
        });
    } else {
      this.api
        .getCustomers(this.currentPage(), 10, this.apiVersion(), search, sort)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (p) => {
            this.customers.set(p);
            this.listLoading.set(false);
          },
          error: (err) => {
            this.listError.set(httpError(err));
            this.listLoading.set(false);
          },
        });
    }
  }

  /** Fetch the Redis ring buffer of last 10 creates. Silent on error. */
  loadRecent(): void {
    this.api
      .getRecentCustomers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.recent.set(r),
        error: (err) => this.listError.set(httpError(err)),
      });
  }

  setVersion(v: '1.0' | '2.0', onLoad: () => void): void {
    this.apiVersion.set(v);
    this.currentPage.set(0);
    onLoad();
  }

  toggleSummaryMode(onLoad: () => void): void {
    this.summaryMode.update((v) => !v);
    this.currentPage.set(0);
    onLoad();
  }

  onSearchInput(value: string, onLoad: () => void): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage.set(0);
      onLoad();
    }, 300);
  }

  toggleSort(field: SortField, onLoad: () => void): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    onLoad();
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  prevPage(onLoad: () => void): void {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
      onLoad();
    }
  }

  nextPage(onLoad: () => void): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update((p) => p + 1);
      onLoad();
    }
  }

  dismissNewBanner(onLoad: () => void): void {
    this.newCustomerCount.set(0);
    onLoad();
  }
}
