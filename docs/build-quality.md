# Build & Quality

## npm scripts

```bash
npm run build        # production bundle -> dist/
npm test             # vitest unit tests
npm run format       # auto-fix formatting with Prettier
npm run format:check # check formatting without modifying
npm run typecheck    # standalone TypeScript strict check (tsc --noEmit)
npm run dev          # start Docker API + dev server in parallel
npm start            # dev server only (ng serve with proxy)
```

## Bundle Budgets

Configured in `angular.json`:

- **Initial bundle** — warning at 500 kB, error at 1 MB
- **Any component style** — warning at 12 kB, error at 16 kB

Budgets are enforced both in the `build:production` CI job and in the `bundle-size-check` quality job — a budget violation fails the pipeline rather than just printing a warning.

## See also

- [CI/CD](ci-cd.md) — how these scripts run in the pipeline and in the pre-push hook
- [ADR 0004 — Vitest over Jest for unit tests](adr/0004-vitest-over-jest.md) — why `npm test` uses Vitest
