![Mirador UI](public/banner.svg)

<sub>[English](README.md) · **Français**</sub>

[![pipeline](https://gitlab.com/mirador1/mirador-ui/badges/main/pipeline.svg)](https://gitlab.com/mirador1/mirador-ui/-/pipelines)
[![latest release](https://gitlab.com/mirador1/mirador-ui/-/badges/release.svg)](https://gitlab.com/mirador1/mirador-ui/-/releases)
[![CodeQL](https://github.com/mirador1/mirador-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/mirador1/mirador-ui/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/mirador1/mirador-ui/badge)](https://scorecard.dev/viewer/?uri=github.com/mirador1/mirador-ui)

# Mirador UI — le siège au premier rang

**Mirador** — *watchtower* en espagnol — c'est exactement ce qu'est
ce projet : un point d'observation d'un système réel qui tourne,
qui te permet d'observer en un seul endroit **le code, les métriques
runtime, les pipelines CI/CD, et l'outillage industriel** câblé
autour. L'UI est le siège au premier rang : probes de santé, traces,
logs, rapports qualité, état des pipelines, actions de chaos, et
drill-down opérationnel live sur le backend — adossé à Grafana /
Tempo / Loki / Mimir pour l'observabilité time-series.

Ce repo est aussi une **étude concrète de jusqu'où l'intégration
assistée par IA peut aller**. Chaque ADR, chaque étape de hardening
CI, chaque scanner supply-chain, la baseline K8s, le câblage
observabilité, le glossaire technologies et ce README ont été
rédigés en collaboration étroite avec un LLM — la même technique
garde docs, tests et configuration alignés quand le système grandit.

Ce repo est le **frontend Angular 21**. Le backend Spring Boot 4
vit à [`mirador-service`](https://gitlab.com/mirador1/mirador-service).

## Ce que l'UI expose

L'UI consomme le backend et l'affiche sous plusieurs angles :

- **Dashboard** — probes de santé (liveness / readiness / /actuator/health),
  quality snapshot (tests, coverage, SpotBugs, Sonar), dependency map
  du runtime et contrôle Docker start/stop.
- **Customers** — CRUD complet avec API versioning, idempotency keys,
  import/export CSV/JSON, tabs Bio / Todos / Enrich par customer.
- **Diagnostic** — sept scénarios live (versioning, idempotency,
  rate-limit, Kafka request-reply, timing virtual-threads, diff
  versions, stress).
- **Chaos** — déclencheurs visuels pour démontrer circuit-breaker,
  retry, bulkhead, rate-limit (Resilience4j + Bucket4j).
- **Security** — playground OWASP (auth, CORS, JWT, IDOR, rate-limit,
  headers, audit trail, validation).
- **Request Builder** — client HTTP façon Postman avec 13 presets et
  historique.
- **Database** — 27 requêtes SQL préconfigurées en 5 catégories via
  pgweb (read-only).
- **Settings** — actuator explorer + logger-level live-change.
- **Activity** — timeline session-locale de tous les événements de la
  session browser en cours.
- **Pipelines** — moniteur de pipelines GitLab (20 derniers pipelines,
  switch projet, auto-refresh, drill-down par job).
- **About** — 14 onglets architecture qui pointent vers les docs
  Markdown sur GitLab (phase 2 de l'extraction après ADR-0008).

## Stack clé

- **Angular 21 zoneless** — pas de Zone.js, signals partout, standalone
  components
- **Control flow blocks** — `@if`, `@for`, `@switch` (pas de
  `*ngIf` / `*ngFor`)
- **Raw SVG** pour toutes les visualisations (pas de charting library)
- **OpenTelemetry Web SDK** — auto-instrumentation fetch + XHR, traces
  vers Tempo via OTLP :4319 CORS proxy (ADR-0009 Phase B)
- **TelemetryService** — logger structuré signal-based, intégré à un
  ErrorHandler Angular custom
- **Multi-environment signal** — switch Local / Kind / Prod tunnel en
  une sélection du topbar

## Source canonical vs mirror

> **GitLab est la source de vérité.** Le repo GitHub associé est un
> mirror read-only maintenu par un job CI sur GitLab. Les PRs ouvertes
> sur GitHub ne seront pas revues.

Pour contribuer :
[gitlab.com/mirador1/mirador-ui](https://gitlab.com/mirador1/mirador-ui)

Détails du split master/slave dans
[`docs/ops/ci-philosophy.md`](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/ops/ci-philosophy.md)
(côté mirador-service).

## Documentation

Toute la doc longue vit sous [`docs/`](docs/README.md). Ce README
reste léger — l'UI elle-même est la démo ; la doc explique comment
la lancer et ce que fait chaque page.

Pour les sections techniques (architecture, quick start, référence
`run.sh`, configuration environnement, manuel utilisateur, shortcuts
clavier, theming multi-environnement, etc.), voir la version
anglaise : [README.md](README.md#documentation). Les commandes et
chemins de fichiers sont identiques dans les deux versions.

---

<sub>_Mirador_ — espagnol pour _mirador_ — se tient au premier rang
d'un système qui tourne et répond à : "que montre le code à
l'utilisateur là, tout de suite ?"</sub>
