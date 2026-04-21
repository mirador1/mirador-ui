/**
 * TourService — drives the onboarding walk-through.
 *
 * First-time visitors land on the dashboard without any explanation of what
 * the sidebar groups mean, what the env selector does, or where to find the
 * observability deep-links. Rather than bolt on a big tour library (driver.js
 * adds ~20 kB gzipped and doesn't play well with zoneless Angular), we ship
 * a small signals-driven service + a single overlay component — same
 * philosophy as the raw-SVG / no-charting-lib policy elsewhere in the app.
 *
 * The tour is a static ordered list of {@link TourStep} records. Each step
 * can point at a DOM element via CSS selector (the overlay draws a
 * highlight ring around it) or render as a centred dialog when no anchor
 * makes sense (welcome + closing card).
 *
 * "Seen" state is persisted in localStorage so auto-start fires only on the
 * very first visit. The 🎓 button in the topbar calls {@link start} on
 * demand, bypassing the persistence check.
 */
import { Injectable, computed, signal } from '@angular/core';

/**
 * A single step in the tour.
 *
 * - `targetSelector` — CSS selector resolved on step entry. If the element
 *   isn't in the DOM (e.g. user is on a route that doesn't render it),
 *   the step falls back to centred rendering instead of freezing the tour.
 * - `position` — where to place the tooltip relative to the target. Default
 *   `bottom` is almost always correct for topbar + sidebar elements.
 */
export interface TourStep {
  readonly targetSelector: string | null;
  readonly title: string;
  readonly body: string;
  readonly position?: 'top' | 'bottom' | 'left' | 'right';
}

const STORAGE_KEY = 'mirador:tour:seen';

/**
 * Steps in the canonical order. Changes land here — the overlay component
 * just renders what it's given. Keep the list short (5–7) so a first-time
 * visitor doesn't abandon before finishing.
 */
const DEFAULT_STEPS: readonly TourStep[] = [
  {
    targetSelector: null,
    title: 'Welcome to Mirador 👋',
    body:
      'This is a 5-step tour of the main features. Use ← → or the buttons to navigate,' +
      ' Esc to skip. You can replay this tour any time from the 🎓 button in the top bar.',
  },
  {
    targetSelector: '.sidebar-nav',
    position: 'right',
    title: 'Sidebar — features by domain',
    body:
      'Features are grouped by theme: Customer management, Observability (Grafana/Tempo/Pyroscope/Loki),' +
      ' Ops (chaos, pipelines, infra), and Core UX (activity, settings). Admin-only entries appear only' +
      " when you're signed in with a ROLE_ADMIN account.",
  },
  {
    targetSelector: '.env-selector',
    position: 'bottom',
    title: 'Environment selector',
    body:
      'Switch between Local (docker-compose at localhost:8080) and the GKE tunnel (bin/pf-prod.sh on' +
      ' 18080). Every API call, chart, and deep-link recomputes from the current selection — no reload' +
      ' needed. The choice is remembered in localStorage.',
  },
  {
    targetSelector: '.search-btn',
    position: 'bottom',
    title: 'Fuzzy page search — Ctrl + K',
    body:
      'Open a fuzzy finder over every route in the app. Useful when the sidebar is collapsed or you' +
      " don't remember which group a feature sits in. Keyboard-only — no mouse needed once the modal's open.",
  },
  {
    targetSelector: '.theme-btn',
    position: 'bottom',
    title: 'Light / dark mode',
    body:
      'Toggle the theme with this button or the D keyboard shortcut. The preference is saved per-browser' +
      ' and applied on the next visit. Both modes pass the same axe-core WCAG 2.1 AA checks ran by the' +
      ' @a11y Playwright suite.',
  },
  {
    targetSelector: null,
    title: "That's the whirlwind tour 🏁",
    body:
      'Click 🎓 in the top bar any time to replay. Questions? The README and docs/ in the repo' +
      ' cover the architecture in detail. Enjoy exploring!',
  },
];

@Injectable({ providedIn: 'root' })
export class TourService {
  // Steps expose as signal so a test/fixture can override for a one-off tour
  // (e.g. the e2e suite drives a 2-step smoke to avoid flaky long timings).
  readonly steps = signal<readonly TourStep[]>(DEFAULT_STEPS);

  /** `null` when no tour is running; otherwise the current step index. */
  readonly stepIndex = signal<number | null>(null);

  readonly isActive = computed(() => this.stepIndex() !== null);
  readonly currentStep = computed(() => {
    const i = this.stepIndex();
    return i !== null ? this.steps()[i] : null;
  });
  readonly isFirstStep = computed(() => (this.stepIndex() ?? 0) === 0);
  readonly isLastStep = computed(() => {
    const i = this.stepIndex();
    return i !== null && i === this.steps().length - 1;
  });

  /** Start the tour from step 0 and flag "seen" so auto-start won't retrigger. */
  start(): void {
    this.stepIndex.set(0);
    this.markSeen();
  }

  /** Advance; if already on the last step, close. */
  next(): void {
    const i = this.stepIndex();
    if (i === null) return;
    const last = this.steps().length - 1;
    if (i >= last) {
      this.end();
    } else {
      this.stepIndex.set(i + 1);
    }
  }

  /** Go back one step (no-op on step 0). */
  prev(): void {
    const i = this.stepIndex();
    if (i === null || i === 0) return;
    this.stepIndex.set(i - 1);
  }

  /** Close the tour without advancing (also fires on Esc / backdrop click). */
  end(): void {
    this.stepIndex.set(null);
  }

  /**
   * Auto-start the tour if the user has never seen it. Intended to be called
   * from the dashboard component's `ngOnInit` — we want the tour to wait
   * until the main layout is rendered, not fire before the sidebar DOM
   * selector would resolve.
   */
  maybeAutoStart(): void {
    if (this.hasSeen()) return;
    // Delay one frame so Angular's initial render lands and our selectors
    // (`.sidebar-nav`, `.env-selector`) exist in the DOM before the overlay
    // tries to position against them.
    requestAnimationFrame(() => this.start());
  }

  private hasSeen(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      // Safari private-mode / strict cookie settings can throw on access.
      // Fail closed — never auto-show in that case. Explicit 🎓 click still works.
      return true;
    }
  }

  private markSeen(): void {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // See hasSeen — ignore storage errors.
    }
  }
}
