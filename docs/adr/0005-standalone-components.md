# ADR-0005: Standalone components, no NgModules

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

`@NgModule` was the original Angular composition unit. It caused every
new project to start with 4-6 files of boilerplate (app.module, each
feature module, a shared module, etc.) plus cargo-culted `declarations`
and `imports` arrays. Angular 14 introduced standalone components;
Angular 17 deprecated module-based bootstrap; Angular 21 removes any
reason to use NgModules for new code.

## Decision

Every component, directive, and pipe is marked `standalone: true`
(or rather, inherits it — in Angular 21 standalone is the default).
There is **no `app.module.ts`**. The app bootstraps via
`bootstrapApplication` in `main.ts`:

```ts
bootstrapApplication(App, appConfig);
```

Dependencies are imported in each component's `imports: [...]` array.
Providers go in `app.config.ts` (`ApplicationConfig.providers`).

## Consequences

### Positive
- Zero boilerplate module files.
- Each component declares its own imports — refactoring a component's
  deps doesn't touch a central NgModule.
- Lazy loading is expressed at the route level
  (`loadComponent: () => import(...)`), not via `loadChildren` +
  nested modules.
- Static analysis (tree-shaking, lazy-chunk extraction) is more accurate
  because imports are local.

### Negative
- Some older Angular libraries still ship NgModule-only APIs. We have
  been lucky — all our deps are standalone-compatible today.

### Neutral
- Testing: standalone components are imported directly in `TestBed`
  configuration instead of being declared.

## Alternatives considered

### Alternative A — Use NgModules for legacy reasons

Rejected. No legacy to preserve.

### Alternative B — Hybrid (some standalone, some NgModule)

Rejected: mixing the two makes the mental model confusing for no
practical gain.

## References

- `src/main.ts` — `bootstrapApplication` call.
- `src/app/app.config.ts` — central provider list.
- [Angular standalone guide](https://angular.dev/guide/components/importing)
