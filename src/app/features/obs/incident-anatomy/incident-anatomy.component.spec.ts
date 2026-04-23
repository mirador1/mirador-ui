/**
 * Unit tests for IncidentAnatomyComponent — the read-only "anatomy of an
 * outage" timeline. No interactivity, so the test surface is the data
 * structure (the steps array) + the contracts a future content edit
 * could silently break.
 *
 * Pinned contracts:
 *   - 6 steps shipped (the canonical Ollama-circuit-breaker outage script)
 *   - Each step carries the 5 required TimelineStep fields (t/icon/title/
 *     observation/action) — a missing field would render an empty card
 *   - Steps in chronological order (T+0 → T+30s → T+1m → T+2m → T+3m → T+5m)
 *   - The 't' offset format matches /T\+\d+\s?[smh]?/ so any future addition
 *     stays consistent with the visual rhythm
 *   - Optional fields (snippet, links) — when present, they're well-formed
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { IncidentAnatomyComponent } from './incident-anatomy.component';

// eslint-disable-next-line max-lines-per-function
describe('IncidentAnatomyComponent', () => {
  let component: IncidentAnatomyComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    component = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => new IncidentAnatomyComponent(),
    );
  });

  describe('steps array — the canonical outage script', () => {
    it('ships exactly 6 steps (the chosen Ollama-circuit-breaker timeline)', () => {
      // Pinned: the script is intentionally 6 steps — short enough for a
      // 60-second read (per the file header), long enough to cover the
      // full alert → triage → fix → confirmation loop. Adding/removing
      // a step is a deliberate UX change; this test catches accidental
      // drift.
      expect(component.steps).toHaveLength(6);
    });

    it('every step has the 5 required TimelineStep fields populated', () => {
      // Pinned: each field renders into a distinct DOM node. A missing
      // field would surface as an empty heading or a blank paragraph,
      // breaking the visual rhythm of the timeline. TypeScript catches
      // this at compile-time, but a future "as TimelineStep" hack could
      // bypass it — this test enforces the runtime invariant.
      for (const step of component.steps) {
        expect(step.t).toBeTruthy();
        expect(step.icon).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.observation).toBeTruthy();
        expect(step.action).toBeTruthy();
      }
    });

    it('time offsets follow chronological order T+0 → T+30s → T+1m → ... → T+5m', () => {
      // Pinned: the timeline reads top-to-bottom in real time. A
      // regression that reorders the array would silently flip the
      // narrative ("recovery before alert"). Parsing the 't' string
      // and verifying monotonic increase is the integrity check.
      const seconds = component.steps.map((s) => parseTOffsetSeconds(s.t));
      for (let i = 1; i < seconds.length; i++) {
        expect(seconds[i]).toBeGreaterThan(seconds[i - 1]);
      }
    });

    it('each "t" field matches the /T\\+\\d+\\s?[smh]?/ pattern', () => {
      // Pinned: the visual format ("T+3 m", "T+30 s") is part of the
      // page's identity. Free-form values ("approx 3 min later") would
      // make the timeline column ragged.
      const tPattern = /^T\+\d+\s?[smh]?$/;
      for (const step of component.steps) {
        expect(step.t).toMatch(tPattern);
      }
    });

    it('first step is T+0 (the alert fire — entrypoint into the timeline)', () => {
      // Pinned: the timeline starts at the alert moment, not earlier
      // (the lead-up is implicit). A regression that moves the alert
      // step out of position 0 would lose the "this is when the
      // operator first knows something's wrong" anchor.
      expect(component.steps[0].t).toBe('T+0 s');
      expect(component.steps[0].title.toLowerCase()).toContain('alert');
    });

    it('last step is the recovery confirmation (the timeline closes)', () => {
      // Pinned: the timeline ENDS on a positive resolution, not on a
      // hanging investigation step. A reader walks away with "the loop
      // closed". A regression that moves the recovery step earlier
      // would leave the page ending on diagnosis.
      const last = component.steps[component.steps.length - 1];
      expect(last.title.toLowerCase()).toContain('recovery');
    });
  });

  describe('optional fields integrity', () => {
    it('every snippet (when present) carries both label + code', () => {
      // Pinned: the snippet is rendered as `<pre><code>` with the
      // label as the caption. Either field missing would produce a
      // half-rendered code block.
      const stepsWithSnippet = component.steps.filter((s) => s.snippet);
      expect(stepsWithSnippet.length).toBeGreaterThan(0); // sanity: at least 1
      for (const step of stepsWithSnippet) {
        expect(step.snippet!.label).toBeTruthy();
        expect(step.snippet!.code).toBeTruthy();
      }
    });

    it('every link (when present) carries both label + non-empty url', () => {
      // Pinned: link rendering uses `<a [href]>label</a>`. Empty URL
      // produces a non-clickable anchor (would NOT throw but visually
      // broken). Empty label produces a click-target with no visible
      // text — accessibility regression.
      const stepsWithLinks = component.steps.filter((s) => s.links && s.links.length > 0);
      expect(stepsWithLinks.length).toBeGreaterThan(0); // at least 1
      for (const step of stepsWithLinks) {
        for (const link of step.links!) {
          expect(link.label).toBeTruthy();
          expect(link.url).toBeTruthy();
          // URL must look like a path or http(s) URL — not garbage
          expect(link.url).toMatch(/^(https?:\/\/|\/|docs\/|\.\/|\.\.\/).+/);
        }
      }
    });
  });

  describe('content invariants — the chosen narrative', () => {
    it('mentions the chosen Ollama outage pattern (not a generic 5xx story)', () => {
      // Pinned: the file header explicitly chose the Ollama-circuit-
      // breaker outage as the most illustrative for a demo audience.
      // A regression to a generic story would lose the "fallback +
      // recovery + Pyroscope wall-clock" specificity that makes the
      // page educational.
      const fullText = component.steps
        .map((s) => `${s.title} ${s.observation} ${s.action}`)
        .join(' ');
      // At least one mention of Ollama (the outage source)
      expect(fullText.toLowerCase()).toContain('ollama');
      // At least one mention of the circuit breaker (the recovery mechanism)
      expect(fullText.toLowerCase()).toContain('circuit');
    });
  });
});

/**
 * Parse the 't' field ("T+30 s", "T+3 m", "T+0 s", "T+5 m") into seconds
 * for chronological comparison.
 */
function parseTOffsetSeconds(t: string): number {
  const match = t.match(/^T\+(\d+)\s?([smh]?)$/);
  if (!match) throw new Error(`Unparseable t: ${t}`);
  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';
  return value * (unit === 'm' ? 60 : unit === 'h' ? 3600 : 1);
}
