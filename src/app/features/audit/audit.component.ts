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

interface AuditEvent {
  id: number;
  userName: string;
  action: string;
  detail: string;
  ipAddress: string;
  createdAt: string;
}

interface AuditPage {
  content: AuditEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

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

  readonly actions = ACTION_VALUES;

  // ── Filter state ──────────────────────────────────────────────────────────
  filterAction = signal<string>('');
  filterUser = signal<string>('');
  currentPage = signal(0);

  // ── Data state ────────────────────────────────────────────────────────────
  data = signal<AuditPage | null>(null);
  loading = signal(false);
  error = signal('');

  readonly totalPages = computed(() => this.data()?.totalPages ?? 1);
  readonly totalElements = computed(() => this.data()?.totalElements ?? 0);

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
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();

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
    if (action.startsWith('LOGIN') || action === 'TOKEN_REFRESH' || action === 'API_KEY_AUTH') return 'badge-blue';
    if (action.startsWith('CUSTOMER')) return 'badge-green';
    return 'badge-gray';
  }
}
