# ADR-0002: Zoneless change detection + Signals

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

Angular's default change detection relies on Zone.js, which monkey-
patches every asynchronous API (`setTimeout`, `fetch`, `addEventListener`,
etc.) to trigger change detection cycles. Downsides:

- ~100 kB of zone polyfill in the bundle.
- Opaque behaviour: every async callback triggers a re-render somewhere.
- Unit tests require `fakeAsync` / `tick` gymnastics.
- Doesn't compose with modern reactive primitives (RxJS observables,
  Angular Signals) — those have their own scheduling.

Angular 17 introduced zoneless as a supported mode; Angular 19 and 20
stabilised the APIs; Angular 21 ships it as the recommended default.

## Decision

This app runs **zoneless**:

```ts
provideZonelessChangeDetection()   // in app.config.ts
```

No Zone.js import, no polyfill. All reactive state lives in Angular
**Signals** (`signal()`, `computed()`, `effect()`). RxJS is used only
at integration boundaries (HTTP, WebSockets).

## Consequences

### Positive
- ~100 kB smaller bundle.
- Change detection is deterministic: the UI re-renders only when a
  signal it depends on changes.
- Test ergonomics: no `fakeAsync`, no `tick`, no `detectChanges`.
  Signals update synchronously; assertions run immediately.
- Matches Angular's direction of travel — future APIs assume signals.

### Negative
- Some third-party libraries still internally use Zone callbacks. We
  accept the occasional extra re-render but don't install `zone.js`.
- `async` pipe is discouraged in templates (use `toSignal(...)` instead).

### Neutral
- Control-flow syntax (`@if`, `@for`, `@switch`) is used throughout; the
  structural-directive forms (`*ngIf`, `*ngFor`) are banned by convention.

## Alternatives considered

### Alternative A — Keep Zone.js

Rejected: the ergonomic and bundle-size wins of zoneless + signals are
substantial, and the core team recommends it.

### Alternative B — Signals only inside a zoned app

Partial win: you still pay the Zone.js tax but gain signal ergonomics.
Rejected because we don't want both systems running.

## References

- `src/app/app.config.ts` — `provideZonelessChangeDetection()` wiring.
- [Angular zoneless guide](https://angular.dev/guide/experimental/zoneless)
- [Signals guide](https://angular.dev/guide/signals)
