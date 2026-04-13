/**
 * ToastService — Ephemeral notification system.
 *
 * Shows temporary toast messages that auto-dismiss after a configurable
 * duration (default 4s). Supports 4 types: success, error, warn, info.
 * Each toast gets a unique ID for independent dismissal.
 * The `toasts` signal drives the toast container in the AppShell template.
 */
import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warn' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Auto-incrementing ID counter for unique toast identification */
  private _counter = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', durationMs = 4000): void {
    const id = ++this._counter;
    this.toasts.update((t) => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
