/**
 * CustomersComponent — Full CRUD management page for customers.
 *
 * Features:
 * - Paginated list with server-side search (300ms debounce) and sort
 * - API versioning toggle (v1.0 / v2.0 — v2 adds createdAt field)
 * - Full/Summary view modes (summary = id + name projection)
 * - Create form with optional idempotency key for replay safety
 * - Inline edit modal and delete confirmation
 * - Batch selection with "select all" and bulk delete
 * - Per-customer detail tabs: Bio (Ollama LLM), Todos (JSONPlaceholder), Enrich (Kafka)
 * - Import from JSON/CSV files with progress tracking
 * - Export current page as JSON or CSV
 */
import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  viewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  Customer,
  CustomerSummary,
  EnrichedCustomer,
  TodoItem,
  Page,
  AggregatedResponse,
} from '../../../core/api/api.service';
import { EnvService } from '../../../core/env/env.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { FeatureFlagService } from '../../../core/feature-flags/feature-flag.service';
import { InfoTipComponent } from '../../../shared/info-tip/info-tip.component';
import { uuid, randomCustomer } from './customers-helpers';
import type { DetailTab, SortField, SortDir } from './customers-types';
import { CustomerDetailPanelComponent } from './widgets/customer-detail-panel.component';
import { CustomerCreateFormComponent } from './widgets/customer-create-form.component';
import { ConfirmModalComponent } from '../../../shared/confirm-modal/confirm-modal.component';
import { CustomerImportExportService } from './customer-import-export.service';
import { CustomerSelectionService } from './customer-selection.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    InfoTipComponent,
    CustomerDetailPanelComponent,
    CustomerCreateFormComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly env = inject(EnvService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  /** Feature flags — used to gate the Bio tab on `mirador.bio.enabled`. */
  readonly flags = inject(FeatureFlagService);

  /**
   * DestroyRef used by `takeUntilDestroyed()` on every HTTP subscribe to
   * stop the post-destroy `signal.set()` callback (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);
  /**
   * Is the Bio tab available? Kill-switch semantics via Unleash:
   *   - Local (no proxy) → true (always show in dev)
   *   - Kind/Prod with flag `mirador.bio.enabled = false` → hide the tab
   *   - Kind/Prod, flag missing or loading → true (default on: Ollama is
   *     part of the customer-facing product so we stay optimistic)
   */
  readonly bioEnabled = computed(() => {
    if (!this.flags.isAvailable()) return true;
    const map = this.flags.flags();
    return 'mirador.bio.enabled' in map ? map['mirador.bio.enabled'] : true;
  });

  // ── List state ─────────────────────────────────────────────────────────────

  /** Signal: current page of full customer entities. Null until first load. */
  customers = signal<Page<Customer> | null>(null);

  /** Signal: current page of lightweight customer summaries (id+name only). Null until first load. */
  summaries = signal<Page<CustomerSummary> | null>(null);

  /** Signal: last 10 customers from the Redis ring buffer (`/customers/recent`). */
  recent = signal<Customer[] | null>(null);

  /** Signal: result from `/customers/aggregate` — two parallel virtual thread tasks. */
  aggregate = signal<AggregatedResponse | null>(null);

  /**
   * Signal: active API version sent as the `X-API-Version` header.
   * v2.0 adds the `createdAt` field to the response.
   */
  apiVersion = signal<'1.0' | '2.0'>('1.0');

  /**
   * Signal: when true, fetches summary projections instead of full customer entities.
   * Demonstrates the `/customers/summary` lightweight endpoint.
   */
  summaryMode = signal(false);

  /** Signal: zero-based current page index for list pagination. */
  currentPage = signal(0);

  /** Signal: true while a list or summary fetch is in flight. */
  listLoading = signal(false);

  /** Signal: error message from the most recent list fetch. */
  listError = signal('');

  // ── Search ────────────────────────────────────────────────────────────────

  /** Signal: current search query string. Debounced 300ms before triggering a list reload. */
  searchQuery = signal('');

  /** Debounce timer for search input — prevents a request on every keystroke. */
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Live new-customer notification (SSE) ──────────────────────────────────

  /**
   * Signal: count of new customers received via SSE since the list was last loaded.
   * Shown as a banner to prompt the user to refresh the list.
   */
  newCustomerCount = signal(0);

  /** The active Server-Sent Events connection to `/customers/stream`. Null when disconnected. */
  private _sseSource: EventSource | null = null;

  // ── Sort ──────────────────────────────────────────────────────────────────

  /** Signal: the column currently used for sorting. Null means no explicit sort (default order). */
  sortField = signal<SortField | null>(null);

  /** Signal: current sort direction, toggled per-column on click. */
  sortDir = signal<SortDir>('asc');

  // ── Batch selection — state + methods moved to CustomerSelectionService
  //    (B-7-2c Step 2, 2026-04-24). Exposed here as `selection` so
  //    templates can read / bind to `selection.selectedIds()` etc. ──
  readonly selection = inject(CustomerSelectionService);

  // ── Create form (state owned by the widget — see widgets/customer-create-form) ──

  /**
   * Template ref to the create-form widget. Used to call `clearForm()`
   * after a successful create (parent doesn't own the input state ;
   * the widget does, so we call its method).
   */
  readonly createForm = viewChild<CustomerCreateFormComponent>('createForm');

  /** Signal: true while the create HTTP request is in flight. */
  createLoading = signal(false);

  /** Signal: error message from the most recent create attempt. */
  createError = signal('');

  /** Signal: the newly created customer returned by the server. Shown as a success confirmation. */
  createSuccess = signal<Customer | null>(null);

  // ── Edit modal ────────────────────────────────────────────────────────────

  /** Signal: the customer currently open in the edit modal. Null when modal is closed. */
  editingCustomer = signal<Customer | null>(null);

  /** Mutable field for the edit modal name input (not a signal — bound via ngModel). */
  editName = '';

  /** Mutable field for the edit modal email input (not a signal — bound via ngModel). */
  editEmail = '';

  /** Signal: true while the update HTTP request is in flight. */
  editLoading = signal(false);

  /** Signal: error message from the most recent update attempt. */
  editError = signal('');

  // ── Delete confirm ────────────────────────────────────────────────────────

  /** Signal: the customer for which a delete confirmation dialog is open. */
  deletingCustomer = signal<Customer | null>(null);

  /** Signal: true while a single-customer delete request is in flight. */
  deleteLoading = signal(false);
  // batchDeleteLoading + confirmBatchDelete moved to CustomerSelectionService.

  // ── Per-customer detail ────────────────────────────────────────────────────

  /** Signal: the customer whose detail panel is currently open. Null when panel is closed. */
  selectedCustomer = signal<Customer | null>(null);

  /** Signal: active tab in the per-customer detail panel. */
  activeTab = signal<DetailTab>('bio');

  /** Signal: AI-generated bio from `/customers/{id}/bio` (Ollama LLM). Null until loaded. */
  bio = signal<string | null>(null);

  /** Signal: todos from `/customers/{id}/todos` (JSONPlaceholder). Null until loaded. */
  todos = signal<TodoItem[] | null>(null);

  /** Signal: enriched customer from `/customers/{id}/enrich` (Kafka reply). Null until loaded. */
  enriched = signal<EnrichedCustomer | null>(null);

  /** Signal: true while any detail panel tab request is in flight. */
  detailLoading = signal(false);

  /** Signal: error message from the most recent detail tab load attempt. */
  detailError = signal('');

  // ── Aggregate ─────────────────────────────────────────────────────────────

  /** Signal: true while the `/customers/aggregate` request is in flight. */
  aggregateLoading = signal(false);

  /** Signal: result message from the aggregate call (timing or error). */
  aggregateError = signal('');

  /**
   * Computed: total number of pages for the currently active list mode.
   * Switches between full and summary page counts based on `summaryMode`.
   */
  readonly totalPages = computed(() => {
    if (this.summaryMode()) return this.summaries()?.totalPages ?? 1;
    return this.customers()?.totalPages ?? 1;
  });

  // hasSelection computed moved to CustomerSelectionService.hasSelection

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.loadCustomers();
    }
    this.connectSse();
  }

  ngOnDestroy(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.disconnectSse();
  }

  private connectSse(): void {
    try {
      const base = this.env.baseUrl();
      this._sseSource = new EventSource(`${base}/customers/stream`);
      this._sseSource.addEventListener('customer', () => {
        this.newCustomerCount.update((n) => n + 1);
      });
    } catch {
      /* SSE not available */
    }
  }

  private disconnectSse(): void {
    if (this._sseSource) {
      this._sseSource.close();
      this._sseSource = null;
    }
  }

  dismissNewBanner(): void {
    this.newCustomerCount.set(0);
    this.loadCustomers();
  }

  // ── Search ────────────────────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.currentPage.set(0);
      this.loadCustomers();
    }, 300);
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  toggleSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.loadCustomers();
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  // ── List ───────────────────────────────────────────────────────────────────
  loadCustomers(): void {
    this.listLoading.set(true);
    this.listError.set('');
    this.selection.clearSelection();

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

  setVersion(v: '1.0' | '2.0'): void {
    this.apiVersion.set(v);
    this.currentPage.set(0);
    this.loadCustomers();
  }

  toggleSummaryMode(): void {
    this.summaryMode.update((v) => !v);
    this.currentPage.set(0);
    this.loadCustomers();
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
      this.loadCustomers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update((p) => p + 1);
      this.loadCustomers();
    }
  }

  loadRecent(): void {
    this.api
      .getRecentCustomers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.recent.set(r),
        error: (err) => this.listError.set(httpError(err)),
      });
  }

  runAggregate(): void {
    this.aggregateLoading.set(true);
    this.aggregateError.set('');
    this.aggregate.set(null);
    const t0 = Date.now();
    this.api
      .getAggregate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.aggregate.set(r);
          this.aggregateLoading.set(false);
          this.aggregateError.set(`Completed in ${Date.now() - t0} ms (virtual threads)`);
        },
        error: (err) => {
          this.aggregateError.set(httpError(err));
          this.aggregateLoading.set(false);
        },
      });
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  /**
   * Handler for the create-form widget's `createRequested` event.
   * Receives the validated {name, email, idempotencyKey} payload from
   * the widget, performs the POST, surfaces toasts + refreshes the list.
   * Calls `createForm.clearForm()` on success to reset the widget's
   * internal input signals.
   */
  onCreateRequested(payload: { name: string; email: string; idempotencyKey?: string }): void {
    this.createLoading.set(true);
    this.createError.set('');
    this.createSuccess.set(null);

    this.api
      .createCustomer({ name: payload.name, email: payload.email }, payload.idempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.createSuccess.set(c);
          this.createForm()?.clearForm();
          this.createLoading.set(false);
          this.toast.show(`Customer "${c.name}" created (ID ${c.id})`, 'success');
          this.activity.log('customer-create', `Created "${c.name}" (ID ${c.id})`);
          this.loadCustomers();
        },
        error: (err) => {
          this.createError.set(httpError(err));
          this.createLoading.set(false);
        },
      });
  }

  /**
   * Create a customer with a randomly-generated name + email in one click.
   * Useful for demos, soak-tests, and seeding the list without retyping.
   * Bypasses the form widget — uses the random helper directly. The
   * widget's "🎲 Add random customer" button emits createRandomRequested
   * which the parent template binds to this method.
   */
  addRandomCustomer(): void {
    const { name, email } = randomCustomer();
    this.createLoading.set(true);
    this.createError.set('');
    this.createSuccess.set(null);

    this.api
      .createCustomer({ name, email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.createSuccess.set(c);
          this.createLoading.set(false);
          this.toast.show(`Random customer "${c.name}" created (ID ${c.id})`, 'success');
          this.activity.log('customer-create', `Random-created "${c.name}" (ID ${c.id})`);
          this.loadCustomers();
        },
        error: (err) => {
          this.createError.set(httpError(err));
          this.createLoading.set(false);
        },
      });
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  openEdit(c: Customer): void {
    this.editingCustomer.set(c);
    this.editName = c.name;
    this.editEmail = c.email;
    this.editError.set('');
  }

  cancelEdit(): void {
    this.editingCustomer.set(null);
  }

  saveEdit(): void {
    const c = this.editingCustomer();
    if (!c?.id || !this.editName.trim() || !this.editEmail.trim()) return;
    this.editLoading.set(true);
    this.editError.set('');

    this.api
      .updateCustomer(c.id, { name: this.editName.trim(), email: this.editEmail.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.editingCustomer.set(null);
          this.editLoading.set(false);
          this.toast.show(`Customer "${updated.name}" updated`, 'success');
          this.activity.log('customer-update', `Updated "${updated.name}" (ID ${updated.id})`);
          this.loadCustomers();
        },
        error: (err) => {
          this.editError.set(httpError(err));
          this.editLoading.set(false);
        },
      });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDelete(c: Customer): void {
    this.deletingCustomer.set(c);
  }

  cancelDelete(): void {
    this.deletingCustomer.set(null);
  }

  confirmDelete(): void {
    const c = this.deletingCustomer();
    if (!c?.id) return;
    this.deleteLoading.set(true);

    this.api
      .deleteCustomer(c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingCustomer.set(null);
          this.deleteLoading.set(false);
          this.toast.show(`Customer "${c.name}" deleted`, 'success');
          this.activity.log('customer-delete', `Deleted "${c.name}" (ID ${c.id})`);
          this.loadCustomers();
        },
        error: (err) => {
          this.deleteLoading.set(false);
          this.toast.show(httpError(err), 'error');
          this.deletingCustomer.set(null);
        },
      });
  }

  // ── Batch selection — delegated to CustomerSelectionService.
  //    Thin wrappers below keep the template bindings stable ;
  //    all state + logic lives in the service (B-7-2c Step 2). ──

  toggleSelectAll(): void {
    this.selection.toggleSelectAll(this.customers()?.content ?? []);
  }

  toggleSelectOne(id: number): void {
    this.selection.toggleSelectOne(id);
  }

  openBatchDelete(): void {
    this.selection.openBatchDelete();
  }

  cancelBatchDelete(): void {
    this.selection.cancelBatchDelete();
  }

  executeBatchDelete(): void {
    this.selection.executeBatchDelete(() => this.loadCustomers());
  }

  // ── Bulk import / export delegated to CustomerImportExportService ─────
  readonly importExport = inject(CustomerImportExportService);

  /** Template delegates the file-input change event to the service. */
  onFileSelected(event: Event): void {
    this.importExport.handleFileSelected(event, () => this.loadCustomers());
  }

  /** Export current page as JSON (full or summary per `summaryMode`). */
  exportJson(): void {
    const data = this.summaryMode() ? this.summaries()?.content : this.customers()?.content;
    this.importExport.exportJson(data);
  }

  /** Export full customer list as CSV (schema depends on apiVersion). */
  exportCsv(): void {
    this.importExport.exportCsv(this.customers()?.content, this.apiVersion());
  }

  // ── Per-customer actions ───────────────────────────────────────────────────
  selectCustomer(c: Customer, tab: DetailTab): void {
    this.selectedCustomer.set(c);
    this.activeTab.set(tab);
    this.bio.set(null);
    this.todos.set(null);
    this.enriched.set(null);
    this.detailError.set('');
    this.runTab(c, tab);
  }

  switchTab(tab: DetailTab): void {
    this.activeTab.set(tab);
    const c = this.selectedCustomer();
    if (!c?.id) return;
    if (tab === 'bio' && !this.bio()) this.runTab(c, tab);
    if (tab === 'todos' && !this.todos()) this.runTab(c, tab);
    if (tab === 'enrich' && !this.enriched()) this.runTab(c, tab);
  }

  private runTab(c: Customer, tab: DetailTab): void {
    if (!c.id) return;
    this.detailLoading.set(true);
    this.detailError.set('');

    if (tab === 'bio') {
      this.api
        .getCustomerBio(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.bio.set(r.bio);
            this.detailLoading.set(false);
          },
          error: (err) => {
            this.detailError.set(httpError(err));
            this.detailLoading.set(false);
          },
        });
    } else if (tab === 'todos') {
      this.api
        .getCustomerTodos(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.todos.set(r);
            this.detailLoading.set(false);
          },
          error: (err) => {
            this.detailError.set(httpError(err));
            this.detailLoading.set(false);
          },
        });
    } else if (tab === 'enrich') {
      this.api
        .enrichCustomer(c.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.enriched.set(r);
            this.detailLoading.set(false);
          },
          error: (err) => {
            this.detailError.set(httpError(err));
            this.detailLoading.set(false);
          },
        });
    }
  }

  closeDetail(): void {
    this.selectedCustomer.set(null);
  }
}

/** Extract a human-readable error message from HTTP error responses */
function httpError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e.status === 401) return 'Not authenticated — please sign in.';
  if (e.status === 429) return '429 Too Many Requests — rate limit exceeded.';
  if (e.status === 504) return '504 Gateway Timeout — Kafka reply timed out (5 s).';
  return `Error ${e.status ?? '?'}: ${e.message ?? 'unknown'}`;
}
