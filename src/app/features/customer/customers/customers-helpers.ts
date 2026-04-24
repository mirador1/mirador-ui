/**
 * customers-helpers.ts — pure helpers extracted from `customers.component.ts`
 * under Phase B-7 (2026-04-22) as a preparatory step toward a full component
 * split. Moving the pure, framework-free helpers out of the component file:
 *
 *  - shrinks the component file so signal/lifecycle logic fits in one
 *    screen,
 *  - makes the helpers individually testable without TestBed,
 *  - gives the "random demo customer" feature a natural home alongside the
 *    name pools in `customers-data.ts`.
 */
import { RANDOM_FIRST_NAMES, RANDOM_LAST_NAMES } from './customers-data';

/**
 * Generate a UUID v4 string for use as idempotency keys.
 * Uses `crypto.randomUUID()` — available in all modern browsers and
 * Node.js 14.17+. Wrapped as a helper so the component doesn't leak
 * the `crypto` global into its signals code path.
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Produce a random `{ name, email }` pair suitable for the Create Customer
 * flow. Keeps the email address in the `example.com` TLD so generated demo
 * data never collides with a real inbox. Randomness uses `Math.random()`
 * — this is purely a UX convenience, not a security-sensitive path.
 */
export function randomCustomer(): { name: string; email: string } {
  const first = RANDOM_FIRST_NAMES[Math.floor(Math.random() * RANDOM_FIRST_NAMES.length)];
  const last = RANDOM_LAST_NAMES[Math.floor(Math.random() * RANDOM_LAST_NAMES.length)];
  // Short random suffix keeps the email unique across clicks — avoids the
  // backend's duplicate-email rejection when the same name pair is drawn
  // twice in the same session.
  const suffix = Math.floor(Math.random() * 10000).toString(36);
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${suffix}@example.com`,
  };
}

/**
 * Extract a human-readable error message from HTTP error responses.
 * Handles the 3 status codes with project-specific meaning (401 auth,
 * 429 rate limit, 504 Kafka reply timeout) ; falls back to generic
 * `Error {status}: {message}` for everything else. Moved here from
 * `customers.component.ts` in B-7-2c Step 3 so CustomerCrudService
 * + CustomersComponent can share one implementation.
 */
export function httpError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e.status === 401) return 'Not authenticated — please sign in.';
  if (e.status === 429) return '429 Too Many Requests — rate limit exceeded.';
  if (e.status === 504) return '504 Gateway Timeout — Kafka reply timed out (5 s).';
  return `Error ${e.status ?? '?'}: ${e.message ?? 'unknown'}`;
}
