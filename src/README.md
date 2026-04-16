# `src/` — Angular 21 application source

Standalone components, zoneless change detection, signal-based state.
Entry point: `main.ts`.

## Files

| File         | Purpose                                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| `main.ts`    | Bootstraps Angular with `provideZonelessChangeDetection` + `app.config.ts`.      |
| `index.html` | HTML shell — a single `<app-root>` element + favicon link.                       |
| `styles.scss`| Global styles + CSS custom properties driving the dark/light theme.              |

## Subdirectories

| Directory    | Contents                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------- |
| [`app/`](app/) | Root component, router config, feature pages, core services, shared UI primitives.       |

## Not here

- Static assets (favicon, manifest, logos) → `../public/`
- Generated output → `../dist/`
- Hand-written docs → `../docs/`

## Conventions

- **Zoneless.** No `Zone.js`, no `fakeAsync`, no `tick()`, no `detectChanges()`.
- **Signals first.** State lives in `signal()` / `computed()` / `effect()`.
  Reach for `ngModel` / RxJS only when signals don't fit.
- **Control flow.** Use `@if`, `@for`, `@switch` in templates — not the
  legacy `*ngIf` / `*ngFor` structural directives.
- **Standalone components.** No NgModules. Every component imports its deps.
- **Charts & visualisations.** Raw SVG. No charting library — see ADR (TBD)
  in `../docs/adr/` for the rationale.
