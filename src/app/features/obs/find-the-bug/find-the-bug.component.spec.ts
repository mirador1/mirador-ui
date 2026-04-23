/**
 * Unit tests for FindTheBugComponent — covers the pure / synchronous
 * surface (state readers, derived signals, reset). The async start() /
 * applyFix() / sample() paths use timers + HTTP and are skipped here:
 * RxJS marbles aren't viable in zoneless without scheduler control.
 *
 * Pinned contracts:
 *   - 3 scenarios (rate-limit, circuit-break, aggregate-storm) shipped
 *     and immutable
 *   - stateOf(unknown) defaults to 'idle' (no NPE on first render)
 *   - currentValue / peakValue safe on empty metric history (return 0)
 *   - sparkline path empty for < 2 samples (template hides the SVG)
 *   - sparkline path normalises Y to chart height (relative to the max
 *     value across samples — preserves shape independent of magnitude)
 */
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { FindTheBugComponent } from './find-the-bug.component';

interface ComponentInternals {
  scenarioState: { update: (fn: (s: Record<string, string>) => Record<string, string>) => void };
  scenarioMetrics: {
    update: (
      fn: (
        s: Record<string, { t: number; value: number }[]>,
      ) => Record<string, { t: number; value: number }[]>,
    ) => void;
  };
  scenarioSubs: Map<string, { unsubscribe: () => void }>;
  scenarioTimers: Map<string, ReturnType<typeof setTimeout>>;
}

