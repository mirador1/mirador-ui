import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CustomersComponent } from './features/customers/customers.component';
import { DiagnosticComponent } from './features/diagnostic/diagnostic.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'customers', component: CustomersComponent },
  { path: 'diagnostic', component: DiagnosticComponent },
  { path: '**', redirectTo: '' }
];
