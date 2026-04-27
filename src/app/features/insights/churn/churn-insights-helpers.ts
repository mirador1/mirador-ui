/**
 * Pure helpers for the Churn Insights component.
 *
 * Extracted into a separate file so unit tests can exercise them
 * WITHOUT booting Angular's TestBed / DI compiler — same pattern
 * as `customer-helpers.ts` (Phase B-7, 2026-04-22). Keeping the
 * helpers framework-agnostic lets the cross-language smoke test
 * (Phase G of shared ADR-0061) reuse them in a Node context if
 * needed.
 */
import type { ChurnRiskBand } from '../../../core/api/api.service';

/**
 * Map a {@link ChurnRiskBand} value to its lowercase CSS modifier
 * (`risk-low` / `risk-medium` / `risk-high`). Used both on the row
 * `<tr>` and on the indicator `<span class="risk-dot">`.
 */
export function riskClass(band: ChurnRiskBand): string {
  return `risk-${band.toLowerCase()}`;
}

/**
 * Format a probability ∈ [0, 1] as a percentage with 1 decimal +
 * non-breaking space before %, e.g. ``0.731 → "73.1 %"``. Clamps
 * display precision so the 1e-6 cross-language drift permitted by
 * ADR-0060 §"Verification protocol" never surfaces as
 * "73.1000000001 %".
 */
export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)} %`;
}

/**
 * Whether a customer-id input value is submittable to the backend.
 * Centralised here so the template's `[disabled]` and the
 * submit-handler's early return stay in lockstep.
 */
export function canSubmitChurnSearch(value: number | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1;
}
