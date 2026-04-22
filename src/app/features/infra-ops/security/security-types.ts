/**
 * security-types.ts — types + constants used by `security.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-7 file-length hygiene (same pattern
 * as `quality-types.ts`, `diagnostic-types.ts`, `customers-types.ts`).
 * Pure types with zero runtime + one frozen `as const` array of action
 * names — keeps the component file focused on signals + behaviour.
 */

/** Active tab in the Security page — each maps to an OWASP vulnerability demo or overview. */
export type SecurityTab =
  | 'mechanisms'
  | 'sqli'
  | 'xss'
  | 'cors'
  | 'idor'
  | 'jwt'
  | 'headers'
  | 'audit';

/**
 * A single audit event from `GET /audit`.
 * Records authentication and data mutation events with actor and IP details.
 */
export interface AuditEvent {
  /** Server-assigned primary key. */
  id: number;
  /** Username of the actor (e.g., `'admin'`, `'anonymous'`). */
  userName: string;
  /** Event type enum value (e.g., `'LOGIN_SUCCESS'`, `'CUSTOMER_CREATED'`). */
  action: string;
  /** Human-readable detail (e.g., `'Customer ID 42 deleted'`). */
  detail: string;
  /** Client IP address of the request that triggered the event. */
  ipAddress: string;
  /** ISO-8601 timestamp when the event was recorded. */
  createdAt: string;
}

/** Paginated wrapper for the audit event list from `GET /audit`. */
export interface AuditPage {
  content: AuditEvent[];
  /** Current zero-based page index. */
  page: number;
  /** Page size. */
  size: number;
  /** Total event count across all pages. */
  totalElements: number;
  /** Total page count. */
  totalPages: number;
}

/**
 * Allowed audit action filter values.
 * Matches the `AuditEventType` enum in the Spring Boot backend.
 */
export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_BLOCKED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_DELETED',
  'TOKEN_REFRESH',
  'API_KEY_AUTH',
] as const;

/**
 * Response shape from the `/security/sqli` vulnerable endpoint.
 * Demonstrates an OWASP A03 SQL Injection vulnerability in the backend.
 */
export interface SqliResult {
  /** The actual SQL query that was executed (shown as evidence). */
  query?: string;
  /** Description of why this is vulnerable. */
  vulnerability?: string;
  /** Rows returned by the injection payload. */
  results?: unknown[];
  /** Demonstration exploit payload. */
  exploit?: string;
  /** Description of the safe parameterized-query fix. */
  fix?: string;
}

/**
 * Response from the `/security/cors` info endpoint.
 * Explains the current CORS policy and demonstrates misconfiguration risks.
 */
export interface CorsInfo {
  /** Description of the current origin policy. */
  currentOriginPolicy?: string;
  /** What a dangerously permissive config would look like. */
  dangerousConfig?: string;
  /** Risk description for open CORS. */
  risk?: string;
  /** Description of a cross-origin attack vector. */
  attack?: string;
  /** Recommended fix description. */
  fix?: string;
  /** The requesting browser's origin, reflected for demonstration. */
  yourOrigin?: string;
}

/**
 * Metadata for a single HTTP security header check.
 * Expected vs actual values are compared to produce a pass/fail status.
 */
export interface HeaderMeta {
  /** HTTP response header name (e.g., `'X-Frame-Options'`). */
  name: string;
  /** Expected value or pattern for this header. */
  expected: string;
  /** Explanation of why this header matters for security. */
  explanation: string;
  /** Actual value returned by the backend response. Populated after the check runs. */
  actual?: string;
  /** True when the actual value satisfies the expected value/pattern. */
  ok?: boolean;
}

/**
 * Response from the `/security/idor` demo endpoint.
 * Demonstrates OWASP A01 Broken Object Level Authorization.
 */
export interface IdorResult {
  /** The customer ID that was requested without authorization check. */
  requestedId?: number;
  /** Description of the vulnerability demonstrated. */
  vulnerability?: string;
  /** OWASP category reference. */
  owaspCategory?: string;
  /** Example exploit scenario. */
  exploit?: string;
  /** Description of the correct authorization fix. */
  fix?: string;
  /** Example safe SQL query with ownership check. */
  safeQuery?: string;
  /** Spring Security annotation that would prevent this exploit. */
  springAnnotation?: string;
  /** Security pattern description. */
  pattern?: string;
  /** Data returned without authorization (shown as evidence). */
  results?: unknown[];
}

/**
 * Decoded claims from the current JWT access token.
 * Extracted client-side by base64-decoding the token payload (not validated here).
 */
export interface JwtClaims {
  /** Subject claim — typically the username. */
  sub?: string;
  /** Role claim (e.g., `'ROLE_ADMIN'`). */
  role?: string;
  /** Issued-at timestamp (Unix seconds). */
  iat?: number;
  /** Expiry timestamp (Unix seconds). */
  exp?: number;
  /** Any additional custom claims in the token. */
  [key: string]: unknown;
}
