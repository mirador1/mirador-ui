/**
 * SecurityComponent — Interactive security vulnerability demos.
 *
 * Tabs:
 * - Mechanisms: overview of all production security mechanisms in this project
 * - SQL Injection: vulnerable vs safe query comparison (OWASP A03)
 * - XSS: unescaped HTML vs escaped version (OWASP A07)
 * - CORS: policy explanation from backend
 * - IDOR: Broken Object Level Authorization demo (OWASP A01)
 * - JWT: decode and inspect the current access token
 * - Headers: verify OWASP security headers on live response
 *
 * Vulnerable endpoints are permit-all (no auth required).
 */
import { Component, OnDestroy, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { JsonPipe, KeyValuePipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EnvService } from '../../../core/env/env.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/toast/toast.service';
import {
  AUDIT_ACTIONS,
  type SecurityTab,
  type AuditEvent,
  type AuditPage,
  type SqliResult,
  type CorsInfo,
  type HeaderMeta,
  type IdorResult,
  type JwtClaims,
} from './security-types';
import { SecurityMechanismsTabComponent } from './widgets/security-mechanisms-tab.component';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, JsonPipe, KeyValuePipe, DatePipe, SecurityMechanismsTabComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /**
   * DestroyRef used by `takeUntilDestroyed()` on every HTTP subscribe to
   * stop the post-destroy `signal.set()` callback (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);
  activeTab = signal<SecurityTab>('mechanisms');

  // ── SQL Injection ──────────────────────────────────────────────────────────
  sqliName = signal(`Alice' OR '1'='1`);
  sqliVulnResult = signal<SqliResult | null>(null);
  sqliSafeResult = signal<SqliResult | null>(null);
  sqliLoading = signal(false);
  sqliError = signal('');

  // ── XSS ───────────────────────────────────────────────────────────────────
  xssName = signal(`<img src=x onerror=alert('XSS')>`);
  xssVulnHtml = signal<string | null>(null);
  xssSafeHtml = signal<SafeHtml | null>(null);
  xssSafeRaw = signal<string | null>(null); // raw server response (HTML-encoded entities)
  xssLoading = signal(false);
  xssError = signal('');
  xssMode = signal<'none' | 'vulnerable' | 'safe'>('none');

  // ── CORS ──────────────────────────────────────────────────────────────────
  corsInfo = signal<CorsInfo | null>(null);
  corsLoading = signal(false);
  corsError = signal('');

  // ── IDOR ──────────────────────────────────────────────────────────────────
  idorId = signal(1);
  idorVulnResult = signal<IdorResult | null>(null);
  idorSafeResult = signal<IdorResult | null>(null);
  idorLoading = signal(false);
  idorError = signal('');

  // ── JWT ───────────────────────────────────────────────────────────────────
  jwtHeader = signal<Record<string, unknown> | null>(null);
  jwtPayload = signal<JwtClaims | null>(null);
  jwtError = signal('');
  jwtExpired = signal(false);
  jwtSecondsLeft = signal(0);

  // ── Security Headers ──────────────────────────────────────────────────────
  headersResult = signal<HeaderMeta[]>([]);
  headersLoading = signal(false);
  headersError = signal('');

  // ── Audit Trail ───────────────────────────────────────────────────────────
  readonly auditActions = AUDIT_ACTIONS;
  auditFilterAction = signal('');
  auditFilterUser = signal('');
  auditPage = signal(0);
  auditData = signal<AuditPage | null>(null);
  auditLoading = signal(false);
  auditError = signal('');
  readonly auditTotalPages = computed(() => this.auditData()?.totalPages ?? 1);
  readonly auditTotalElements = computed(() => this.auditData()?.totalElements ?? 0);
  private _auditTimer: ReturnType<typeof setInterval> | null = null;

  // ── Tab switch ────────────────────────────────────────────────────────────
  setTab(tab: SecurityTab): void {
    this.activeTab.set(tab);
    if (tab === 'cors' && !this.corsInfo()) this.loadCors();
    if (tab === 'jwt') this.decodeJwt();
    if (tab === 'headers' && !this.headersResult().length) this.loadHeaders();
    if (tab === 'audit' && !this._auditTimer) {
      this.loadAudit();
      this._auditTimer = setInterval(() => this.loadAudit(), 30_000);
    }
    if (tab !== 'audit' && this._auditTimer) {
      clearInterval(this._auditTimer);
      this._auditTimer = null;
    }
  }

  // ngOnInit removed — audit auto-refresh starts on tab activation via setTab(), not on init.

  ngOnDestroy(): void {
    if (this._auditTimer) {
      clearInterval(this._auditTimer);
      this._auditTimer = null;
    }
  }

  // ── SQL Injection ──────────────────────────────────────────────────────────
  runSqliVulnerable(): void {
    const base = this.env.baseUrl();
    this.sqliLoading.set(true);
    this.sqliError.set('');
    this.sqliVulnResult.set(null);
    this.http
      .get<SqliResult>(`${base}/demo/security/sqli-vulnerable`, {
        params: { name: this.sqliName() },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.sqliVulnResult.set(r);
          this.sqliLoading.set(false);
        },
        error: (e) => {
          this.sqliError.set(`Error ${e.status}: ${e.message}`);
          this.sqliLoading.set(false);
        },
      });
  }

  runSqliSafe(): void {
    const base = this.env.baseUrl();
    this.sqliLoading.set(true);
    this.sqliError.set('');
    this.sqliSafeResult.set(null);
    this.http
      .get<SqliResult>(`${base}/demo/security/sqli-safe`, { params: { name: this.sqliName() } })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.sqliSafeResult.set(r);
          this.sqliLoading.set(false);
        },
        error: (e) => {
          this.sqliError.set(`Error ${e.status}: ${e.message}`);
          this.sqliLoading.set(false);
        },
      });
  }

  sqliResultRows(result: SqliResult | null): unknown[] {
    return result?.results ?? [];
  }

  // ── XSS ───────────────────────────────────────────────────────────────────
  runXssVulnerable(): void {
    const base = this.env.baseUrl();
    this.xssLoading.set(true);
    this.xssError.set('');
    this.xssMode.set('none');
    this.http
      .get(`${base}/demo/security/xss-vulnerable`, {
        params: { name: this.xssName() },
        responseType: 'text',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (html) => {
          this.xssVulnHtml.set(html);
          this.xssSafeHtml.set(null);
          this.xssMode.set('vulnerable');
          this.xssLoading.set(false);
        },
        error: (e) => {
          this.xssError.set(`Error ${e.status}: ${e.message}`);
          this.xssLoading.set(false);
        },
      });
  }

  runXssSafe(): void {
    const base = this.env.baseUrl();
    this.xssLoading.set(true);
    this.xssError.set('');
    this.xssMode.set('none');
    this.http
      .get(`${base}/demo/security/xss-safe`, {
        params: { name: this.xssName() },
        responseType: 'text',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (html) => {
          this.xssVulnHtml.set(null);
          this.xssSafeRaw.set(html);
          this.xssSafeHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
          this.xssMode.set('safe');
          this.xssLoading.set(false);
        },
        error: (e) => {
          this.xssError.set(`Error ${e.status}: ${e.message}`);
          this.xssLoading.set(false);
        },
      });
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  loadCors(): void {
    const base = this.env.baseUrl();
    this.corsLoading.set(true);
    this.corsError.set('');
    this.http
      .get<CorsInfo>(`${base}/demo/security/cors-info`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.corsInfo.set(r);
          this.corsLoading.set(false);
        },
        error: (e) => {
          this.corsError.set(`Error ${e.status}: ${e.message}`);
          this.corsLoading.set(false);
        },
      });
  }

  // ── IDOR ──────────────────────────────────────────────────────────────────
  runIdorVulnerable(): void {
    const base = this.env.baseUrl();
    this.idorLoading.set(true);
    this.idorError.set('');
    this.idorVulnResult.set(null);
    this.http
      .get<IdorResult>(`${base}/demo/security/idor-vulnerable`, {
        params: { id: String(this.idorId()) },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.idorVulnResult.set(r);
          this.idorLoading.set(false);
        },
        error: (e) => {
          this.idorError.set(`Error ${e.status}: ${e.message}`);
          this.idorLoading.set(false);
        },
      });
  }

  runIdorSafe(): void {
    const base = this.env.baseUrl();
    this.idorLoading.set(true);
    this.idorError.set('');
    this.idorSafeResult.set(null);
    this.http
      .get<IdorResult>(`${base}/demo/security/idor-safe`, {
        params: { id: String(this.idorId()) },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.idorSafeResult.set(r);
          this.idorLoading.set(false);
        },
        error: (e) => {
          this.idorError.set(`Error ${e.status}: ${e.message}`);
          this.idorLoading.set(false);
        },
      });
  }

  // ── JWT Inspector ─────────────────────────────────────────────────────────
  decodeJwt(): void {
    const token = this.auth.token();
    this.jwtError.set('');
    this.jwtHeader.set(null);
    this.jwtPayload.set(null);
    if (!token) {
      this.jwtError.set('No JWT token found — please sign in first.');
      return;
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Not a valid JWT (expected 3 parts)');
      // Add padding required by atob for base64url strings whose length is not a multiple of 4
      const decode = (b64: string) => {
        const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
        const pad = padded.length % 4 ? '='.repeat(4 - (padded.length % 4)) : '';
        return JSON.parse(atob(padded + pad));
      };
      this.jwtHeader.set(decode(parts[0]));
      const payload = decode(parts[1]) as JwtClaims;
      this.jwtPayload.set(payload);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp) {
        this.jwtExpired.set(payload.exp < now);
        this.jwtSecondsLeft.set(Math.max(0, payload.exp - now));
      }
      const sub = String(payload['sub'] ?? '?');
      const role = String(payload['role'] ?? '?');
      const expiredLabel = this.jwtExpired() ? ' (expired)' : '';
      this.toast.show(`Token decoded — sub: ${sub}, role: ${role}${expiredLabel}`, 'success');
    } catch (e) {
      this.jwtError.set(`Failed to decode token: ${(e as Error).message}`);
    }
  }

  formatTs(epoch: number | undefined): string {
    if (!epoch) return '—';
    return new Date(epoch * 1000).toLocaleString();
  }

  jwtExpiryLabel(): string {
    if (this.jwtExpired()) return '⛔ Expired';
    const s = this.jwtSecondsLeft();
    if (s < 60) return `⚠️ Expires in ${s}s`;
    if (s < 3600) return `✅ Expires in ${Math.floor(s / 60)}min`;
    return `✅ Expires in ${Math.floor(s / 3600)}h`;
  }

  // ── Security Headers ──────────────────────────────────────────────────────
  loadHeaders(): void {
    const base = this.env.baseUrl();
    this.headersLoading.set(true);
    this.headersError.set('');
    this.http
      .get<{ headers: HeaderMeta[] }>(`${base}/demo/security/headers`, { observe: 'response' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          const expected = resp.body?.headers ?? [];
          const actual = expected.map((h) => {
            const actualValue = resp.headers.get(h.name) ?? '(not present)';
            const ok =
              h.expected === 'not set (HTTP dev environment)'
                ? actualValue === '(not present)'
                : actualValue !== '(not present)';
            return { ...h, actual: actualValue, ok };
          });
          this.headersResult.set(actual);
          this.headersLoading.set(false);
        },
        error: (e) => {
          this.headersError.set(`Error ${e.status}: ${e.message}`);
          this.headersLoading.set(false);
        },
      });
  }

  // ── Audit ─────────────────────────────────────────────────────────────────
  loadAudit(): void {
    this.auditLoading.set(true);
    this.auditError.set('');
    const token = this.auth.token();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const params: Record<string, string> = { page: String(this.auditPage()), size: '20' };
    if (this.auditFilterAction()) params['action'] = this.auditFilterAction();
    if (this.auditFilterUser()) params['user'] = this.auditFilterUser();
    this.http
      .get<AuditPage>(`${this.env.baseUrl()}/audit`, { headers, params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p: AuditPage) => {
          this.auditData.set(p);
          this.auditLoading.set(false);
        },
        error: (e) => {
          this.auditError.set(`Error ${e.status}: ${e.message}`);
          this.auditLoading.set(false);
        },
      });
  }

  applyAuditFilters(): void {
    this.auditPage.set(0);
    this.loadAudit();
  }
  auditPrevPage(): void {
    if (this.auditPage() > 0) {
      this.auditPage.update((p) => p - 1);
      this.loadAudit();
    }
  }
  auditNextPage(): void {
    if (this.auditPage() < this.auditTotalPages() - 1) {
      this.auditPage.update((p) => p + 1);
      this.loadAudit();
    }
  }

  auditBadgeClass(action: string): string {
    if (action === 'LOGIN_BLOCKED') return 'badge-red';
    if (action.startsWith('LOGIN') || action === 'TOKEN_REFRESH' || action === 'API_KEY_AUTH')
      return 'badge-blue';
    if (action.startsWith('CUSTOMER')) return 'badge-green';
    return 'badge-gray';
  }
}
