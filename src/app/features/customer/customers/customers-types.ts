/**
 * customers-types.ts — type aliases used by `customers.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-7 file-length hygiene, same pattern
 * as `quality-types.ts` and `diagnostic-types.ts`. Pure types (zero
 * runtime) keep the component file focused on behaviour.
 */

/** Per-customer detail panel tab identifier. */
export type DetailTab = 'bio' | 'todos' | 'enrich';

/** Column that the customer list can be sorted by. */
export type SortField = 'id' | 'name' | 'email' | 'createdAt';

/** Sort direction for the customer list. */
export type SortDir = 'asc' | 'desc';
