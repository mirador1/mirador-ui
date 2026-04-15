/**
 * AuditComponent — Paginated table of backend audit events.
 *
 * Features:
 * - Fetches GET /audit with pagination (20/page)
 * - Filter by action (dropdown) and user (text input)
 * - Auto-refresh every 30 seconds
 * - Colored action badges by category: auth=blue, customer=green, blocked=red
 */
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';

/**
 * A single audit event row from `GET /audit`.
 * Records who did what, from which IP, and when.
 */
interface AuditEvent {
  /** Server-assigned primary key. */
  id: number;
  /** Username of the user who triggered the event. */
  userName: string;
  /** Action type enum string (e.g., `'LOGIN_SUCCESS'`, `'CUSTOMER_DELETED'`). */
  action: string;
  /** Human-readable event detail. */
  detail: string;
  /** Client IP address recorded at the time of the request. */
  ipAddress: string;
  /** ISO-8601 timestamp of the event. */
  createdAt: string;
}

/** Spring Data Page wrapper for paginated audit event responses. */
interface AuditPage {
  content: AuditEvent[];
  /** Zero-based current page index. */
  page: number;
  /** Page size requested. */
  size: number;
  /** Total number of events matching the current filter. */
  totalElements: number;
  /** Total number of pages. */
  totalPages: number;
}

/**
 * Allowed action filter values for the audit event dropdown.
 * Used both for the UI dropdown options and the `?action=` query parameter.
 */
const ACTION_VALUES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_BLOCKED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_DELETED',
  'TOKEN_REFRESH',
  'API_KEY_AUTH',
] as const;

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
})
export class AuditComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  /** Available action filter values for the filter dropdown. */
  readonly actions = ACTION_VALUES;

  // ── Filter state ──────────────────────────────────────────────────────────

  /** Signal: currently selected action filter. Empty string means no filter (all actions). */
  filterAction = signal<string>('');

  /** Signal: username substring filter. Empty means no filter. */
  filterUser = signal<string>('');

  /** Signal: zero-based current page index for pagination. */
  currentPage = signal(0);

  // ── Data state ────────────────────────────────────────────────────────────

  /** Signal: the current page of audit events. Null until first load. */
  data = signal<AuditPage | null>(null);

  /** Signal: true while a fetch request is in flight. */
  loading = signal(false);

  /** Signal: error message if the last fetch failed. */
  error = signal('');

  /** Computed: total page count, derived from the data signal. */
  readonly totalPages = computed(() => this.data()?.totalPages ?? 1);

  /** Computed: total event count matching the current filter. */
  readonly totalElements = computed(() => this.data()?.totalElements ?? 0);

  /** Handle for the 30-second auto-refresh `setInterval`. Cleared in `ngOnDestroy`. */
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this._refreshTimer = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy(): void {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const base = this.env.baseUrl();
    const token = this.auth.token();
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();

    const params: Record<string, string> = {
      page: String(this.currentPage()),
      size: '20',
    };
    if (this.filterAction()) params['action'] = this.filterAction();
    if (this.filterUser()) params['user'] = this.filterUser();

    this.http.get<AuditPage>(`${base}/audit`, { headers, params }).subscribe({
      next: (p) => {
        this.data.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(`Error ${err.status ?? '?'}: ${err.message ?? 'unknown'}`);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(0);
    this.load();
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update((p) => p + 1);
      this.load();
    }
  }

  /** Badge CSS class by action category */
  badgeClass(action: string): string {
    if (action === 'LOGIN_BLOCKED') return 'badge-red';
    if (action.startsWith('LOGIN') || action === 'TOKEN_REFRESH' || action === 'API_KEY_AUTH')
      return 'badge-blue';
    if (action.startsWith('CUSTOMER')) return 'badge-green';
    return 'badge-gray';
  }
}
