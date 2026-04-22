/**
 * Unit tests for the pure helpers extracted from `customers.component.ts`
 * (Phase B-7, 2026-04-22). These tests need no TestBed — the helpers have
 * zero Angular / signal coupling by design.
 */
import { uuid, randomCustomer } from './customers-helpers';
import { RANDOM_FIRST_NAMES, RANDOM_LAST_NAMES } from './customers-data';

describe('customers-helpers', () => {
  describe('uuid()', () => {
    it('returns a canonical UUID v4 string (8-4-4-4-12 hex + version 4)', () => {
      const id = uuid();
      // crypto.randomUUID() always emits v4 per WHATWG spec — regex asserts
      // the shape + that the 13th hex digit is `4` + the 17th is 8/9/a/b
      // (variant bits). Guarding against a silent replacement with a weaker
      // generator (e.g. Math.random) is the actual value of this test.
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('returns a distinct value on successive calls', () => {
      // 1000 iterations: collision probability for UUID v4 in this range is
      // ~5e-34 — a collision in the test is a near-certain implementation
      // regression (e.g. hard-coded value, bad mock).
      const seen = new Set<string>();
      for (let i = 0; i < 1000; i++) seen.add(uuid());
      expect(seen.size).toBe(1000);
    });
  });

  describe('randomCustomer()', () => {
    it('returns a name built from the two seed pools + an example.com email', () => {
      const { name, email } = randomCustomer();

      // Name is `First Last`, both drawn from the known pools.
      const parts = name.split(' ');
      expect(parts.length).toBe(2);
      expect(RANDOM_FIRST_NAMES as readonly string[]).toContain(parts[0]);
      expect(RANDOM_LAST_NAMES as readonly string[]).toContain(parts[1]);

      // Email: lowercased first + last + random suffix + @example.com.
      // The suffix is base-36 (0-9 a-z) and non-empty; `0` encodes as '0',
      // not empty string.
      expect(email).toMatch(/^[a-z]+\.[a-z]+\.[0-9a-z]+@example\.com$/);
    });

    it('keeps every generated email within the example.com TLD (no real-inbox collision)', () => {
      for (let i = 0; i < 100; i++) {
        const { email } = randomCustomer();
        expect(email.endsWith('@example.com')).toBe(true);
      }
    });

    it('varies across calls (not a constant)', () => {
      // 50 iterations, at least 2 distinct (name, email) pairs expected —
      // the name pools multiply to 26 × 20 = 520 combinations + a 4-char
      // base-36 suffix, so >98 % probability of at least 2 uniques even in
      // 10 draws.
      const seen = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { name, email } = randomCustomer();
        seen.add(`${name}|${email}`);
      }
      expect(seen.size).toBeGreaterThan(1);
    });
  });
});
