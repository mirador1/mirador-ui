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
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent)
  },
  { path: '**', redirectTo: '' }
];
