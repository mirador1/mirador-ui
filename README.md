![Mirador UI](public/banner.svg)

<sub>**English** · [Français](README.fr.md)</sub>

<!-- Build / release status — GitLab canonical, GitHub mirror for visibility. -->
[![pipeline](https://gitlab.com/mirador1/mirador-ui/badges/main/pipeline.svg)](https://gitlab.com/mirador1/mirador-ui/-/pipelines)
[![latest release](https://gitlab.com/mirador1/mirador-ui/-/badges/release.svg)](https://gitlab.com/mirador1/mirador-ui/-/releases)
[![CodeQL](https://github.com/mirador1/mirador-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/mirador1/mirador-ui/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/mirador1/mirador-ui/badge)](https://scorecard.dev/viewer/?uri=github.com/mirador1/mirador-ui)

<!-- Top-line badges : 8 essentials. The exhaustive tech matrix moved
     to a "Technology coverage" section further down. -->
![Angular 21](https://img.shields.io/badge/Angular-21_zoneless-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![OpenTelemetry Web](https://img.shields.io/badge/OpenTelemetry-Web_SDK-7F52FF?logo=opentelemetry&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-unit_zoneless-6E9F18?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E_kind--in--CI-2EAD33?logo=playwright&logoColor=white)
![SonarCloud](https://img.shields.io/badge/SonarCloud-quality_gate-F3702A?logo=sonarcloud&logoColor=white)

## What this project proves

Mirador-UI is the **front-row seat** of the [Mirador](https://gitlab.com/mirador1)
polyrepo demo : an Angular 21 zoneless dashboard that observes a live
backend (Java OR Python sibling) from every angle in one place.

Industrial frontend concerns demonstrated :
- **Zoneless Angular** : signals + computed only, no Zone.js, native change detection.
- **OTel browser tracing** : every HTTP call carries a trace ID into the backend ; same
  trace visible in Tempo end-to-end.
- **No chart library** : raw SVG with `viewBox` + signals — full responsive,
  no bundle bloat from Chart.js / Highcharts.
- **Mobile-first responsive** : every component verified at 375 px (iPhone SE),
  390 px (iPhone 12-14), 1280 px desktop ; sidebar collapses to drawer ≤ 768 px.
- **E2E with kind-in-CI** : Playwright runs against a real Spring Boot backend
  spawned in a kind cluster inside CI.
- **CI quality gate** : zero NG8113 warnings, no `any` types, no silent error
  handlers, conventional commits enforced.

## TL;DR for hiring managers (60 sec read)

- **Angular 21 zoneless** with signal-based state ; the demo proves you can
  ship modern Angular without Zone.js + without legacy ngrx.
- **Observability dashboard for a live backend** : not a CRUD demo — the UI
  surfaces JVM metrics, OTel traces, error timelines, SLO status from
  Prometheus / Tempo / Loki via a Grafana proxy.
- **Polyrepo coherence** : same UI talks to either [Java backend](https://gitlab.com/mirador1/mirador-service-java)
  or [Python backend](https://gitlab.com/mirador1/mirador-service-python) — same REST contract.
- **Quality bar** : Vitest unit + Playwright E2E kind-in-CI + SonarCloud +
  ESLint zero-warning + bundle size budget enforced.
- **Local CI runner** : same group-level macbook-local runner as the
  sibling repos (no SaaS quota burn).

# Mirador UI — front-row seat

> **Watch. Understand. Act.**
>
> _Built with the right tools and the right methods._

![Mirador UI demo — login, customer CRUD, dashboard](docs/media/demo.gif)

<sub>Regenerate with `bin/record-demo.sh` (needs ffmpeg + the local stack up).</sub>

> **Mirador** — Spanish for *watchtower* — is exactly what this project is:
> a vantage point over a real running system that lets you observe, in one
> place, **the code, the runtime metrics, the CI/CD pipelines, and the
> industrial tooling** wired around it. The UI is the front-row seat:
> health probes, traces, logs, quality reports, pipeline state, chaos
> actions, and live operational drill-down into the backend — backed by
> Grafana / Tempo / Loki / Prometheus for time-series observability.
>
> The repository is also a **concrete study in how far AI-assisted
> integration can go**. Every ADR, every CI hardening step, every
> supply-chain scanner, the K8s baseline, the observability wiring, the
> technology glossary and this README were authored in close
> collaboration with an LLM — specifically Anthropic's
> [Claude Opus 4.7](https://www.anthropic.com/claude) (1 M-token
> context), driven from the
> [Claude Code](https://docs.anthropic.com/claude/docs/claude-code)
> CLI. Each commit's `Co-Authored-By:` trailer names the exact model,
> so the git log doubles as an audit trail.
>
> This repository is the **Angular 21 frontend**. The Spring Boot 4
> backend lives at [`mirador-service`](https://gitlab.com/mirador1/mirador-service).

---

## Documentation

All long-form documentation lives under [`docs/`](docs/README.md). This README stays thin —
the UI itself is the demo; the docs explain how to run it and what each page does.

| Topic                                                            | What you get                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Architecture](docs/reference/architecture.md)                             | Mermaid diagram of Angular + backend + observability stack; core services  |
| [Quick start](docs/getting-started/quick-start.md)                               | Prereqs, cloning both repos, first-time boot                               |
| [`bin/run.sh` reference](docs/getting-started/run-sh.md)                             | Every subcommand of the launcher                                           |
| [Environment configuration](docs/getting-started/environment.md)                 | `.env` reference for every variable                                        |
| [User manual](docs/guides/user-manual.md)                               | Per-feature walkthrough (Dashboard, Customers, Diagnostic, Chaos, …)       |
| [Keyboard shortcuts](docs/guides/keyboard-shortcuts.md)                 | Vim-style `G`+key navigation, `D` for dark mode, `?` for help              |
| [Theming & multi-environment](docs/guides/theming.md)                   | Dark/light toggle and Local/Docker/Staging/Prod switching                  |
| [Port map](docs/reference/ports.md)                                        | Every local URL exposed by the full stack                                  |
| [Proxy configuration](docs/ops/proxy.md)                             | `config/proxy.conf.json` rules and rationale                               |
| [Docker control API](docs/ops/docker-api.md)                         | `scripts/docker-api.mjs` endpoints                                         |
| [CI / CD](docs/ops/ci-cd.md)                                         | GitLab pipeline jobs + pre-push hook                                       |
| [Build & quality](docs/ops/build-quality.md)                         | npm scripts + bundle budgets                                               |
| [Technology glossary](docs/reference/technologies.md)                      | *(in progress)* exhaustive reference of every dep used in this repo        |

### Architecture decisions

Non-obvious choices are justified in ADRs under [`docs/adr/`](docs/adr/README.md):

- [0001 — Record architecture decisions](docs/adr/0001-record-architecture-decisions.md)
- [0002 — Zoneless change detection + Signals](docs/adr/0002-zoneless-and-signals.md)
- [0003 — Raw SVG for all visualizations, no charting library](docs/adr/0003-raw-svg-charts.md)
- [0004 — Vitest over Jest for unit tests](docs/adr/0004-vitest-over-jest.md)
- [0005 — Standalone components, no NgModules](docs/adr/0005-standalone-components.md)
- [0006 — Keep UI dashboards alongside Grafana (for now)](docs/adr/0006-grafana-duplication.md)
- [0007 — Retire Prometheus-fed UI visualisations in favour of Grafana](docs/adr/0007-retire-prometheus-ui-visualisations.md)

### Auto-generated API reference

- **Compodoc** (Angular-aware) — `npm run compodoc`, output in [`docs/compodoc/`](docs/compodoc/)
- **TypeDoc** (raw TypeScript) — `npm run typedoc`, output in [`docs/typedoc/`](docs/typedoc/)

### Sibling repo

- Backend: **[`mirador-service`](https://gitlab.com/mirador1/mirador-service)** — Spring Boot 4 / Java 25, lives as a sibling directory so `bin/run.sh` can delegate infra commands.

---

## Project structure

```
mirador-ui/
├── src/
│   ├── main.ts                          # Application bootstrap (zoneless)
│   ├── styles.scss                      # Global styles + CSS custom properties
│   └── app/
│       ├── app.ts                       # Root component (renders AppShell)
│       ├── app.config.ts                # Angular providers (zoneless, router, HTTP + JWT interceptor)
│       ├── app.routes.ts                # Lazy-loaded feature routes (10 pages)
│       ├── core/                        # Singleton services (providedIn: 'root')
│       ├── features/                    # Lazy-loaded page components
│       └── shared/                      # Reusable UI components
├── scripts/
│   ├── docker-api.mjs                   # Node.js server — Docker control + Zipkin/Loki proxy
│   └── pre-push-checks.sh               # Git pre-push quality gate
├── config/
│   ├── proxy.conf.json                  # Angular dev server proxy rules
│   ├── typedoc.json                     # TypeDoc config
│   ├── .compodocrc.json                 # Compodoc config
│   └── sonar-project.properties         # SonarCloud config
├── build/
│   └── Dockerfile                       # Container build
├── deploy/
│   ├── nginx.conf                       # Runtime Nginx config
│   └── kubernetes/                      # K8s manifests
├── docs/                                # Hand-written docs + generated API reference
├── public/                              # Static assets (favicon, manifest, banner)
├── run.sh                               # Full-stack launcher (frontend + backend delegation)
├── angular.json                         # Angular CLI workspace config
└── tsconfig*.json                       # TypeScript configs (base / app / spec)
```

---

## Quick start

```bash
# Clone both repos as siblings (run from your dev root)
git clone https://gitlab.com/benoit.besson/mirador-service.git workspace-modern/mirador-service
git clone https://gitlab.com/benoit.besson/mirador-ui.git js/mirador-ui

# Start everything (Docker + backend + frontend) — one command
bash js/mirador-ui/run.sh
```

Sign in with **admin / admin** at <http://localhost:4200>. See [docs/getting-started/quick-start.md](docs/getting-started/quick-start.md) for prerequisites and troubleshooting.

---

## Tech stack (short version)

| Category          | Technology           | Details                                                                                         |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**     | Angular 21           | Standalone components, zoneless (`provideZonelessChangeDetection`), signals-based state         |
| **Language**      | TypeScript 5.9       | Strict mode enabled                                                                             |
| **Styling**       | SCSS                 | CSS custom properties for dark/light theming                                                    |
| **HTTP**          | Angular HttpClient   | Functional interceptor for JWT auth                                                             |
| **Routing**       | Angular Router       | Lazy-loaded feature modules via `loadComponent`                                                 |
| **State**         | Angular Signals      | No external state library — all state managed with `signal()`, `computed()`, `effect()`        |
| **Testing**       | Vitest               | Unit tests with jsdom environment                                                               |
| **Formatting**   | Prettier             | Enforced in CI and pre-push hook                                                                |
| **Charts**        | Raw SVG              | No charting library — all visualizations built with inline SVG                                  |
| **PWA**           | Web manifest         | Standalone installable app                                                                      |
| **Package manager** | npm 11             | Lockfile v3                                                                                     |

> The exhaustive list (Kaniko, hadolint, Trivy, Buildx, Keycloak, Loki, Tempo, Pyroscope, PostgreSQL, Kafka, Redis, Ollama, …) — with *what it is*, *how we use it* and *why it's pertinent* for each entry — lives in [docs/reference/technologies.md](docs/reference/technologies.md) (work in progress).
