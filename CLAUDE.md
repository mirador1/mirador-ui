# Mirador UI — Claude Instructions

## Claude workflow rules (apply to every session)

- **Do not stop** between tasks — chain all pending work without asking "shall I continue?".
- **Act directly** — read only what is strictly necessary, then make the change.
- **One commit per logical change** — do not batch unrelated fixes.
- **Run the build after every change** (`npm run build -- --configuration production`) and fix errors before committing. Build must have zero warnings.
- **Comments explain why**, not what. Write comments that a future Claude session with no conversation history can understand.
- After significant feature work, **do a code review pass**: unused imports (`NG8113`), `any` types, silent error handlers, missing types on HTTP calls.
- **Never modify files outside this project** unless explicitly asked.

## Project overview

Angular 21 frontend for the `mirador-service` Spring Boot backend.
Provides observability dashboard, customer management, diagnostics, chaos testing, and visualisations.

- **Entry point:** `src/main/ts` / `src/app/app.ts`
- **Config:** `angular.json`, `proxy.conf.json`, `.env` (optional)
- **Backend** must be cloned as a sibling: `../workspace-modern/mirador-service/`

## Angular rules — critical

This project uses **Angular 21 with zoneless change detection** (no Zone.js).

- **DO NOT** use `fakeAsync`, `tick()`, `detectChanges()`, or `TestBed` in tests.
- **DO NOT** use `*ngIf`, `*ngFor`, `*ngSwitch` — use `@if`, `@for`, `@switch` control flow blocks.
- **DO NOT** use `ngModel` for reactive state — use `signal()` and computed signals.
- All charts and visualisations use raw SVG (no charting library). Keep it that way.
- When editing templates with `${}` interpolation, avoid `replace_all` — use targeted edits to prevent corrupting string interpolation.

## Build and quality

```bash
npm run build -- --configuration production   # production build (must have 0 warnings)
npm test                                       # unit tests
```

Budget limits in `angular.json`:
- Initial JS: 500 kB warning / 1 MB error
- Component SCSS: **24 kB** warning / 32 kB error  
  _(dashboard.component.scss and observability.component.scss legitimately exceed 12 kB — budget was raised intentionally)_

## Git workflow

- Branch: `dev`. One commit per logical change.
- Push: `git push origin dev`.
- Pre-push hook runs prettier and pre-push checks — do not skip.
- Never push to `main` directly.

## Key architecture patterns

```
AppShellComponent (layout: topbar + sidebar + router-outlet)
  └── Feature components (lazy-loaded via app.routes.ts)
        └── Core services (singleton, provided in root):
              ApiService      — all HTTP calls to backend
              AuthService     — JWT token (signal-based)
              EnvService      — multi-environment URL switching
              ThemeService    — dark/light mode
              ToastService    — ephemeral notifications
              MetricsService  — Prometheus polling + percentile computation
              ActivityService — in-session event timeline
```

## Type safety rules

- **No `any` types** in component code. Use specific interfaces or `unknown` with type guards.
- `getHealth()` returns `Observable<unknown>` — cast to `{ status?: string }` at the call site, not `any`.
- When calling `http.post<T>()` or `http.get<T>()`, always provide the generic type parameter.
- Use `Customer`, `Page<T>`, `CustomerSummary`, etc. from `api.service.ts` — do not redeclare them locally.

## Import hygiene

- After every edit to a component, verify that all imports in the `imports: []` array are actually used in the template.
- Unused Angular imports trigger `NG8113` build warnings — fix them immediately.
- Merge multiple imports from the same package into one `import` statement.

## Error handling

- HTTP error handlers must never be empty `error: () => {}` unless the failure is expected and a comment explains why.
- `catch { /* ignore */ }` blocks must at minimum log to `ActivityService` or `ToastService` so the user knows something failed.
- Silent failures make the dashboard look correct when it isn't.

## Component SCSS

- Global tokens (colours, spacing, shadows) are defined in `src/styles.scss` as CSS custom properties — use them instead of hardcoding values.
- Dashboard and observability components have large SCSS files by design (complex layout, many states). Do not refactor unless explicitly asked.

## Code review checklist (run proactively after significant changes)

- [ ] Zero `NG8113` warnings in production build
- [ ] No `any` types introduced
- [ ] All imports in `imports: []` arrays actually used in templates
- [ ] No `*ngIf`/`*ngFor` directives (use `@if`/`@for`)
- [ ] Error handlers are not silently empty
- [ ] New services are added to the correct `imports` or `providers` array
