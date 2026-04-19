![Mirador UI](public/banner.svg)

<!-- Build / release status — GitLab canonical, GitHub mirror for visibility. -->
[![pipeline](https://gitlab.com/mirador1/mirador-ui/badges/main/pipeline.svg)](https://gitlab.com/mirador1/mirador-ui/-/pipelines)
[![latest release](https://gitlab.com/mirador1/mirador-ui/-/badges/release.svg)](https://gitlab.com/mirador1/mirador-ui/-/releases)
[![CodeQL](https://github.com/Beennnn/mirador-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/Beennnn/mirador-ui/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Beennnn/mirador-ui/badge)](https://scorecard.dev/viewer/?uri=github.com/Beennnn/mirador-ui)

<!-- Tech badges grouped by concern. Mirrors docs/reference/technologies.md
     and the banner SVG. Any bump here should also update both. -->

**Frontend**
![Angular 21](https://img.shields.io/badge/Angular-21_zoneless-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Signals](https://img.shields.io/badge/Signals-no_Zone.js-e2e8f0)
![Raw SVG](https://img.shields.io/badge/Raw_SVG-no_chart_lib-FFB13B)
![SCSS](https://img.shields.io/badge/SCSS-custom_properties-CC6699?logo=sass&logoColor=white)

**Observability (browser-side)**
![OpenTelemetry Web](https://img.shields.io/badge/OpenTelemetry-Web_SDK-7F52FF?logo=opentelemetry&logoColor=white)
![OTLP HTTP](https://img.shields.io/badge/OTLP_HTTP-:4319_CORS_proxy-7F52FF)
![Grafana Tempo](https://img.shields.io/badge/Grafana_Tempo-browser_traces-F46800?logo=grafana&logoColor=white)

**Backend (consumed)**
![Spring Boot 4](https://img.shields.io/badge/Spring_Boot-4-6DB33F?logo=springio&logoColor=white)
![Java 25](https://img.shields.io/badge/Java-25-ED8B00?logo=openjdk&logoColor=white)
![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-KRaft-231F20?logo=apachekafka&logoColor=white)
![Redis 7](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Auth0 + Keycloak](https://img.shields.io/badge/Auth0_+_Keycloak-OIDC-EB5424?logo=auth0&logoColor=white)
![Unleash](https://img.shields.io/badge/Unleash-feature_flags-000000)

**Quality**
![Vitest](https://img.shields.io/badge/Vitest-unit_zoneless-6E9F18?logo=vitest&logoColor=white)
![SonarCloud](https://img.shields.io/badge/SonarCloud-static_analysis-F3702A?logo=sonarcloud&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-NG8113_zero-4B32C3?logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-formatted-F7B93E?logo=prettier&logoColor=white)

**CI / release**
![GitLab CI](https://img.shields.io/badge/GitLab_CI-local_runner-FC6D26?logo=gitlab&logoColor=white)
![lefthook](https://img.shields.io/badge/lefthook-pre--push_gates-000000)
![commitlint](https://img.shields.io/badge/Conventional_Commits-enforced-FE5196)
![Renovate](https://img.shields.io/badge/Renovate-bump_bot-1A1F6C?logo=renovatebot&logoColor=white)
![release-please](https://img.shields.io/badge/release--please-CHANGELOG_+_semver-4285F4)
![gitleaks](https://img.shields.io/badge/gitleaks-secret_scan-FD7014)

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
> collaboration with an LLM — the same technique keeps the docs, tests,
> and configuration in lockstep as the system grows.
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
| [`run.sh` reference](docs/getting-started/run-sh.md)                             | Every subcommand of the launcher                                           |
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

- Backend: **[`mirador-service`](https://gitlab.com/mirador1/mirador-service)** — Spring Boot 4 / Java 25, lives as a sibling directory so `run.sh` can delegate infra commands.

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
