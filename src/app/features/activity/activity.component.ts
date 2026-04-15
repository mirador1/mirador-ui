/**
 * ActivityComponent — Session event timeline with type-based filtering.
 *
 * Displays all events logged by ActivityService (CRUD ops, health changes,
 * diagnostic runs, env switches, imports) in reverse chronological order.
 * Each event type has a distinct badge color and icon for visual scanning.
 *
 * The component also provides "Quick Actions" buttons that generate all 7
 * event types in a single click, useful for demonstrating the timeline in demos.
 * Events are stored in-memory by ActivityService and lost on page reload.
 */
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ActivityService, ActivityType } from '../../core/activity/activity.service';
import { ApiService, Customer } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  readonly activity = inject(ActivityService);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);

  /** Signal: true while the `quickTraffic()` sequence is running. Disables the button. */
  generating = signal(false);

  /** Create a customer and log it */
  quickCreate(): void {
    const name = `Activity-${Date.now() % 10000}`;
    this.api.createCustomer({ name, email: `${name.toLowerCase()}@test.com` }).subscribe({
      next: (c) => {
        this.activity.log('customer-create', `Created "${c.name}" (ID ${c.id})`);
        this.toast.show(`Customer "${c.name}" created`, 'success');
      },
      error: () => this.toast.show('Create failed — is the backend running?', 'error'),
    });
  }

  /** Check health and log the result */
  quickHealth(): void {
    this.api.getHealth().subscribe({
      next: (v) => {
        const status = (v as { status?: string })?.status ?? '?';
        this.activity.log('health-change', `Health check → ${status}`);
        this.toast.show(`Health: ${status}`, status === 'UP' ? 'success' : 'warn');
      },
      error: () => {
        this.activity.log('health-change', 'Backend unreachable');
        this.toast.show('Backend unreachable', 'error');
      },
    });
  }

  /** Generate mixed traffic to produce multiple event types */
  async quickTraffic(): Promise<void> {
    this.generating.set(true);
    const base = this.env.baseUrl();

    // 1. Create a customer
    const name = `Traffic-${Date.now() % 10000}`;
    const email = `${name.toLowerCase()}@test.com`;
    try {
      const c = await this.http.post<Customer>(`${base}/customers`, { name, email }).toPromise();
      if (!c) throw new Error('empty response');
      this.activity.log('customer-create', `Created "${c.name}" (ID ${c.id})`);

      // 2. Update it
      await this.http
        .put(`${base}/customers/${c.id}`, { name: c.name + ' (updated)', email })
        .toPromise();
      this.activity.log('customer-update', `Updated "${c.name}" (ID ${c.id})`);

      // 3. Delete it
      await this.http.delete(`${base}/customers/${c.id}`).toPromise();
      this.activity.log('customer-delete', `Deleted "${c.name}" (ID ${c.id})`);
    } catch (e) {
      // Backend unreachable — log so the activity timeline still records the attempt
      this.activity.log('diagnostic-run', `Traffic generation failed: ${(e as Error).message}`);
    }

    // 4. Health check
    this.http
      .get(`${base}/actuator/health`)
      .pipe(catchError(() => of({ status: 'UNREACHABLE' })))
      .subscribe((v) => {
        const status = (v as { status?: string })?.status ?? '?';
        this.activity.log('health-change', `Health → ${status}`);
      });

    // 5. Diagnostic-like request
    const t0 = Date.now();
    this.http
      .get(`${base}/customers/aggregate`)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.activity.log('diagnostic-run', `Aggregate completed in ${Date.now() - t0} ms`);
      });

    // 6. Environment switch (cycle through envs and back)
    const original = this.env.current();
    const otherEnv = this.env.environments.find((e) => e.name !== original.name) ?? original;
    this.env.select(otherEnv);
    this.activity.log('env-switch', `Switched to ${otherEnv.name} (${otherEnv.baseUrl})`);
    // Switch back immediately
    this.env.select(original);
    this.activity.log('env-switch', `Switched back to ${original.name} (${original.baseUrl})`);

    // 7. Simulated bulk import
    const importCount = 3;
    let importOk = 0;
    let importDone = 0;
    for (let i = 0; i < importCount; i++) {
      const n = `Import-${Date.now() % 10000}-${i}`;
      this.http
        .post(`${base}/customers`, { name: n, email: `${n.toLowerCase()}@import.com` })
        .pipe(catchError(() => of(null)))
        .subscribe((r) => {
          if (r) importOk++;
          importDone++;
          if (importDone === importCount) {
            this.activity.log(
              'bulk-import',
              `Imported ${importOk} customers (${importCount - importOk} errors)`,
              `Total: ${importCount} records`,
            );
            this.generating.set(false);
            this.toast.show('Generated all 7 activity types', 'success');
          }
        });
    }
  }

  /** Signal: currently active event type filter. `'all'` shows every event type. */
  filterType = signal<ActivityType | 'all'>('all');

  /**
   * Display metadata for each event type: label, icon, and tooltip text.
   * Used to render the filter button row and the badge on each event row.
   */
  readonly typeLabels: Record<ActivityType | 'all', { label: string; icon: string; tip: string }> =
    {
      all: { label: 'All', icon: '📋', tip: 'Show all event types' },
      'customer-create': {
        label: 'Create',
        icon: '➕',
        tip: 'Customer creation events (POST /customers)',
      },
      'customer-update': {
        label: 'Update',
        icon: '✏️',
        tip: 'Customer update events (PUT /customers/{id})',
      },
      'customer-delete': {
        label: 'Delete',
        icon: '🗑️',
        tip: 'Customer deletion events (DELETE /customers/{id})',
      },
      'health-change': {
        label: 'Health',
        icon: '💚',
        tip: 'Backend health status changes (UP → DOWN or vice versa)',
      },
      'diagnostic-run': {
        label: 'Diagnostic',
        icon: '🧪',
        tip: 'Diagnostic scenario runs (API versioning, idempotency, stress test, etc.)',
      },
      'env-switch': {
        label: 'Environment',
        icon: '🌍',
        tip: 'Environment switches (Local → Docker → Staging → Production)',
      },
      'bulk-import': {
        label: 'Import',
        icon: '📥',
        tip: 'Bulk import operations (JSON/CSV file upload)',
      },
    };

  /** Ordered list of filter values for the filter button row. */
  readonly typeFilters: (ActivityType | 'all')[] = [
    'all',
    'customer-create',
    'customer-update',
    'customer-delete',
    'health-change',
    'diagnostic-run',
    'env-switch',
    'bulk-import',
  ];

  /**
   * Derived event list filtered by `filterType`.
   * Returns all events when filter is `'all'`, otherwise filters by matching type.
   */
  get filteredEvents() {
    const type = this.filterType();
    if (type === 'all') return this.activity.events();
    return this.activity.events().filter((e) => e.type === type);
  }

  /**
   * Returns the single-character symbol for an event type, shown inside the timeline icon circle.
   *
   * @param type The activity event type.
   * @returns A single character symbol (e.g., `'+'` for create, `'-'` for delete).
   */
  typeIcon(type: ActivityType): string {
    switch (type) {
      case 'customer-create':
        return '+';
      case 'customer-update':
        return '~';
      case 'customer-delete':
        return '-';
      case 'health-change':
        return '!';
      case 'diagnostic-run':
        return '>';
      case 'env-switch':
        return '*';
      case 'bulk-import':
        return '^';
    }
  }

  typeBadgeClass(type: ActivityType): string {
    switch (type) {
      case 'customer-create':
        return 'badge-create';
      case 'customer-update':
        return 'badge-update';
      case 'customer-delete':
        return 'badge-delete';
      case 'health-change':
        return 'badge-health';
      case 'diagnostic-run':
        return 'badge-diagnostic';
      case 'env-switch':
        return 'badge-env';
      case 'bulk-import':
        return 'badge-import';
    }
  }
}
