import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./features/customers/customers.component').then(m => m.CustomersComponent)
  },
  {
    path: 'diagnostic',
    loadComponent: () =>
      import('./features/diagnostic/diagnostic.component').then(m => m.DiagnosticComponent)
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'activity',
    loadComponent: () =>
      import('./features/activity/activity.component').then(m => m.ActivityComponent)
  },
  {
    path: 'observability',
    loadComponent: () =>
      import('./features/observability/observability.component').then(m => m.ObservabilityComponent)
  },
  {
    path: 'request-builder',
    loadComponent: () =>
      import('./features/request-builder/request-builder.component').then(m => m.RequestBuilderComponent)
  },
  {
    path: 'visualizations',
    loadComponent: () =>
      import('./features/visualizations/visualizations.component').then(m => m.VisualizationsComponent)
  },
  {
    path: 'chaos',
    loadComponent: () =>
      import('./features/chaos/chaos.component').then(m => m.ChaosComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent)
  },
  { path: '**', redirectTo: '' }
];
