/**
 * Application routes — all feature pages are lazy-loaded via `loadComponent`
 * to minimize the initial bundle size and improve startup performance.
 *
 * Each route maps to a standalone component in `features/`.
 * The wildcard route (`**`) redirects unknown paths to the dashboard.
 *
 * Notable routing decisions:
 * - `/audit` and `/timeline` are redirect aliases kept for backward-compatible
 *   bookmarks and external links.
 * - No auth guards are present at the router level — the AppShell and individual
 *   components check `AuthService.isAuthenticated()` and redirect to `/login` as needed.
 */
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/core-ux/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./features/customer/customers/customers.component').then((m) => m.CustomersComponent),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./features/commerce/orders/orders.component').then((m) => m.OrdersComponent),
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./features/commerce/orders/order-detail.component').then(
        (m) => m.OrderDetailComponent,
      ),
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('./features/commerce/products/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
  },
  {
    path: 'diagnostic',
    loadComponent: () =>
      import('./features/obs/diagnostic/diagnostic.component').then((m) => m.DiagnosticComponent),
  },
  {
    // Phase 3 DEMO1 — guided "trigger → observe → root cause → fix" UX.
    // Complements /chaos (power-tool grid) and /diagnostic (free-form
    // scenarios) with a lighter, storytelling-first entry for first-time
    // visitors. See docs/how-to/find-the-bug.md for the scenario catalogue.
    path: 'find-the-bug',
    loadComponent: () =>
      import('./features/obs/find-the-bug/find-the-bug.component').then(
        (m) => m.FindTheBugComponent,
      ),
  },
  {
    // Phase 3 DEMO2 — read-only 5-minute scripted walkthrough of a real
    // incident shape (Ollama slowness → circuit breaker). No interactivity;
    // meant as a 60-second skim for recruiters + a reference for the
    // observability loop (alert → runbook → trace → fix → verify).
    path: 'incident-anatomy',
    loadComponent: () =>
      import('./features/obs/incident-anatomy/incident-anatomy.component').then(
        (m) => m.IncidentAnatomyComponent,
      ),
  },
  {
    path: 'database',
    loadComponent: () =>
      import('./features/infra-ops/database/database.component').then((m) => m.DatabaseComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/core-ux/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'activity',
    loadComponent: () =>
      import('./features/obs/activity/activity.component').then((m) => m.ActivityComponent),
  },
  // /observability retired in ADR-0008 — Grafana Explore owns TraceQL / LogQL
  // consumption now. Loggers management moved to /settings (existed already).
  // Redirect old bookmarks to home; sidebar now deep-links to Grafana directly.
  { path: 'observability', redirectTo: '', pathMatch: 'full' },
  {
    path: 'request-builder',
    loadComponent: () =>
      import('./features/customer/request-builder/request-builder.component').then(
        (m) => m.RequestBuilderComponent,
      ),
  },
  // /visualizations retired in ADR-0007 — Error Timeline + Bundle treemap
  // moved to the dashboard. The legacy path redirects so old bookmarks /
  // deep-links keep working.
  { path: 'visualizations', redirectTo: '', pathMatch: 'full' },
  {
    path: 'chaos',
    loadComponent: () =>
      import('./features/infra-ops/chaos/chaos.component').then((m) => m.ChaosComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/core-ux/login/login.component').then((m) => m.LoginComponent),
  },
  { path: 'audit', redirectTo: 'security', pathMatch: 'full' },
  { path: 'timeline', redirectTo: '', pathMatch: 'full' },
  {
    path: 'security',
    loadComponent: () =>
      import('./features/infra-ops/security/security.component').then((m) => m.SecurityComponent),
  },
  {
    path: 'quality',
    loadComponent: () =>
      import('./features/obs/quality/quality.component').then((m) => m.QualityComponent),
  },
  {
    // Full-viewport Maven site viewer — use this instead of the quality page tab
    // when you need more vertical space for Javadoc, JaCoCo, or Pitest reports.
    path: 'quality/site',
    loadComponent: () =>
      import('./features/obs/maven-site/maven-site-full.component').then(
        (m) => m.MavenSiteFullComponent,
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/core-ux/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'pipelines',
    loadComponent: () =>
      import('./features/obs/pipelines/pipelines.component').then((m) => m.PipelinesComponent),
  },
  { path: '**', redirectTo: '' },
];
