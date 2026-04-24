# Mirador UI — Documentation

All long-form documentation for the Angular 21 frontend. The root
`README.md` links here; everything more detailed than a paragraph lives
under this tree.

## Layout

```
docs/
├── README.md               ← you are here (index)
├── adr/                    ← Architecture Decision Records (1 per decision)
├── architecture/           ← tab-by-tab prose from the About page
├── getting-started/        ← first-time setup, env vars, run.sh
├── guides/                 ← UI user manual, shortcuts, theming
├── reference/              ← architecture diagram, ports, technology glossary
├── ops/                    ← CI/CD, build, Docker control API, proxy
├── compodoc/               ← auto-generated (gitignored)
└── typedoc/                ← auto-generated (gitignored)
```

## Architecture decisions

Non-obvious architectural choices are captured in **ADRs** (Michael Nygard
format). The canonical index lives at [`adr/README.md`](adr/README.md) —
it lists every ADR with status, and the numbers are stable once merged.

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
| [`reference/prometheus-metrics-ui.md`](reference/prometheus-metrics-ui.md) | Catalogue of every Prom metric the UI reads + which page consumes it. |

## Architecture (tab-by-tab)

Prose content from the About page (`src/app/features/about/`) extracted so
it's readable without running the UI. One file per tab — diagrams stay in
the component because Markdown can't do SVG justice.

| Doc                                                                          | Tab                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| [`architecture/README.md`](architecture/README.md)                           | Index with all 14 tabs                        |
| [`architecture/overview.md`](architecture/overview.md)                       | Full-stack summary                            |
| [`architecture/infrastructure.md`](architecture/infrastructure.md)           | Services, ports, `bin/run.sh` reference           |
| [`architecture/deployment.md`](architecture/deployment.md)                   | Top-level deployment overview                 |
| [`architecture/deployment-docker.md`](architecture/deployment-docker.md)     | Docker Compose deep-dive (every service).     |
| [`architecture/deployment-kubernetes.md`](architecture/deployment-kubernetes.md) | K8s manifests + Argo CD reconciliation.   |
| [`architecture/deployment-gcp.md`](architecture/deployment-gcp.md)           | GCP-specific GKE Autopilot + WIF + GSM.       |
| [`architecture/observability.md`](architecture/observability.md)             | Traces, logs, metrics, profiles routing       |
| [`architecture/security.md`](architecture/security.md)                       | Auth modes, RBAC, vulnerable-demo endpoints   |
| [`architecture/messaging.md`](architecture/messaging.md)                     | Kafka topics + request-reply pattern.         |
| [`architecture/data.md`](architecture/data.md)                               | Postgres schema + Flyway migration policy.    |
| [`architecture/resilience.md`](architecture/resilience.md)                   | Resilience4j circuit breaker / retry / bulkhead. |
| [`architecture/testing.md`](architecture/testing.md)                         | Unit / integration / E2E / visual / mutation pyramid. |
| [`architecture/compatibility.md`](architecture/compatibility.md)             | SB3/SB4 × Java 17/21/25 compatibility matrix. |
| [`architecture/ui-grafana-audit.md`](architecture/ui-grafana-audit.md)       | What the UI duplicates from Grafana — audit + retirement plan. |
| [`architecture/ui-prom-removal-impact.md`](architecture/ui-prom-removal-impact.md) | Impact analysis: removing the in-UI Prometheus calls. |
| [`architecture/technology-stack.md`](architecture/technology-stack.md)       | Short per-tech usage notes (the About tab).   |

## Ops (running it in CI and production)

| Doc                                                             | Topic                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| [`ops/ci-cd.md`](ops/ci-cd.md)                                  | GitLab CI jobs + lefthook pre-commit/commit-msg/pre-push       |
| [`ops/ci-timings.md`](ops/ci-timings.md)                        | Measured per-job + per-stage CI/CD durations (median over 5 MR pipelines) |
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

## Roadmap

| Doc                                             | Topic                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| [`ROADMAP.md`](ROADMAP.md)                      | Tier-1 / Tier-2 ROADMAP — moved out of repo root per root hygiene. |

## Cross-repo

- Backend companion docs: `../../mirador-service/docs/` (same layout).
- Technology glossary for the backend:
  [mirador-service/docs/reference/technologies.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/reference/technologies.md)

## Follow-ups (see `../TASKS.md`)

- Extract prose currently embedded in `src/app/features/about/` into
  `docs/architecture/*.md` files.
- UI → Grafana migration audit (observability views that duplicate
  native Grafana dashboards).
