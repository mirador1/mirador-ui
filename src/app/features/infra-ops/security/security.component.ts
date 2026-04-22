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

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, JsonPipe, KeyValuePipe, DatePipe],
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

  readonly mechanisms = [
    {
      category: '🔐 Authentication',
      items: [
        {
          name: 'JWT (local)',
          status: 'active',
          description:
            'Stateless tokens signed with HMAC-SHA256. Issued by POST /auth/login, carry sub (username) and role claims. Validated on every request by JwtAuthenticationFilter before Spring Security authorization runs.',
          config: 'jwt.secret in application.yml, 1h expiry, refresh token with 7d expiry',
        },
        {
          name: 'Refresh tokens',
          status: 'active',
          description:
            'When an access token expires (401), the Angular auth interceptor silently calls POST /auth/refresh. If refresh succeeds, the original request is retried with the new token. Concurrent 401s are queued behind one refresh call.',
          config: 'AuthInterceptor, BehaviorSubject queue pattern, EMPTY on refresh failure',
        },
        {
          name: 'Keycloak OAuth2/OIDC',
          status: 'optional',
          description:
            'Same JwtAuthenticationFilter also validates Keycloak-issued JWTs via JwtDecoder (JWKS endpoint). Roles extracted from realm_access.roles claim. Both auth modes coexist without filter conflicts.',
          config: 'KEYCLOAK_URL env var activates it. Pre-configured realm on port 9090.',
        },
        {
          name: 'API Key',
          status: 'active',
          description:
            'Static API key via X-API-Key header. Validated by ApiKeyAuthenticationFilter before the JWT filter. Logged as API_KEY_AUTH in the audit trail. Useful for server-to-server calls without a user session.',
          config: 'api.key in application.yml',
        },
      ],
    },
    {
      category: '🛂 Authorization',
      items: [
        {
          name: 'Role-based access control (RBAC)',
          status: 'active',
          description:
            'Two roles: ROLE_USER (read) and ROLE_ADMIN (write). Enforced at two levels: HTTP layer in SecurityConfig (requestMatchers) and method level with @PreAuthorize annotations on service methods.',
          config: 'POST/PUT/DELETE /customers → ROLE_ADMIN. GET → ROLE_USER or ROLE_ADMIN.',
        },
        {
          name: '@PreAuthorize',
          status: 'active',
          description:
            'Method-level security via @EnableMethodSecurity. Service methods annotated with @PreAuthorize("hasRole(\'ADMIN\')") so authorization is enforced even if the HTTP layer is bypassed (e.g. internal calls).',
          config: '@EnableMethodSecurity on SecurityConfig',
        },
      ],
    },
    {
      category: '🚦 Rate Limiting',
      items: [
        {
          name: 'Bucket4j',
          status: 'active',
          description:
            'Token bucket algorithm — 100 requests per minute per IP address. Excess requests return HTTP 429 Too Many Requests with Retry-After and X-Rate-Limit-Retry-After-Seconds headers. IP extracted from X-Forwarded-For (proxy-aware).',
          config:
            'RateLimitInterceptor, in-memory ConcurrentHashMap of buckets, 100 tokens refilled each 60s',
        },
      ],
    },
    {
      category: '🔁 Idempotency',
      items: [
        {
          name: 'Idempotency-Key header',
          status: 'active',
          description:
            'Clients send a unique Idempotency-Key with POST/PUT requests. The backend stores the key in Redis with a 24h TTL. Duplicate requests with the same key return the cached response (200) without re-executing. LRU cache of 10,000 entries.',
          config: 'IdempotencyFilter, Redis SETEX, key format: <method>:<path>:<key>',
        },
      ],
    },
    {
      category: '🏷️ Security Headers',
      items: [
        {
          name: 'SecurityHeadersFilter',
          status: 'active',
          description:
            'OncePerRequestFilter sets OWASP-recommended headers on every response: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection: 0, Referrer-Policy, Content-Security-Policy, Permissions-Policy. Swagger UI excluded from CSP (needs inline scripts).',
          config: 'SecurityHeadersFilter.java, applied globally before response is committed',
        },
      ],
    },
    {
      category: '🌐 CORS',
      items: [
        {
          name: 'CORS restriction',
          status: 'active',
          description:
            'Only explicitly allowed origins can make cross-origin requests. Configured with allowedOrigins from cors.allowed-origins property (default: http://localhost:4200). allowCredentials: true — cookies/auth headers are forwarded. Does NOT use wildcard *.',
          config:
            'cors.allowed-origins in application.yml, CorsConfigurationSource bean in SecurityConfig',
        },
      ],
    },
    {
      category: '🔍 Audit Trail',
      items: [
        {
          name: 'AuditService',
          status: 'active',
          description:
            'All security-sensitive events are logged asynchronously to the audit_event table: LOGIN_SUCCESS, LOGIN_FAILED (with remaining attempts), LOGIN_BLOCKED, TOKEN_REFRESH, API_KEY_AUTH, CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_DELETED. Includes username, IP, timestamp, and detail.',
          config: '@Async audit writes, AuditController GET /audit with pagination + filters',
        },
      ],
    },
    {
      category: '🔒 Input Validation',
      items: [
        {
          name: 'Bean Validation',
          status: 'active',
          description:
            'Request bodies validated with jakarta.validation annotations (@NotBlank, @Email, @Size). Invalid requests return 400 Bad Request with field-level error messages. Parameterized queries prevent SQL injection on all production endpoints.',
          config: '@Valid on @RequestBody, MethodArgumentNotValidException handler',
        },
      ],
    },
    {
      category: '🔑 Secrets',
      items: [
        {
          name: 'Environment variables',
          status: 'active',
          description:
            'All secrets (JWT secret, DB password, API key, Kafka credentials) are injected via environment variables or Docker secrets — never hardcoded in source. Spring Boot @Value bindings read from application.yml which references ${ENV_VAR:default}.',
          config:
            'DB_PASSWORD, JWT_SECRET, API_KEY env vars. .env file for local dev (gitignored).',
        },
      ],
    },
  ];
}
