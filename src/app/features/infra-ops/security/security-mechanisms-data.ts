/**
 * Static catalogue of production-active security mechanisms in Mirador.
 *
 * Each entry documents WHAT mechanism is in place + WHERE it lives in
 * the codebase. Read by the SecurityMechanismsTab widget to render the
 * Mechanisms tab table.
 *
 * Extracted from security.component.ts in B-7-4 follow-up (2026-04-23).
 * Pure data ; no Angular, no DI, no signals. Update this file when a
 * new security mechanism lands (e.g. new filter, new rate-limit policy).
 */

export interface SecurityMechanismItem {
  name: string;
  status: 'active' | 'optional';
  description: string;
  config: string;
}

export interface SecurityMechanismGroup {
  category: string;
  items: SecurityMechanismItem[];
}

export const SECURITY_MECHANISMS: SecurityMechanismGroup[] = [
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
        config: 'DB_PASSWORD, JWT_SECRET, API_KEY env vars. .env file for local dev (gitignored).',
      },
    ],
  },
];
