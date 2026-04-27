/**
 * Unit tests for the pure helpers in `churn-insights-helpers.ts`.
 *
 * Same pattern as `customers-helpers.spec.ts` — the helpers are
 * Angular-free, so we don't need TestBed / DI / signals to exercise
 * them. This keeps the test fast (< 50 ms) and untangled from the
 * component's HTTP path (covered by the cross-language smoke test
 * in Phase G).
 */
import { canSubmitChurnSearch, formatProbability, riskClass } from './churn-insights-helpers';

describe('churn-insights-helpers', () => {
  describe('riskClass()', () => {
    it('maps each band to its lowercase css token', () => {
      expect(riskClass('LOW')).toBe('risk-low');
      expect(riskClass('MEDIUM')).toBe('risk-medium');
      expect(riskClass('HIGH')).toBe('risk-high');
    });
  });

  describe('formatProbability()', () => {
    it('formats with 1 decimal + non-breaking space', () => {
      expect(formatProbability(0.731)).toBe('73.1 %');
      expect(formatProbability(0.05)).toBe('5.0 %');
      expect(formatProbability(1.0)).toBe('100.0 %');
      expect(formatProbability(0.0)).toBe('0.0 %');
    });

    it('clamps display precision so 1e-6 cross-language noise stays invisible', () => {
      // The cross-language inference contract (ADR-0060 §"Verification
      // protocol") permits up to 1e-6 absolute drift between Java and
      // Python. The user must NOT see that as "73.1000000001 %".
      expect(formatProbability(0.731000001)).toBe('73.1 %');
      expect(formatProbability(0.7310009)).toBe('73.1 %');
    });
  });

  describe('canSubmitChurnSearch()', () => {
    it('rejects null + undefined-shaped inputs', () => {
      expect(canSubmitChurnSearch(null)).toBe(false);
    });

    it('rejects ids below 1 (404 territory on the backend)', () => {
      expect(canSubmitChurnSearch(0)).toBe(false);
      expect(canSubmitChurnSearch(-3)).toBe(false);
    });

    it('rejects non-finite values (NaN, Infinity)', () => {
      // Both come through `parseInt` failures and signal-level
      // mishaps. The submit handler relies on this to avoid issuing
      // a malformed POST to the backend.
      expect(canSubmitChurnSearch(Number.NaN)).toBe(false);
      expect(canSubmitChurnSearch(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('accepts any positive finite id', () => {
      expect(canSubmitChurnSearch(1)).toBe(true);
      expect(canSubmitChurnSearch(42)).toBe(true);
      expect(canSubmitChurnSearch(1_000_000)).toBe(true);
    });
  });
});
