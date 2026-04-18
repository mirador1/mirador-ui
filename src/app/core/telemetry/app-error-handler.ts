/**
 * AppErrorHandler — Custom Angular ErrorHandler (ADR-0009 Phase A).
 *
 * Angular's default handler logs uncaught exceptions to the browser
 * console. That's invisible to the user and lost on reload. This
 * handler routes every uncaught exception through three sinks:
 *
 * 1. `TelemetryService.error` — bounded history + Activity timeline +
 *    Phase B Tempo span event.
 * 2. `ToastService.show('error')` — a visible, 6-second toast so the
 *    user knows something failed (rate-limited to one toast per 3 s to
 *    avoid a storm when a component throws on every change detection).
 * 3. `console.error` — preserved for dev productivity (DevTools break
 *    on "pause on exceptions" still works).
 *
 * Registered via `{ provide: ErrorHandler, useClass: AppErrorHandler }`
 * in `app.config.ts`.
 */
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { TelemetryService } from './telemetry.service';
import { ToastService } from '../toast/toast.service';

/** Minimum milliseconds between two user-visible toasts from uncaught errors. */
const TOAST_RATE_LIMIT_MS = 3000;

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly telemetry = inject(TelemetryService);
  private readonly toast = inject(ToastService);

  private _lastToastAt = 0;

  handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));

    this.telemetry.error(err.message || 'Uncaught exception', err, {
      name: err.name,
      // The first line of the stack — enough to group/search, not so much
      // that a 5-level RxJS chain blows up the Activity row.
      stack: err.stack?.split('\n')[1]?.trim(),
    });

    const now = Date.now();
    if (now - this._lastToastAt > TOAST_RATE_LIMIT_MS) {
      this._lastToastAt = now;
      // User-visible text is the bare message — stack traces belong in
      // DevTools, not in a toast. 6 s matches the existing 'error' duration.
      this.toast.show(`⚠ ${err.message || 'Unexpected error'}`, 'error', 6000);
    }
  }
}
