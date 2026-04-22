// diagnostic-types.ts — TypeScript interfaces used by the Diagnostic page.
// Extracted 2026-04-22 from diagnostic.component.ts under Phase B-7
// (file-length hygiene). Now exported so future sub-components can
// reuse them without re-declaring.

export interface ScheduledJob {
  /** Spring `@Scheduled` method name used as the ShedLock name. */
  name: string;
  /** ISO-8601 timestamp until which the lock is held. Null when unlocked. */
  lockUntil: string | null;
  /** ISO-8601 timestamp when the lock was acquired. */
  lockedAt: string | null;
  /** Hostname of the node that acquired the lock. */
  lockedBy: string | null;
}

/**
 * A single HTTP request in the waterfall visualization.
 * Timings are relative to the first request's start so bars can be positioned on the same timeline.
 */
export interface WaterfallEntry {
  /** HTTP method (e.g., `'GET'`, `'POST'`). */
  method: string;
  /** Request URI path. */
  uri: string;
  /** HTTP response status code. */
  status: number;
  /** Start time offset in milliseconds from the waterfall reference point. */
  startMs: number;
  /** Duration of the request in milliseconds. */
  durationMs: number;
}

/**
 * One flow in the Sankey diagram: an endpoint path leading to an HTTP status.
 * Flows are built from Prometheus `http_server_requests_seconds_count` counters.
 */
export interface SankeyFlow {
  /** Source node label (e.g., `'/customers'`). */
  from: string;
  /** Destination node label (e.g., `'200'`, `'429'`). */
  to: string;
  /** Request count for this endpoint/status combination. */
  value: number;
  /** CSS color string for the flow ribbon — derived from the HTTP status family. */
  color: string;
}

/**
 * A single line in the JSON version-diff view comparing v1 vs v2 API responses.
 * Lines are colored green (add), red (remove), or neutral (same).
 */
export interface DiffLine {
  /** Diff type: `'same'` = unchanged, `'add'` = in v2 only, `'remove'` = in v1 only. */
  type: 'same' | 'add' | 'remove';
  /** The formatted JSON text for this line (indented). */
  text: string;
}

/**
 * Per-second throughput sample collected during a stress test run.
 * Used to render the live SVG bar chart in the stress test section.
 */
export interface StressSample {
  /** Second number within the stress test (1-based). */
  second: number;
  /** Number of 2xx responses received in this second. */
  ok: number;
  /** Number of non-2xx or error responses in this second. */
  err: number;
}

/**
 * A single line in the terminal-style diagnostic output panel.
 * Kind determines the color: req=blue, res=green, err=red, info=gray.
 */
export interface LogLine {
  /** Log line type used for CSS class selection in the template. */
  kind: 'req' | 'res' | 'err' | 'info';
  /** Text content of the log line, including the `[HH:MM:SS.mmm]` timestamp prefix. */
  text: string;
}

/**
 * A persisted record of a completed diagnostic scenario run.
 * Kept in the in-memory history list (last 50 entries) and exportable as JSON.
 */
export interface RunRecord {
  /** Human-readable scenario name (e.g., `'API Versioning'`). */
  scenario: string;
  /** Wall-clock time when the run completed. */
  timestamp: Date;
  /** Full log output from the run. */
  logs: LogLine[];
  /** Total elapsed time in milliseconds. */
  durationMs: number;
}
