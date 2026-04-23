/**
 * Unit tests for TelemetryService — structured browser logging sink
 * (ADR-0009 Phase A). Tests cover the in-memory history + Activity
 * timeline integration. The OpenTelemetry SDK init path
 * (`ensureOtel`) is not exercised here; that requires browser-DOM
 * APIs that vitest's jsdom doesn't fully expose, and Phase B is the
 * proper coverage point.
 */
import { TestBed } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';
import { ActivityService } from '../activity/activity.service';

// eslint-disable-next-line max-lines-per-function
describe('TelemetryService', () => {
  let service: TelemetryService;
  let activity: ActivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TelemetryService);
    activity = TestBed.inject(ActivityService);
    // Clear shared signals between tests
    service.clear();
    activity.clear();
  });

  describe('public log methods', () => {
    it('debug() appends an entry with level=debug', () => {
      service.debug('debug message');

      expect(service.history()).toHaveLength(1);
      expect(service.history()[0].level).toBe('debug');
      expect(service.history()[0].message).toBe('debug message');
      expect(service.history()[0].time).toBeInstanceOf(Date);
    });

    it('info() appends an entry with level=info', () => {
      service.info('info message');

      expect(service.history()[0].level).toBe('info');
    });

    it('warn() appends an entry with level=warn', () => {
      service.warn('warning');

      expect(service.history()[0].level).toBe('warn');
    });

    it('error() appends an entry with level=error', () => {
      const err = new Error('boom');
      service.error('error message', err);

      const entry = service.history()[0];
      expect(entry.level).toBe('error');
      expect(entry.message).toBe('error message');
      expect(entry.error).toBe(err);
    });

    it('captures optional context map on every level', () => {
      service.warn('with context', { userId: 42, action: 'click' });

      expect(service.history()[0].context).toEqual({ userId: 42, action: 'click' });
    });
  });

  describe('error() integration with ActivityService', () => {
    it('error() ALSO logs a diagnostic-run entry to Activity timeline', () => {
      // Pinned: errors must surface in the user-facing Activity page so a
      // dev viewing /activity sees the failure without opening DevTools.
      service.error('critical fail');

      const acts = activity.events();
      expect(acts).toHaveLength(1);
      expect(acts[0].type).toBe('diagnostic-run');
      expect(acts[0].message).toContain('⚠ critical fail');
    });

    it('warn/info/debug do NOT pollute Activity timeline (errors only)', () => {
      // Pinned: only errors get the user-visible breadcrumb. Logging
      // every info would drown the Activity page in noise.
      service.debug('quiet');
      service.info('quiet');
      service.warn('quiet');

      expect(activity.events()).toEqual([]);
    });
  });

  describe('history cap (500 entries)', () => {
    it('keeps last 500 entries when more are logged', () => {
      // Memory-safety contract — long-running sessions must not OOM.
      for (let i = 0; i < 600; i++) {
        service.info(`event-${i}`);
      }

      const entries = service.history();
      expect(entries).toHaveLength(500);
      // Newest-last (the slice keeps the tail)
      expect(entries[entries.length - 1].message).toBe('event-599');
      // Oldest preserved is event-100 (600 - 500)
      expect(entries[0].message).toBe('event-100');
    });
  });

  describe('clear()', () => {
    it('empties the history signal', () => {
      service.info('a');
      service.info('b');
      expect(service.history()).toHaveLength(2);

      service.clear();

      expect(service.history()).toEqual([]);
    });

    it('does NOT clear Activity timeline (separate concern)', () => {
      service.error('e');
      expect(activity.events()).toHaveLength(1);

      service.clear();

      // Activity timeline survives — TelemetryService.clear() is for
      // the dev-side debug history, not the user-facing breadcrumb.
      expect(activity.events()).toHaveLength(1);
    });
  });

  describe('history ordering', () => {
    it('appends newest-last (chronological order)', () => {
      // Pinned: telemetry history is append-only chronological (different
      // from Activity which is newest-first). UI rendering depends on this.
      service.info('first');
      service.info('second');
      service.info('third');

      const messages = service.history().map((e) => e.message);
      expect(messages).toEqual(['first', 'second', 'third']);
    });
  });
});
