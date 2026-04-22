/**
 * chaos-types.ts — types used by `chaos.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-7 file-length hygiene. Same pattern
 * as `quality-types.ts`, `diagnostic-types.ts`, `customers-types.ts`,
 * `security-types.ts`, `database-types.ts`.
 */

/**
 * Definition of a single chaos engineering action shown as a button in the UI.
 * The `action` callback performs the actual HTTP calls when the button is clicked.
 */
export interface ChaosAction {
  /** Short label displayed on the button. */
  name: string;
  /** Explanation of what the action does and which backend behavior it triggers. */
  description: string;
  /** Emoji icon displayed on the button for quick visual identification. */
  icon: string;
  /** CSS color string for the button border/glow effect. */
  color: string;
  /** Callback executed when the user clicks the action button. */
  action: () => void;
}

/**
 * A single impact monitoring sample from the 2-second health poll.
 * Used to build the live stacked bar chart (OK vs errors over time).
 */
export interface ImpactSample {
  /** Wall-clock time of this sample. */
  time: Date;
  /** Number of health probe requests that returned 2xx in this sample. */
  ok: number;
  /** Number of health probe requests that returned non-2xx in this sample. */
  errors: number;
  /** Average response latency in milliseconds across all probes in this sample. */
  avgMs: number;
}
