# Mirador UI — Documentation

All long-form documentation for the Angular 21 frontend. The root
`README.md` links here; everything more detailed than a paragraph lives
under this tree.

## Layout

```
docs/
├── README.md               ← you are here (index)
├── adr/                    ← Architecture Decision Records (1 per decision)
├── getting-started/        ← first-time setup, env vars, run.sh
├── guides/                 ← UI user manual, shortcuts, theming
├── reference/              ← architecture, ports, technology glossary
├── ops/                    ← CI/CD, build, Docker control API, proxy
├── compodoc/               ← auto-generated (gitignored)
└── typedoc/                ← auto-generated (gitignored)
```

## Architecture decisions

Non-obvious architectural choices are captured in **ADRs** (Michael Nygard
format). Start with the index: [`adr/README.md`](adr/README.md).

| ID   | Status    | Decision                                                           |
| ---- | --------- | ------------------------------------------------------------------ |
| 0001 | Accepted  | [Record architecture decisions](adr/0001-record-architecture-decisions.md)      |
| 0002 | Accepted  | [Zoneless change detection + Signals](adr/0002-zoneless-and-signals.md)         |
| 0003 | Accepted  | [Raw SVG for all visualizations](adr/0003-raw-svg-charts.md)                    |
| 0004 | Accepted  | [Vitest over Jest for unit tests](adr/0004-vitest-over-jest.md)                 |
| 0005 | Accepted  | [Standalone components, no NgModules](adr/0005-standalone-components.md)        |

## Getting started

| Doc                                                                    | Topic                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`getting-started/quick-start.md`](getting-started/quick-start.md)     | Prereqs, cloning both repos, first-time boot                       |
| [`getting-started/run-sh.md`](getting-started/run-sh.md)               | Every subcommand of the launcher                                   |
| [`getting-started/environment.md`](getting-started/environment.md)     | `.env` reference for every variable                                |

## Guides (how to use the UI)

| Doc                                                                      | Topic                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`guides/user-manual.md`](guides/user-manual.md)                         | Per-feature walkthrough of every page                            |
| [`guides/keyboard-shortcuts.md`](guides/keyboard-shortcuts.md)           | Vim-style `G`+key navigation, `D` for dark mode, `?` for help   |
| [`guides/theming.md`](guides/theming.md)                                 | Dark/light toggle + Local/Docker/Staging/Prod env switcher      |

## Reference (what it is, in detail)

| Doc                                                                | Topic                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| [`reference/architecture.md`](reference/architecture.md)           | Mermaid diagram of UI + backend + observability stack            |
| [`reference/ports.md`](reference/ports.md)                         | Every local URL exposed by the full stack                        |
| [`reference/technologies.md`](reference/technologies.md)           | Long-form technology glossary (~1200 lines, 209 entries)          |

## Ops (running it in CI and production)

| Doc                                                             | Topic                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| [`ops/ci-cd.md`](ops/ci-cd.md)                                  | GitLab CI jobs + lefthook pre-commit/commit-msg/pre-push       |
| [`ops/build-quality.md`](ops/build-quality.md)                  | npm scripts, bundle budgets, Prettier                           |
| [`ops/docker-api.md`](ops/docker-api.md)                        | `scripts/docker-api.mjs` — Docker control + observability proxy |
| [`ops/proxy.md`](ops/proxy.md)                                  | Angular dev-server proxy rules (`config/proxy.conf.json`)       |

## Auto-generated API docs

HTML generated from the TypeScript source. Nothing hand-written lives
there — regenerate any time. Both folders are **git-ignored**.

| Directory                | Generator                                                                        | Command                                               |
| ------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`compodoc/`](compodoc/) | [Compodoc](https://compodoc.app/) — Angular-aware (components, services, routes) | `npm run compodoc` (config in `config/.compodocrc.json`) |
| [`typedoc/`](typedoc/)   | [TypeDoc](https://typedoc.org/) — generic TypeScript API reference               | `npm run typedoc`  (config in `config/typedoc.json`)   |

### Why two generators?

Compodoc understands Angular-specific constructs (`@Component`, `@Input`,
router config) and produces a UI optimised for navigating a component
tree. TypeDoc is purely TypeScript-aware — richer coverage for
utility modules that aren't Angular decorators. Neither fully replaces
the other, so we ship both.

### Serve locally

```bash
npm run compodoc:serve   # default port
npm run typedoc          # static generation only
```

## Cross-repo

- Backend companion docs: `../../mirador-service/docs/` (same layout).
- Technology glossary for the backend:
  [mirador-service/docs/reference/technologies.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/reference/technologies.md)

## Follow-ups (see `../TASKS.md`)

- Extract prose currently embedded in `src/app/features/about/` into
  `docs/architecture/*.md` files.
- UI → Grafana migration audit (observability views that duplicate
  native Grafana dashboards).
