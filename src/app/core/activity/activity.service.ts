import { Injectable, signal } from '@angular/core';

export type ActivityType = 'customer-create' | 'customer-update' | 'customer-delete' | 'health-change' | 'diagnostic-run' | 'env-switch' | 'bulk-import';

export interface ActivityEvent {
  id: number;
  type: ActivityType;
  message: string;
  timestamp: Date;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private _counter = 0;
  readonly events = signal<ActivityEvent[]>([]);

  log(type: ActivityType, message: string, details?: string): void {
    const event: ActivityEvent = {
      id: ++this._counter,
      type,
      message,
      timestamp: new Date(),
      details
    };
    this.events.update(list => [event, ...list.slice(0, 199)]); // keep last 200
  }

  clear(): void {
    this.events.set([]);
  }

  filterByType(type: ActivityType): ActivityEvent[] {
    return this.events().filter(e => e.type === type);
  }
}
