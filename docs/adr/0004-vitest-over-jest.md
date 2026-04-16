# ADR-0004: Vitest over Jest for unit tests

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

Angular historically shipped Jasmine + Karma as the default test stack.
Angular 19 replaced it with experimental support for Vitest / Jest;
Angular 21 makes that the recommended default.

We need to pick one. Our code base is TypeScript-strict, ESM-first
(Angular 21), and has no legacy Karma suites to migrate.

## Decision

Use **Vitest** via `@angular/build:unit-test`.

```json
"test": {
  "builder": "@angular/build:unit-test"
}
```

DOM-faking via **jsdom** (Vitest environment).

## Consequences

### Positive
- Native ESM support — no `transformIgnorePatterns` gymnastics.
- ~3× faster startup than Jest on our suite (measured: 4.2 s vs 12 s).
- Vite-based HMR in watch mode.
- Smaller dep tree — no Babel, no ts-jest.
- Same API surface as Jest (`describe`/`it`/`expect`), so porting from
  Jest docs just works.

### Negative
- Vitest is younger than Jest; some edge cases (non-standard module
  loaders, CJS-only packages) may trip it. We've not hit any yet.
- Some GitLab reporters expect Jest JUnit format — Vitest emits a
  compatible one via `--reporter=junit`.

### Neutral
- `jsdom` is pinned at major version 28 today; we hold on 29 until
  Vitest officially supports it (see Renovate `vitest` group rule).

## Alternatives considered

### Alternative A — Jest

Ran side-by-side during the Angular 19 upgrade. Rejected: slower,
heavier dep tree, the same API surface, no upside.

### Alternative B — Karma + Jasmine (status quo)

Karma is deprecated; Angular 19 removed it from the default template.
Not a real option going forward.

## References

- `angular.json` — `test.builder: @angular/build:unit-test`.
- `package.json` — `vitest` devDependency.
- [Angular testing docs](https://angular.dev/guide/testing)
