/**
 * database-types.ts — types used by `database.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-7 file-length hygiene (same pattern
 * as `quality-types.ts`, `diagnostic-types.ts`, `customers-types.ts`,
 * `security-types.ts`). Pure types with zero runtime — keeps the
 * component file focused on signals + behaviour.
 */

/** Active tab in the Database page explorer. */
export type DbTab =
  | 'health'
  | 'customer'
  | 'diagnostics'
  | 'schema'
  | 'investigation'
  | 'performance';

/**
 * Shape returned by the pgweb REST API (`GET /api/query`) for SQL execution.
 * Rows contain mixed primitive types (number, string, boolean, null) from PostgreSQL.
 * The `error` field is set when the SQL fails or pgweb is unreachable.
 */
export interface SqlQueryResult {
  /** Column names from the SELECT result set. */
  columns?: string[];
  /** Row data as a 2D array indexed `[row][column]`. */
  rows?: unknown[][];
  /** Error message from pgweb or the proxy if the query failed. */
  error?: string;
}

/**
 * Shape returned by the Spring Boot `/actuator/maintenance` custom endpoint.
 * Called when the user triggers a VACUUM operation from the Health tab.
 */
export interface MaintenanceResult {
  /** The operation type that was executed (e.g., `'vacuum'`, `'vacuumFull'`). */
  operation: string;
  /** How long the maintenance operation took in milliseconds. */
  durationMs: number;
  /** Result status string (e.g., `'OK'`). */
  status: string;
}

/**
 * Definition of a database health check displayed in the Health tab.
 * Each check runs a read-only SQL query via pgweb and evaluates the result.
 */
export interface HealthCheck {
  /** Unique string identifier for this check (used as a React-style key). */
  id: string;
  /** Display label shown as the check's heading. */
  label: string;
  /** Tooltip description explaining what the check measures. */
  description: string;
  /** The SQL query to execute against PostgreSQL via pgweb. */
  query: string;
  /**
   * Evaluate the first row's first value and return a traffic-light status.
   * @param rows Result rows from the SQL query.
   * @returns Status (`'ok'`=green, `'warn'`=orange, `'crit'`=red) with a detail message.
   */
  evaluate: (rows: string[][]) => { status: 'ok' | 'warn' | 'crit'; detail: string };
}
