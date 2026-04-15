/**
 * ActivityService — In-session event timeline.
 *
 * Records user and system events (CRUD ops, health changes, diagnostics, imports)
 * in a signal-based array (capped at 200 entries). Events are displayed in the
 * Activity page and can be filtered by type.
 *
 * This is an in-memory store — events are lost on page reload by design.
 * The intent is to give a lightweight audit trail for the current browser session
 * without requiring server-side storage.
 *
 * Part of an Angular 21 zoneless app — the `events` signal drives the template
 * without Zone.js change detection.
 */
import { Injectable, signal } from '@angular/core';

/**
 * Discriminated union of all event categories tracked by `ActivityService`.
 * Adding a new category here also requires updating the labels map in `ActivityComponent`.
 */
export type ActivityType =
  | 'customer-create'
  | 'customer-update'
  | 'customer-delete'
  | 'health-change'
  | 'diagnostic-run'
  | 'env-switch'
  | 'bulk-import';

/** A single recorded event in the in-session activity timeline. */
export interface ActivityEvent {
  /** Auto-incremented unique identifier for stable rendering keys. */
  id: number;
  /** Category used for type-based filtering and badge coloring. */
  type: ActivityType;
  /** Primary human-readable description of what happened. */
  message: string;
  /** Exact time the event was recorded — displayed as a relative timestamp in the UI. */
  timestamp: Date;
  /** Optional supplementary context (e.g. record count for bulk imports). */
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  /** Auto-incrementing counter for event ID generation. */
  private _counter = 0;

  /**
   * Signal array of all recorded events for the current browser session.
   * New events are prepended (most-recent first) and the list is capped at 200.
   * Consumed by `ActivityComponent` for display and filtering.
   */
  readonly events = signal<ActivityEvent[]>([]);

  /**
   * Record a new activity event.
   * Prepends the event to the signal array (newest first) and caps the list at 200
   * to prevent unbounded memory growth in long sessions.
   *
   * @param type    Event category used for filtering and badge coloring.
   * @param message Human-readable summary of the action.
   * @param details Optional extra context (e.g., record counts, timing info).
   */
  log(type: ActivityType, message: string, details?: string): void {
    const event: ActivityEvent = {
      id: ++this._counter,
      type,
      message,
      timestamp: new Date(),
      details,
    };
    this.events.update((list) => [event, ...list.slice(0, 199)]); // keep last 200
  }

  /** Clear all events from memory. Used by the "Clear" button in the Activity page. */
  clear(): void {
    this.events.set([]);
  }

  /**
   * Return a snapshot of events matching a specific type.
   * This is a derived value — it does not return a signal, so callers
   * must call it inside a reactive context (effect/computed) to stay live.
   *
   * @param type The event category to filter by.
   * @returns Filtered array from the current `events` signal value.
   */
  filterByType(type: ActivityType): ActivityEvent[] {
    return this.events().filter((e) => e.type === type);
  }
}
