/**
 * ToastService — Ephemeral notification system.
 *
 * Shows temporary toast messages that auto-dismiss after a configurable
 * duration (default 4s). Supports 4 types: success, error, warn, info.
 * Each toast gets a unique ID for independent dismissal.
 * The `toasts` signal drives the toast container in the AppShell template.
 *
 * Part of an Angular 21 zoneless app — the `toasts` signal updates trigger
 * template re-evaluation without Zone.js.
 */
import { Injectable, signal } from '@angular/core';

/**
 * Represents a single toast notification displayed in the global toast container.
 */
export interface Toast {
  /** Unique auto-incremented identifier used for independent dismissal via `dismiss(id)`. */
  id: number;
  /** Text content shown in the toast. Keep concise — max ~80 characters. */
  message: string;
  /** Visual style: success=green, error=red, warn=orange, info=blue. */
  type: 'success' | 'error' | 'warn' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Auto-incrementing counter ensuring each toast has a globally unique ID. */
  private _counter = 0;

  /**
   * Signal array of currently visible toasts.
   * The AppShell template iterates this signal to render toast elements.
   * Auto-trimmed as each toast auto-dismisses.
   */
  readonly toasts = signal<Toast[]>([]);

  /**
   * Show a new toast notification.
   * Automatically schedules dismissal after `durationMs` milliseconds.
   *
   * @param message    Text to display. Keep it brief and actionable.
   * @param type       Visual type controlling the badge color. Defaults to `'info'`.
   * @param durationMs How long the toast remains visible. Defaults to 4000ms.
   *                   Use a longer duration (e.g. 6000ms) for error messages that need reading time.
   */
  show(message: string, type: Toast['type'] = 'info', durationMs = 4000): void {
    const id = ++this._counter;
    this.toasts.update((t) => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  /**
   * Remove a specific toast by its ID.
   * Called automatically by the timer set in `show()`, or manually on close-button click.
   *
   * @param id The unique ID of the toast to remove.
   */
  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
