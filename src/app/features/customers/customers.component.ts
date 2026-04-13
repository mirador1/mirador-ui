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
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  Customer,
  CustomerSummary,
  EnrichedCustomer,
  TodoItem,
  Page,
  AggregatedResponse,
} from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { ActivityService } from '../../core/activity/activity.service';
import { InfoTipComponent } from '../../shared/info-tip/info-tip.component';

/** Generate a UUID v4 for idempotency keys */
function uuid(): string {
  return crypto.randomUUID();
}

/** Per-customer detail panel tabs */
type DetailTab = 'bio' | 'todos' | 'enrich';
type SortField = 'id' | 'name' | 'email' | 'createdAt';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [FormsModule, JsonPipe, DatePipe, RouterLink, InfoTipComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  // ── List state ─────────────────────────────────────────────────────────────
  customers = signal<Page<Customer> | null>(null);
  summaries = signal<Page<CustomerSummary> | null>(null);
  recent = signal<Customer[] | null>(null);
  aggregate = signal<AggregatedResponse | null>(null);

  apiVersion = signal<'1.0' | '2.0'>('1.0');
  summaryMode = signal(false);
  currentPage = signal(0);

  listLoading = signal(false);
  listError = signal('');

  // ── Search ────────────────────────────────────────────────────────────────
  searchQuery = signal('');
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Sort ──────────────────────────────────────────────────────────────────
  sortField = signal<SortField | null>(null);
  sortDir = signal<SortDir>('asc');

  // ── Batch selection ───────────────────────────────────────────────────────
  selectedIds = signal<Set<number>>(new Set());
  selectAll = signal(false);

  // ── Create form ────────────────────────────────────────────────────────────
  readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  newName = signal('');
  newEmail = signal('');
  useIdempotencyKey = signal(false);
  idempotencyKey = signal(uuid());
  createLoading = signal(false);
  createError = signal('');
  createSuccess = signal<Customer | null>(null);

  // ── Edit modal ────────────────────────────────────────────────────────────
  editingCustomer = signal<Customer | null>(null);
  editName = '';
  editEmail = '';
  editLoading = signal(false);
  editError = signal('');

  // ── Delete confirm ────────────────────────────────────────────────────────
  deletingCustomer = signal<Customer | null>(null);
  deleteLoading = signal(false);
  batchDeleteLoading = signal(false);
  confirmBatchDelete = signal(false);

  // ── Per-customer detail ────────────────────────────────────────────────────
  selectedCustomer = signal<Customer | null>(null);
  activeTab = signal<DetailTab>('bio');
  bio = signal<string | null>(null);
  todos = signal<TodoItem[] | null>(null);
  enriched = signal<EnrichedCustomer | null>(null);
  detailLoading = signal(false);
  detailError = signal('');

  // ── Aggregate ─────────────────────────────────────────────────────────────
  aggregateLoading = signal(false);
  aggregateError = signal('');

  readonly totalPages = computed(() => {
    if (this.summaryMode()) return this.summaries()?.totalPages ?? 1;
    return this.customers()?.totalPages ?? 1;
  });

  readonly hasSelection = computed(() => this.selectedIds().size > 0);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.loadCustomers();
    }
  }

  ngOnDestroy(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
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
    this.selectedIds.set(new Set());
    this.selectAll.set(false);

    const sort = this.sortField() ? `${this.sortField()},${this.sortDir()}` : undefined;
    const search = this.searchQuery() || undefined;

    if (this.summaryMode()) {
      this.api.getCustomerSummary(this.currentPage()).subscribe({
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
      this.api.getCustomers(this.currentPage(), 10, this.apiVersion(), search, sort).subscribe({
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
    this.api.getRecentCustomers().subscribe({
      next: (r) => this.recent.set(r),
      error: (err) => this.listError.set(httpError(err)),
    });
  }

  runAggregate(): void {
    this.aggregateLoading.set(true);
    this.aggregateError.set('');
    this.aggregate.set(null);
    const t0 = Date.now();
    this.api.getAggregate().subscribe({
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
  createCustomer(): void {
    // Read directly from DOM — signals may not be synced in zoneless mode
    const nameEl = this.nameInput()?.nativeElement;
    const emailEl = this.emailInput()?.nativeElement;
    const name = (nameEl?.value ?? this.newName()).trim();
    const email = (emailEl?.value ?? this.newEmail()).trim();

    if (!name || !email) {
      this.createError.set('Name and email are required.');
      return;
    }
    this.createLoading.set(true);
    this.createError.set('');
    this.createSuccess.set(null);

    const key = this.useIdempotencyKey() ? this.idempotencyKey() : undefined;
    this.api.createCustomer({ name, email }, key).subscribe({
      next: (c) => {
        this.createSuccess.set(c);
        this.newName.set('');
        this.newEmail.set('');
        if (nameEl) nameEl.value = '';
        if (emailEl) emailEl.value = '';
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

  resetIdempotencyKey(): void {
    this.idempotencyKey.set(uuid());
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

    this.api.deleteCustomer(c.id).subscribe({
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

  // ── Batch selection ───────────────────────────────────────────────────────
  toggleSelectAll(): void {
    const content = this.customers()?.content ?? [];
    if (this.selectAll()) {
      this.selectedIds.set(new Set());
      this.selectAll.set(false);
    } else {
      this.selectedIds.set(new Set(content.map((c) => c.id!)));
      this.selectAll.set(true);
    }
  }

  toggleSelectOne(id: number): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  openBatchDelete(): void {
    this.confirmBatchDelete.set(true);
  }

  cancelBatchDelete(): void {
    this.confirmBatchDelete.set(false);
  }

  executeBatchDelete(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    this.batchDeleteLoading.set(true);

    let completed = 0;
    let errors = 0;
    for (const id of ids) {
      this.api.deleteCustomer(id).subscribe({
        next: () => {
          completed++;
          if (completed + errors === ids.length) this.finishBatchDelete(completed, errors);
        },
        error: () => {
          errors++;
          if (completed + errors === ids.length) this.finishBatchDelete(completed, errors);
        },
      });
    }
  }

  private finishBatchDelete(ok: number, err: number): void {
    this.batchDeleteLoading.set(false);
    this.confirmBatchDelete.set(false);
    this.selectedIds.set(new Set());
    this.selectAll.set(false);
    if (err > 0) {
      this.toast.show(`Deleted ${ok} customers, ${err} failed`, 'warn');
    } else {
      this.toast.show(`Deleted ${ok} customers`, 'success');
    }
    this.loadCustomers();
  }

  // ── Bulk import ────────────────────────────────────────────────────────────
  importLoading = signal(false);
  importProgress = signal(0);
  importTotal = signal(0);
  importResults = signal<{ ok: number; errors: number } | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      let records: Array<{ name: string; email: string }> = [];

      if (file.name.endsWith('.json')) {
        try {
          records = JSON.parse(content);
          if (!Array.isArray(records)) records = [records];
        } catch {
          this.toast.show('Invalid JSON file', 'error');
          return;
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = content.split('\n').filter((l) => l.trim());
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('name') && header.includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        records = dataLines
          .map((line) => {
            const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
            return { name: parts[0] || '', email: parts[1] || '' };
          })
          .filter((r) => r.name && r.email);
      } else {
        this.toast.show('Unsupported file type. Use .json or .csv', 'error');
        return;
      }

      if (!records.length) {
        this.toast.show('No valid records found in file', 'warn');
        return;
      }

      this.executeBulkImport(records);
    };
    reader.readAsText(file);
    input.value = ''; // reset so same file can be re-selected
  }

  private executeBulkImport(records: Array<{ name: string; email: string }>): void {
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.importTotal.set(records.length);
    this.importResults.set(null);

    let ok = 0;
    let errors = 0;
    let done = 0;

    for (const record of records) {
      this.api.createCustomer(record).subscribe({
        next: () => {
          ok++;
          done++;
          this.importProgress.set(done);
          this.checkImportDone(done, records.length, ok, errors);
        },
        error: () => {
          errors++;
          done++;
          this.importProgress.set(done);
          this.checkImportDone(done, records.length, ok, errors);
        },
      });
    }
  }

  private checkImportDone(done: number, total: number, ok: number, errors: number): void {
    if (done < total) return;
    this.importLoading.set(false);
    this.importResults.set({ ok, errors });
    this.toast.show(
      `Import complete: ${ok} created, ${errors} failed`,
      errors > 0 ? 'warn' : 'success',
    );
    this.activity.log(
      'bulk-import',
      `Imported ${ok} customers (${errors} errors)`,
      `Total: ${total} records`,
    );
    this.loadCustomers();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportJson(): void {
    const data = this.summaryMode() ? this.summaries()?.content : this.customers()?.content;
    if (!data?.length) return;
    this.downloadFile(JSON.stringify(data, null, 2), 'customers.json', 'application/json');
  }

  exportCsv(): void {
    const data = this.customers()?.content;
    if (!data?.length) return;
    const headers = ['id', 'name', 'email'];
    if (this.apiVersion() === '2.0') headers.push('createdAt');

    const rows = data.map((c) =>
      headers
        .map((h) => {
          const val = (c as unknown as Record<string, unknown>)[h] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    this.downloadFile([headers.join(','), ...rows].join('\n'), 'customers.csv', 'text/csv');
  }

  private downloadFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
      this.api.getCustomerBio(c.id).subscribe({
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
      this.api.getCustomerTodos(c.id).subscribe({
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
      this.api.enrichCustomer(c.id).subscribe({
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
