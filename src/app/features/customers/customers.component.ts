import { Component, inject, signal, computed } from '@angular/core';
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
  AggregatedResponse
} from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

function uuid(): string {
  return crypto.randomUUID();
}

type DetailTab = 'bio' | 'todos' | 'enrich';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [FormsModule, JsonPipe, DatePipe, RouterLink],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

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

  // ── Create form ────────────────────────────────────────────────────────────
  newName = '';
  newEmail = '';
  useIdempotencyKey = signal(false);
  idempotencyKey = signal(uuid());
  createLoading = signal(false);
  createError = signal('');
  createSuccess = signal<Customer | null>(null);

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

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.loadCustomers();
    }
  }

  // ── List ───────────────────────────────────────────────────────────────────
  loadCustomers(): void {
    this.listLoading.set(true);
    this.listError.set('');
    if (this.summaryMode()) {
      this.api.getCustomerSummary(this.currentPage()).subscribe({
        next: p => { this.summaries.set(p); this.listLoading.set(false); },
        error: err => { this.listError.set(httpError(err)); this.listLoading.set(false); }
      });
    } else {
      this.api.getCustomers(this.currentPage(), 10, this.apiVersion()).subscribe({
        next: p => { this.customers.set(p); this.listLoading.set(false); },
        error: err => { this.listError.set(httpError(err)); this.listLoading.set(false); }
      });
    }
  }

  setVersion(v: '1.0' | '2.0'): void {
    this.apiVersion.set(v);
    this.currentPage.set(0);
    this.loadCustomers();
  }

  toggleSummaryMode(): void {
    this.summaryMode.update(v => !v);
    this.currentPage.set(0);
    this.loadCustomers();
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadCustomers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update(p => p + 1);
      this.loadCustomers();
    }
  }

  loadRecent(): void {
    this.api.getRecentCustomers().subscribe({
      next: r => this.recent.set(r),
      error: err => this.listError.set(httpError(err))
    });
  }

  runAggregate(): void {
    this.aggregateLoading.set(true);
    this.aggregateError.set('');
    this.aggregate.set(null);
    const t0 = Date.now();
    this.api.getAggregate().subscribe({
      next: r => {
        this.aggregate.set(r);
        this.aggregateLoading.set(false);
        this.aggregateError.set(`Completed in ${Date.now() - t0} ms (virtual threads)`);
      },
      error: err => {
        this.aggregateError.set(httpError(err));
        this.aggregateLoading.set(false);
      }
    });
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  createCustomer(): void {
    if (!this.newName.trim() || !this.newEmail.trim()) {
      this.createError.set('Name and email are required.');
      return;
    }
    this.createLoading.set(true);
    this.createError.set('');
    this.createSuccess.set(null);

    const key = this.useIdempotencyKey() ? this.idempotencyKey() : undefined;
    this.api.createCustomer({ name: this.newName.trim(), email: this.newEmail.trim() }, key).subscribe({
      next: c => {
        this.createSuccess.set(c);
        this.newName = '';
        this.newEmail = '';
        this.createLoading.set(false);
        this.loadCustomers();
      },
      error: err => {
        this.createError.set(httpError(err));
        this.createLoading.set(false);
      }
    });
  }

  resetIdempotencyKey(): void {
    this.idempotencyKey.set(uuid());
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
        next: r => { this.bio.set(r.bio); this.detailLoading.set(false); },
        error: err => { this.detailError.set(httpError(err)); this.detailLoading.set(false); }
      });
    } else if (tab === 'todos') {
      this.api.getCustomerTodos(c.id).subscribe({
        next: r => { this.todos.set(r); this.detailLoading.set(false); },
        error: err => { this.detailError.set(httpError(err)); this.detailLoading.set(false); }
      });
    } else if (tab === 'enrich') {
      this.api.enrichCustomer(c.id).subscribe({
        next: r => { this.enriched.set(r); this.detailLoading.set(false); },
        error: err => { this.detailError.set(httpError(err)); this.detailLoading.set(false); }
      });
    }
  }

  closeDetail(): void {
    this.selectedCustomer.set(null);
  }
}

function httpError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e.status === 401) return 'Not authenticated — please sign in.';
  if (e.status === 429) return '429 Too Many Requests — rate limit exceeded.';
  if (e.status === 504) return '504 Gateway Timeout — Kafka reply timed out (5 s).';
  return `Error ${e.status ?? '?'}: ${e.message ?? 'unknown'}`;
}
