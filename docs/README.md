# `docs/` — Documentation index

Every long-form doc for this repo lives here. The root `README.md` stays thin and links out
to the files below. This file is the source of truth for documentation hand-written by
humans; the auto-generated API reference lives under `compodoc/` and `typedoc/`.

> **Note.** Component-embedded prose from `src/app/features/about/` is scheduled to be
> extracted into `docs/architecture/*.md`. Tracked in `TASKS.md`.

## Handwritten guides

| File                                       | Topic                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| [architecture.md](architecture.md)         | Mermaid architecture diagram + core Angular services                         |
| [quick-start.md](quick-start.md)           | Prereqs, cloning both repos, booting the stack                               |
| [run-sh.md](run-sh.md)                     | Every `run.sh` subcommand and what it delegates to                           |
| [environment.md](environment.md)           | `.env` / `.env.example` reference for every variable                         |
| [user-manual.md](user-manual.md)           | Per-feature walkthrough of all 10 pages in the UI                            |
| [keyboard-shortcuts.md](keyboard-shortcuts.md) | Global shortcuts (Vim-style `G` sequences, `D` for dark mode, …)         |
| [theming.md](theming.md)                   | Dark/light mode + multi-environment switcher                                 |
| [ports.md](ports.md)                       | Every local URL exposed by the stack                                         |
| [proxy.md](proxy.md)                       | Angular dev-server proxy rules (`config/proxy.conf.json`)                    |
| [docker-api.md](docker-api.md)             | `scripts/docker-api.mjs` — Docker control server + observability proxy       |
| [ci-cd.md](ci-cd.md)                       | GitLab CI jobs + pre-push hook                                               |
| [build-quality.md](build-quality.md)       | npm scripts + bundle budgets                                                 |
| [technologies.md](technologies.md)         | **Placeholder** — long technology glossary (one entry per dep, in progress)  |

## Architecture Decision Records

See [`adr/`](adr/) for the full index. Current records:

| ID   | Status   | Title                                                                                  |
| ---- | -------- | -------------------------------------------------------------------------------------- |
| 0001 | Accepted | [Record architecture decisions](adr/0001-record-architecture-decisions.md)             |
| 0002 | Accepted | [Zoneless change detection + Signals](adr/0002-zoneless-and-signals.md)                |
| 0003 | Accepted | [Raw SVG for all visualizations, no charting library](adr/0003-raw-svg-charts.md)      |
| 0004 | Accepted | [Vitest over Jest for unit tests](adr/0004-vitest-over-jest.md)                        |
| 0005 | Accepted | [Standalone components, no NgModules](adr/0005-standalone-components.md)               |

## Auto-generated API docs

This directory also holds HTML docs generated from the TypeScript source. Nothing in those
sub-folders is hand-written — regenerate with the commands below. The generated HTML is
served locally by the `mirador-service/infra/nginx/compodoc.conf` proxy at
<http://localhost:8085>.

| Directory                | Generator                                                                                                                     | Command                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`compodoc/`](compodoc/) | [Compodoc](https://compodoc.app/) — Angular-aware API reference covering components, services, directives, pipes, and routes. | `npm run compodoc`                             |
| [`typedoc/`](typedoc/)   | [TypeDoc](https://typedoc.org/) — generic TypeScript API reference; useful for non-Angular utility modules.                   | `npm run typedoc` (config in `config/typedoc.json`) |

Both folders are **git-ignored** — their content is auto-generated and can be rebuilt
anywhere at any time.

### Why two generators?

Compodoc understands Angular-specific constructs (`@Component`, `@Input`, router config) and
produces a UI optimized for navigating a component tree. TypeDoc is purely TypeScript-aware
— it gives richer coverage for regular interfaces, types, and helper functions that aren't
Angular decorators. Neither fully replaces the other, so we ship both.

### Serving

For local dev:

```bash
npm run compodoc:serve   # opens http://localhost:8080
npm run typedoc:serve    # opens http://localhost:8081
```

In the project-wide Docker stack:

```bash
# from mirador-service repo root
./run.sh obs             # also brings up the compodoc nginx proxy
# browse to http://localhost:8085
```

### Publishing

In the GitLab CI `typedoc` job, the generated HTML is uploaded as a pipeline artifact for
download. It is NOT deployed to production — the only "always-on" copy is the nginx
compodoc container in the local stack.

### What NOT to put here

- Hand-written guides → already live in this `docs/` directory (see the table at the top).
- Cross-repo human-facing documentation → the Spring Boot project's `docs/` is the
  authoritative home for documentation that spans the whole system.
- Screenshots for docs → `mirador-service/docs/screenshots/`.
- Build output → `/dist/` (Angular production bundle).
