/**
 * Application routes — all feature pages are lazy-loaded via `loadComponent`
 * to minimize the initial bundle size and improve startup performance.
 *
 * Each route maps to a standalone component in `features/`.
 * The wildcard route (`**`) redirects unknown paths to the dashboard.
 */
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./features/customers/customers.component').then((m) => m.CustomersComponent),
  },
  {
    path: 'diagnostic',
    loadComponent: () =>
      import('./features/diagnostic/diagnostic.component').then((m) => m.DiagnosticComponent),
  },
  {
    path: 'database',
    loadComponent: () =>
      import('./features/database/database.component').then((m) => m.DatabaseComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'activity',
    loadComponent: () =>
      import('./features/activity/activity.component').then((m) => m.ActivityComponent),
  },
  {
    path: 'observability',
    loadComponent: () =>
      import('./features/observability/observability.component').then(
        (m) => m.ObservabilityComponent,
      ),
  },
  {
    path: 'request-builder',
    loadComponent: () =>
      import('./features/request-builder/request-builder.component').then(
        (m) => m.RequestBuilderComponent,
      ),
  },
  {
    path: 'visualizations',
    loadComponent: () =>
      import('./features/visualizations/visualizations.component').then(
        (m) => m.VisualizationsComponent,
      ),
  },
  {
    path: 'chaos',
    loadComponent: () => import('./features/chaos/chaos.component').then((m) => m.ChaosComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./features/audit/audit.component').then((m) => m.AuditComponent),
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./features/timeline/timeline.component').then((m) => m.TimelineComponent),
  },
  {
    path: 'security',
    loadComponent: () =>
      import('./features/security/security.component').then((m) => m.SecurityComponent),
  },
  { path: '**', redirectTo: '' },
];
