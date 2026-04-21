/**
 * e2e/a11y.spec.ts — accessibility (WCAG 2.1 AA) smoke checks via axe-core.
 *
 * Scope:
 *   - Runs axe on the public pages a brand-new visitor hits: login, the
 *     unauthenticated dashboard landing, and the Chaos Mesh page (which
 *     the Auth0-free reviewer can still open to eyeball the UI structure).
 *   - Scans for WCAG 2.1 A + AA violations with `wcag2a`, `wcag2aa`,
 *     `wcag21a`, `wcag21aa` tags — the standard set most demo apps aim
 *     for without going full WCAG AAA.
 *   - Fails the spec (red CI job) on any critical or serious violation;
 *     moderate / minor violations are logged in the Playwright report as
 *     information so the regression is visible but doesn't block a demo.
 *
 * Why this file is small:
 *   This is a SMOKE check. A full a11y audit with axe-core would scan
 *   every route, every component state (menu open, modal shown, etc.).
 *   Mirador already tracks the long tail of a11y warnings via ESLint
 *   (angular-eslint a11y rules). This spec catches regressions on the
 *   MINIMUM that has to work — if a color contrast fix in the topbar
 *   breaks a screen-reader landmark, we notice at the next CI run, not
 *   at the next demo.
 *
 * Run locally:
 *   npm run e2e:a11y        # against baseUrl from playwright.config.ts
 *   npm run e2e:a11y:local  # against http://localhost:4200 (dev server)
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES_TO_AUDIT = [
  { name: 'Login', url: '/login' },
  // The root path bounces to /login when unauthenticated — same content,
  // still worth scanning so we notice if a silent navigation breaks the
  // landmark structure.
  { name: 'Root (unauth redirect)', url: '/' },
  // The Chaos page is reachable without auth and renders the sidebar +
  // the topbar (more surface to scan than the login form alone).
  { name: 'Chaos (public scaffold)', url: '/chaos' },
];

const CRITICAL_SEVERITIES = new Set(['critical', 'serious']);

for (const pageSpec of PAGES_TO_AUDIT) {
  test(`@a11y ${pageSpec.name} has no critical WCAG violations`, async ({ page }) => {
    await page.goto(pageSpec.url);
    // Give Angular a breath to render lazy chunks + resolve signals.
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) =>
      CRITICAL_SEVERITIES.has(v.impact ?? 'minor'),
    );
    const informational = results.violations.filter(
      (v) => !CRITICAL_SEVERITIES.has(v.impact ?? 'minor'),
    );

    // Log moderate / minor violations as annotations so they show up in the
    // Playwright HTML report without failing the run. Prevents "fix every
    // single axe finding to ship" burnout while still surfacing the list.
    for (const v of informational) {
      test.info().annotations.push({
        type: `a11y-${v.impact}`,
        description: `${pageSpec.name} · ${v.id}: ${v.help} — ${v.nodes.length} node(s)`,
      });
    }

    // Critical / serious = actual blockers. Mirador's dashboard is a
    // developer / recruiter target, not consumer-grade, but screen-reader
    // landmarks and keyboard nav need to work for the demo to render at
    // all in accessibility-eval contexts.
    expect(
      blocking,
      blocking
        .map((v) => `${v.id} (${v.impact}) — ${v.help} · ${v.nodes.length} node(s)`)
        .join('\n'),
    ).toEqual([]);
  });
}
