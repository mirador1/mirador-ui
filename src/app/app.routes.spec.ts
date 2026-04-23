/**
 * Unit tests for the application's route table — the public URL contract.
 *
 * Pinned contracts:
 *   - Every visible feature has a route registered (catches accidental
 *     deletion of a top-level page)
 *   - Backward-compat redirects survive (audit → security, timeline → '',
 *     observability → '', visualizations → '') so old bookmarks still work
 *   - Every feature route is lazy-loaded (loadComponent) — no eager imports
 *     would balloon the initial bundle past the 800kB warning budget
 *   - Wildcard route last (any reordering would short-circuit later paths)
 *
 * Why these tests matter : a careless refactor that removes the
 * `customers` route silently breaks every external bookmark, every link
 * in the README, every screenshot in the docs. Pinning the contract here
 * fails the CI in 50ms instead of in production.
 */
import { routes } from './app.routes';

// eslint-disable-next-line max-lines-per-function
describe('app.routes', () => {
  describe('feature routes — every visible page is registered', () => {
    /**
     * The canonical list of feature paths the UI ships. Reading from the
     * sidebar wouldn't work (sidebar is just data); the contract is "if
     * we ship a top-level page, there's a route for it".
     */
    const expectedPaths = [
      '', // dashboard (root)
      'customers',
      'diagnostic',
      'find-the-bug',
      'incident-anatomy',
      'database',
      'settings',
      'activity',
      'request-builder',
      'chaos',
      'login',
      'security',
      'quality',
      'quality/site',
      'about',
      'pipelines',
    ];

    for (const path of expectedPaths) {
      it(`registers a route for "${path || '(root)'}"`, () => {
        const route = routes.find((r) => r.path === path);
        expect(route).toBeDefined();
      });
    }
  });

  describe('lazy-loading — every feature uses loadComponent', () => {
    it('every non-redirect route is lazy-loaded (loadComponent, not component)', () => {
      // Pinned: eagerly importing all feature components would balloon
      // the initial bundle past the 800kB warning budget set in
      // angular.json (raised from 560kB in ADR-0009 Phase B). loadComponent
      // ensures Angular code-splits each route into its own chunk.
      // Note: redirectTo is checked with `=== undefined` (not falsy) because
      // some redirects target the empty-string root path and would otherwise
      // false-positively register as "feature routes".
      const featureRoutes = routes.filter(
        (r) => r.path !== undefined && r.path !== '**' && r.redirectTo === undefined,
      );
      for (const route of featureRoutes) {
        expect(route.loadComponent).toBeDefined();
      }
    });
  });

  describe('backward-compat redirects', () => {
    it('keeps `audit` → `security` (renamed feature, old bookmarks live)', () => {
      // Pinned: the audit page was renamed to /security on a refactor;
      // this redirect keeps any external bookmark or doc link working.
      // Removing it would silently 404 every audit/* URL out there.
      const audit = routes.find((r) => r.path === 'audit');
      expect(audit?.redirectTo).toBe('security');
      expect(audit?.pathMatch).toBe('full');
    });

    it('keeps `observability` → `` (page retired per ADR-0008, redirect to dashboard)', () => {
      // Pinned: ADR-0008 retired the in-UI Observability page in favour
      // of Grafana. The redirect prevents 404s on legacy links.
      const obs = routes.find((r) => r.path === 'observability');
      expect(obs?.redirectTo).toBe('');
      expect(obs?.pathMatch).toBe('full');
    });

    it('keeps `visualizations` → `` (Phase 3 UX cleanup)', () => {
      const viz = routes.find((r) => r.path === 'visualizations');
      expect(viz?.redirectTo).toBe('');
      expect(viz?.pathMatch).toBe('full');
    });

    it('keeps `timeline` → `` (Phase 3 UX cleanup)', () => {
      const timeline = routes.find((r) => r.path === 'timeline');
      expect(timeline?.redirectTo).toBe('');
      expect(timeline?.pathMatch).toBe('full');
    });
  });

  describe('wildcard route — last and unconditional', () => {
    it('has a `**` wildcard that redirects to root', () => {
      // Pinned: the wildcard catches any unknown path and sends the user
      // to the dashboard rather than an Angular default 404. UX choice :
      // a portfolio dashboard never wants to surface "Page not found".
      const wildcard = routes.find((r) => r.path === '**');
      expect(wildcard).toBeDefined();
      expect(wildcard?.redirectTo).toBe('');
    });

    it('the wildcard is the LAST route (any later route would be unreachable)', () => {
      // Pinned: Angular matches routes top-to-bottom. A wildcard that's
      // not last means everything below it never fires. Easy to break
      // with a copy-paste; this test catches it instantly.
      const lastRoute = routes[routes.length - 1];
      expect(lastRoute.path).toBe('**');
    });
  });

  describe('quality nested route', () => {
    it('has `quality` AND `quality/site` (parent + child)', () => {
      // Pinned: quality/site is the embedded Maven Site iframe page —
      // a separate route from the SPA-rendered /quality dashboard.
      // Removing the child would break the "Open Maven Site in this
      // tab" link from the quality dashboard.
      const quality = routes.find((r) => r.path === 'quality');
      const qualitySite = routes.find((r) => r.path === 'quality/site');
      expect(quality).toBeDefined();
      expect(qualitySite).toBeDefined();
    });
  });
});
