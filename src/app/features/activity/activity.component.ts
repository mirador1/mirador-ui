import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivityService, ActivityType } from '../../core/activity/activity.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.scss',
})
export class ActivityComponent {
  readonly activity = inject(ActivityService);

  filterType = signal<ActivityType | 'all'>('all');

  readonly typeLabels: Record<ActivityType | 'all', string> = {
    all: 'All',
    'customer-create': 'Create',
    'customer-update': 'Update',
    'customer-delete': 'Delete',
    'health-change': 'Health',
    'diagnostic-run': 'Diagnostic',
    'env-switch': 'Environment',
    'bulk-import': 'Import',
  };

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

  get filteredEvents() {
    const type = this.filterType();
    if (type === 'all') return this.activity.events();
    return this.activity.events().filter((e) => e.type === type);
  }

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
