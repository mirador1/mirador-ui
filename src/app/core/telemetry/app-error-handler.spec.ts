/**
 * Unit tests for AppErrorHandler — custom Angular ErrorHandler that routes
 * uncaught exceptions to TelemetryService + ToastService + console.error.
 *
 * Pinned contracts:
 *   - Error instances kept verbatim (preserves .stack for grouping)
 *   - Non-Error values (string, number, object) wrapped via new Error(String(x))
 *   - Telemetry receives message, name, and first stack frame (not the full chain)
 *   - Toast shown with ⚠ prefix + 6s duration + 'error' severity
 *   - 3-second rate limit between toasts (storm protection)
 */
import { TestBed } from '@angular/core/testing';
import { AppErrorHandler } from './app-error-handler';
import { TelemetryService } from './telemetry.service';
import { ToastService } from '../toast/toast.service';

// eslint-disable-next-line max-lines-per-function
describe('AppErrorHandler', () => {
  let handler: AppErrorHandler;
  let telemetry: TelemetryService;
  let toast: ToastService;
  let telemetryErrorSpy: ReturnType<typeof vi.spyOn>;
  let toastShowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppErrorHandler],
    });
    handler = TestBed.inject(AppErrorHandler);
    telemetry = TestBed.inject(TelemetryService);
    toast = TestBed.inject(ToastService);
    telemetryErrorSpy = vi.spyOn(telemetry, 'error').mockReturnValue(undefined);
    toastShowSpy = vi.spyOn(toast, 'show').mockReturnValue(undefined);
  });

  describe('error normalisation', () => {
    it('keeps Error instances verbatim (preserves .stack for grouping)', () => {
      // Pinned: TelemetryService.error() receives the ORIGINAL Error so
      // its .stack survives. Wrapping a real Error in new Error(...) would
      // discard the original stack and produce a stack pointing at this
      // handler, useless for triage.
      const original = new Error('original failure');
      handler.handleError(original);

      expect(telemetryErrorSpy).toHaveBeenCalledWith(
        'original failure',
        original, // SAME reference, not a wrapped copy
        expect.objectContaining({ name: 'Error' }),
      );
    });

    it('wraps a string error in new Error(String(x))', () => {
      // Some old-school throw sites still do `throw "boom"`. The handler
      // must coerce so the rest of the pipeline (which expects an Error)
      // doesn't crash on `.stack` access.
      handler.handleError('boom');

      const callArgs = telemetryErrorSpy.mock.calls[0];
      expect(callArgs[0]).toBe('boom'); // message
      expect(callArgs[1]).toBeInstanceOf(Error);
      expect((callArgs[1] as Error).message).toBe('boom');
    });

    it('wraps an object error using String(x) (gives "[object Object]")', () => {
      // Pinned: an object thrown via `throw {code: 500}` becomes
      // `new Error("[object Object]")`. Not pretty but it doesn't crash —
      // the stack capture happens at this throw site, useful for triage.
      handler.handleError({ code: 500 });

      const callArgs = telemetryErrorSpy.mock.calls[0];
      expect(callArgs[1]).toBeInstanceOf(Error);
      expect((callArgs[1] as Error).message).toBe('[object Object]');
    });

    it('falls back to "Uncaught exception" when the error message is empty', () => {
      // Pinned: `new Error('')` produces an empty message. We replace it
      // with a static placeholder so the Activity timeline shows
      // something meaningful instead of a blank row.
      const empty = new Error('');
      handler.handleError(empty);

      expect(telemetryErrorSpy).toHaveBeenCalledWith(
        'Uncaught exception',
        empty,
        expect.any(Object),
      );
    });
  });

  describe('telemetry context payload', () => {
    it('passes name + first stack frame as context (not the full stack)', () => {
      // Pinned: only the FIRST stack frame is captured — a 5-level RxJS
      // pipe produces a 50-line stack, which would blow up the Activity
      // timeline row. The user clicks through to DevTools for the full one.
      const err = new Error('chain failure');
      err.stack = 'Error: chain failure\n    at FrameA (file:1)\n    at FrameB (file:2)';

      handler.handleError(err);

      const ctx = telemetryErrorSpy.mock.calls[0][2] as { name: string; stack: string };
      expect(ctx.name).toBe('Error');
      expect(ctx.stack).toBe('at FrameA (file:1)');
      expect(ctx.stack).not.toContain('FrameB'); // ONLY first frame
    });

    it('handles missing .stack gracefully (no throw)', () => {
      // Pinned: some error sources (jsdom mocks, custom classes) produce
      // an Error without .stack. The handler must not crash trying to
      // .split() undefined.
      const err = new Error('no stack');
      err.stack = undefined;

      expect(() => handler.handleError(err)).not.toThrow();

      const ctx = telemetryErrorSpy.mock.calls[0][2] as { stack?: string };
      expect(ctx.stack).toBeUndefined();
    });
  });

  describe('user-visible toast', () => {
    it('shows toast with ⚠ prefix + "error" severity + 6000ms duration', () => {
      handler.handleError(new Error('user-visible failure'));

      expect(toastShowSpy).toHaveBeenCalledWith('⚠ user-visible failure', 'error', 6000);
    });

    it('uses "Unexpected error" placeholder when message is empty', () => {
      handler.handleError(new Error(''));

      expect(toastShowSpy).toHaveBeenCalledWith('⚠ Unexpected error', 'error', 6000);
    });
  });

  describe('rate limiting (storm protection)', () => {
    it('first error triggers the toast', () => {
      handler.handleError(new Error('first'));

      expect(toastShowSpy).toHaveBeenCalledTimes(1);
    });

    it('second error within 3 s does NOT trigger another toast (rate-limited)', () => {
      // Pinned: a component throwing on every change detection would
      // produce ~60 toasts/sec without rate limiting — the screen would
      // be unusable. The 3 s window keeps the user notified without
      // burying the UI.
      handler.handleError(new Error('first'));
      handler.handleError(new Error('second'));
      handler.handleError(new Error('third'));

      // Only the first triggered the toast; telemetry still got all 3.
      expect(toastShowSpy).toHaveBeenCalledTimes(1);
      expect(telemetryErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('toast fires again after 3 s window elapses', () => {
      // Pinned: the rate limit MUST reset eventually — otherwise one
      // burst at session start would silence all toasts forever, hiding
      // legitimate later errors from the user.
      // Start at a large now so the first call fires (handler checks
      // `now - _lastToastAt > 3000`; with _lastToastAt=0, now must be
      // > 3000 to pass — using 1_000_000 to clearly exceed the threshold).
      const realDateNow = Date.now;
      let now = 1_000_000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      handler.handleError(new Error('a'));
      now += 1000; // +1s — still within window
      handler.handleError(new Error('b'));
      now += 2500; // +3.5s total since first → past 3s window
      handler.handleError(new Error('c'));

      expect(toastShowSpy).toHaveBeenCalledTimes(2); // 'a' fired, 'b' suppressed, 'c' fired
      Date.now = realDateNow;
    });
  });
});