// eslint-disable-next-line max-lines-per-function
describe('FindTheBugComponent', () => {
  let component: FindTheBugComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    component = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => new FindTheBugComponent(),
    );
  });

  describe('scenarios catalogue', () => {
    it('ships exactly 3 scenarios (rate-limit / circuit-break / aggregate-storm)', () => {
      // Pinned: the scenarios array is the public catalogue. Adding/removing
      // one is a deliberate UX change; this test catches accidental drift.
      expect(component.scenarios).toHaveLength(3);
      expect(component.scenarios.map((s) => s.id)).toEqual([
        'rate-limit',
        'circuit-break',
        'aggregate-storm',
      ]);
    });

    it('every scenario carries the required fields (icon, title, teaser, etc.)', () => {
      // Pinned: a missing field would render an empty card or NPE in the
      // template. This test enforces the BugScenario interface at runtime,
      // catching the case where TypeScript was satisfied (e.g. via `as`)
      // but the actual data is incomplete.
      for (const s of component.scenarios) {
        expect(s.id).toBeTruthy();
        expect(s.icon).toBeTruthy();
        expect(s.title).toBeTruthy();
        expect(s.teaser).toBeTruthy();
        expect(s.unit).toBeTruthy();
        expect(s.rootCause).toBeTruthy();
        expect(s.fixSteps.length).toBeGreaterThan(0);
        expect(typeof s.revealAfterMs).toBe('number');
        expect(s.revealAfterMs).toBeGreaterThan(0);
        expect(typeof s.trigger).toBe('function');
        expect(typeof s.sample).toBe('function');
        expect(typeof s.recover).toBe('function');
      }
    });

    it('reveal delays are reasonable (10-30 s) — UX pace pinned', () => {
      // Pinned: revealAfterMs IS the pacing of the page — too short and
      // the user sees the reveal before the metric chart establishes a
      // pattern (≈10 s minimum for the eye to register a trend); too
      // long and they bounce. 10-30 s is the sweet spot.
      for (const s of component.scenarios) {
        expect(s.revealAfterMs).toBeGreaterThanOrEqual(10_000);
        expect(s.revealAfterMs).toBeLessThanOrEqual(30_000);
      }
    });
  });

  describe('state readers — defensive defaults', () => {
    it('stateOf() returns "idle" for any unknown id (no NPE on first render)', () => {
      // Pinned: the template calls stateOf(scenario.id) on every render.
      // Before the first start(), the scenarioState signal is empty —
      // returning undefined would render an "undefined" badge, returning
      // "idle" (default) renders the correct initial state.
      expect(component.stateOf('rate-limit')).toBe('idle');
      expect(component.stateOf('does-not-exist')).toBe('idle');
    });

    it('metricsOf() returns empty array for any unknown id', () => {
      expect(component.metricsOf('rate-limit')).toEqual([]);
      expect(component.metricsOf('does-not-exist')).toEqual([]);
    });

    it('currentValue() returns 0 when no samples recorded yet', () => {
      // Pinned: the template displays currentValue() as the headline
      // number ("23 errors right now"). On first render with no samples,
      // 0 must be the safe default — NaN or undefined would corrupt
      // Math.max() in the chart axis computation downstream.
      expect(component.currentValue('rate-limit')).toBe(0);
    });

    it('peakValue() returns 0 when no samples recorded yet', () => {
      expect(component.peakValue('rate-limit')).toBe(0);
    });
  });

  describe('derived values from metric history', () => {
    const seedMetrics = (id: string, values: number[]) => {
      const samples = values.map((value, t) => ({ t, value }));
      const internals = component as unknown as ComponentInternals;
      internals.scenarioMetrics.update((s) => ({ ...s, [id]: samples }));
    };

    it('currentValue() returns the LAST sample value', () => {
      seedMetrics('rate-limit', [10, 20, 30]);
      expect(component.currentValue('rate-limit')).toBe(30);
    });

    it('peakValue() returns the MAX sample value (not necessarily latest)', () => {
      // Pinned: "peak so far" is the headline number once the chart is
      // populated — a regression that returned currentValue() instead
      // would underrepresent the impact when the metric drops back.
      seedMetrics('rate-limit', [10, 50, 30, 20]);
      expect(component.peakValue('rate-limit')).toBe(50);
    });

    it('sparkline() returns empty string when fewer than 2 samples', () => {
      // Pinned: a single point can't draw a line. Returning empty string
      // makes the template's [attr.d]="sparkline(id)" hide the path
      // entirely (an empty d attribute renders nothing). A single-point
      // path would draw a stray dot at the chart corner.
      expect(component.sparkline('rate-limit')).toBe('');
      seedMetrics('rate-limit', [42]);
      expect(component.sparkline('rate-limit')).toBe('');
    });

    it('sparkline() builds an SVG path with M + L commands across samples', () => {
      // Pinned: the path must start with "M" (moveto) and use "L" (lineto)
      // for subsequent points — the basic SVG line shape. A regression
      // to "M" everywhere would draw N disconnected dots.
      seedMetrics('rate-limit', [10, 20, 30]);
      const path = component.sparkline('rate-limit');

      expect(path).toMatch(/^M/);
      // Two L commands for the 2 segments after the initial M point.
      expect(path.match(/L/g)).toHaveLength(2);
    });

    it('sparkline() Y coordinates are normalised to chart height (40)', () => {
      // Pinned: the SVG viewBox is fixed at width=280, height=40 (matches
      // the template's .sparkline-svg). The path's Y values must scale
      // such that the highest sample sits at y=0 (top of chart) and the
      // lowest at y=h (bottom). A bug that forgot to invert would draw
      // the chart upside-down.
      seedMetrics('rate-limit', [0, 100]); // min and max
      const path = component.sparkline('rate-limit');

      // Sample 0 (value=0) at y=h=40 (bottom); sample 1 (value=100) at y=0 (top).
      expect(path).toMatch(/M0\.0,40\.0/);
      expect(path).toMatch(/L280\.0,0\.0/);
    });
  });

  describe('reset()', () => {
    it('resets state to idle and clears the metric history', () => {
      // Seed some state + metrics
      const internals = component as unknown as ComponentInternals;
      internals.scenarioState.update((s) => ({ ...s, 'rate-limit': 'triggered' }));
      internals.scenarioMetrics.update((s) => ({
        ...s,
        'rate-limit': [{ t: 0, value: 42 }],
      }));

      component.reset('rate-limit');

      expect(component.stateOf('rate-limit')).toBe('idle');
      expect(component.metricsOf('rate-limit')).toEqual([]);
    });

    it('cleans up the polling subscription when present', () => {
      // Pinned: leaking the interval subscription past reset() would
      // keep polling /actuator/metrics every 2 s indefinitely after
      // the user clicked "Reset" — exactly the kind of leak Phase 4.1
      // (takeUntilDestroyed wave) was meant to prevent.
      const unsub = vi.fn();
      const internals = component as unknown as ComponentInternals;
      internals.scenarioSubs.set('rate-limit', { unsubscribe: unsub });

      component.reset('rate-limit');

      expect(unsub).toHaveBeenCalledTimes(1);
      expect(internals.scenarioSubs.has('rate-limit')).toBe(false);
    });

    it('clears the reveal timer when present (no late state flip)', () => {
      // Pinned: a setTimeout firing AFTER reset() would flip the state
      // from idle back to "revealed" — the user sees the root-cause card
      // pop up out of nowhere. Cancelling the timer in reset() is the
      // contract.
      const internals = component as unknown as ComponentInternals;
      const fakeTimer = setTimeout(() => undefined, 99_999);
      internals.scenarioTimers.set('rate-limit', fakeTimer);

      component.reset('rate-limit');

      expect(internals.scenarioTimers.has('rate-limit')).toBe(false);
    });

    it('reset on an unknown id does not throw', () => {
      // Defensive: the template might call reset before any state is set
      // (rare but possible). Should be a safe no-op.
      expect(() => component.reset('does-not-exist')).not.toThrow();
    });
  });
});
