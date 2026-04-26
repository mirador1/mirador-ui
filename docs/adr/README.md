# Architecture Decision Records (ADRs) — `mirador-ui`

Lightweight (Michael Nygard format) record of architectural decisions.

## Why

Non-obvious decisions must be justified and dated. "Why zoneless? Why raw
SVG and no charting library? Why Vitest over Jest?" becomes a Git-tracked
answer instead of tribal knowledge.

See [`0001-record-architecture-decisions.md`](0001-record-architecture-decisions.md)
for the meta-ADR explaining the format and criteria.

## Cross-cutting ADRs

UI-local ADRs live below. **Cross-repo ADRs** (decisions that bind ALL
4 mirador1 repos including UI : submodule pattern, polyrepo vs monorepo,
release engineering, Renovate base, tag namespace) live in
[`mirador-common/docs/adr/`](https://gitlab.com/mirador1/mirador-common/-/tree/main/docs/adr).

## Index

The table below is **auto-regenerated** by
[`infra/common/bin/dev/regen-adr-index.sh`](../../infra/common/bin/dev/regen-adr-index.sh).
Do not edit between the markers — run the script after adding /
modifying an ADR.

<!-- ADR-INDEX:START -->
| ID | Status | Title |
|---|---|---|
| 0001 | Accepted | [Record architecture decisions](0001-record-architecture-decisions.md) |
| 0002 | Accepted | [Zoneless change detection + Signals](0002-zoneless-and-signals.md) |
| 0003 | Accepted | [Raw SVG for all visualizations, no charting library](0003-raw-svg-charts.md) |
| 0004 | Accepted | [Vitest over Jest for unit tests](0004-vitest-over-jest.md) |
| 0005 | Accepted | [Standalone components, no NgModules](0005-standalone-components.md) |
| 0006 | Accepted | [Keep UI dashboards alongside Grafana (for now)](0006-grafana-duplication.md) |
| 0007 | Accepted | [Retire Prometheus-fed UI visualisations in favour of Grafana](0007-retire-prometheus-ui-visualisations.md) |
| 0008 | Accepted | [Retire the Observability UI page in favour of Grafana](0008-retire-observability-ui-in-favour-of-grafana.md) |
| 0009 | Accepted | [Browser telemetry via OpenTelemetry → OTLP → Tempo](0009-browser-telemetry-via-otlp.md) |
| 0010 | Accepted | [UI must work on mobile — responsive-first as a hard rule](0010-mobile-responsive-hard-rule.md) |
| 0011 | Accepted | [sonarcloud — JS bridge flakiness handled via `when: manual`, not `allow_failure: true`](0011-sonarcloud-js-bridge-flaky.md) |
<!-- ADR-INDEX:END -->

## Template

Copy [`0000-template.md`](0000-template.md) for new ADRs. After adding
an ADR, run `infra/common/bin/dev/regen-adr-index.sh --in-place` to
refresh the table above.
