/**
 * customers-data.ts — static name pools used by the demo-only
 * `Add Random Customer` feature in `CustomersComponent`.
 *
 * Kept as a separate file (rather than an inline constant in the component)
 * because the component file crossed the 800-LOC mark and these 40+ entries
 * were dominant noise in scroll-through reads. Splitting here is a prep
 * step for a future `customers.component.ts` split by concern
 * (list / CRUD / detail tabs).
 *
 * Content: 26 French-style first names + 20 French-style last names, all
 * ASCII for email-safe lowercasing. Not locale-sensitive on purpose —
 * the demo is the same regardless of the visiting user's locale.
 */

/** First-name pool for randomly generated demo customers. */
export const RANDOM_FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Evan',
  'Fiona',
  'Gabriel',
  'Hannah',
  'Isaac',
  'Julia',
  'Kevin',
  'Laura',
  'Marc',
  'Nora',
  'Oliver',
  'Paula',
  'Quentin',
  'Rachel',
  'Samir',
  'Tara',
  'Ugo',
  'Vera',
  'William',
  'Xavier',
  'Yasmine',
  'Zoe',
] as const;

/** Last-name pool for randomly generated demo customers. */
export const RANDOM_LAST_NAMES = [
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
] as const;
