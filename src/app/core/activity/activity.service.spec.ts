/**
 * Unit tests for ActivityService — the in-session event timeline used by
 * the Activity page. Pure signal-based store, no Spring, no HTTP.
 *
 * <p>Pinned contracts:
 *   - log() prepends (newest-first) and increments id
 *   - 200-event cap (memory safety)
 *   - clear() empties signal
 *   - filterByType returns matching subset
 */
import { ActivityService } from './activity.service';

// eslint-disable-next-line max-lines-per-function
describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    service = new ActivityService();
  });

  describe('log()', () => {
    it('starts with empty events signal', () => {
      expect(service.events()).toEqual([]);
    });

    it('appends a single event with auto-incremented id starting at 1', () => {
      service.log('customer-create', 'Created Alice');

      const events = service.events();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(1);
      expect(events[0].type).toBe('customer-create');
      expect(events[0].message).toBe('Created Alice');
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[0].details).toBeUndefined();
    });

    it('captures optional details parameter', () => {
      service.log('bulk-import', 'Imported batch', '42 records');

      expect(service.events()[0].details).toBe('42 records');
    });

    it('prepends newer events (newest-first ordering)', () => {
      // Critical: UI shows the timeline in reverse-chronological order;
      // a regression that appends instead of prepends would put the
      // newest event at the bottom, breaking the "what just happened?" UX.
      service.log('customer-create', 'first');
      service.log('customer-update', 'second');
      service.log('customer-delete', 'third');

      const events = service.events();
      expect(events[0].message).toBe('third');
      expect(events[1].message).toBe('second');
      expect(events[2].message).toBe('first');
    });

    it('increments ids monotonically across multiple logs', () => {
      service.log('health-change', 'a');
      service.log('health-change', 'b');
      service.log('health-change', 'c');

      const events = service.events();
      // Newest-first → ids descend in display order, but each unique
      expect(events.map((e) => e.id)).toEqual([3, 2, 1]);
    });
  });

  describe('200-event cap', () => {
    it('keeps last 200 events when more are logged', () => {
      // Memory-safety contract: long sessions shouldn't OOM. Pinned
      // because removing the slice(0, 199) would let history grow
      // unboundedly.
      for (let i = 0; i < 250; i++) {
        service.log('diagnostic-run', `event-${i}`);
      }

      const events = service.events();
      expect(events).toHaveLength(200);
      // Newest still first
      expect(events[0].message).toBe('event-249');
      // Last 200 → oldest preserved is event-50 (250 - 200)
      expect(events[199].message).toBe('event-50');
    });
  });

  describe('clear()', () => {
    it('empties the events signal', () => {
      service.log('customer-create', 'a');
      service.log('customer-update', 'b');
      expect(service.events()).toHaveLength(2);

      service.clear();

      expect(service.events()).toEqual([]);
    });

    it('does NOT reset the id counter (avoids id reuse on re-log)', () => {
      // Pinned: ids must remain unique across the session for stable
      // rendering keys. Resetting the counter on clear() would let
      // `id=1` appear twice in the same session if events are logged
      // again — Angular's @for tracking would mis-match.
      service.log('customer-create', 'first');
      service.clear();
      service.log('customer-create', 'second');

      expect(service.events()[0].id).toBe(2); // NOT 1
    });
  });

  describe('filterByType()', () => {
    beforeEach(() => {
      service.log('customer-create', 'a');
      service.log('customer-update', 'b');
      service.log('customer-create', 'c');
      service.log('health-change', 'd');
    });

    it('returns only events of the requested type', () => {
      const creates = service.filterByType('customer-create');

      expect(creates).toHaveLength(2);
      expect(creates.every((e) => e.type === 'customer-create')).toBe(true);
    });

    it('preserves the newest-first ordering of the source array', () => {
      const creates = service.filterByType('customer-create');

      // 'c' was logged after 'a' → comes first
      expect(creates[0].message).toBe('c');
      expect(creates[1].message).toBe('a');
    });

    it('returns empty array when no events match', () => {
      const env = service.filterByType('env-switch');

      expect(env).toEqual([]);
    });

    it('returns a NEW array, not a reference to the signal value', () => {
      // Pinned: filter returns a new array (Array.prototype.filter does).
      // Mutating the result must NOT affect the events signal.
      const creates = service.filterByType('customer-create');
      creates.push({
        id: 999,
        type: 'customer-create',
        message: 'fake',
        timestamp: new Date(),
      });

      expect(service.events().some((e) => e.message === 'fake')).toBe(false);
    });
  });
});
