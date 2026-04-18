# Architecture Decision Records (ADRs)

Lightweight (Michael Nygard format) record of architectural decisions.

## Why

Non-obvious decisions must be justified and dated. "Why zoneless? Why raw
SVG and no charting library? Why Vitest over Jest?" becomes a Git-tracked
answer instead of tribal knowledge.

See [`0001-record-architecture-decisions.md`](0001-record-architecture-decisions.md)
for the meta-ADR explaining the format and criteria.

## Index

| ID    | Status   | Title                                                             |
| ----- | -------- | ----------------------------------------------------------------- |
| 0001  | Accepted | [Record architecture decisions](0001-record-architecture-decisions.md) |
| 0002  | Accepted | [Zoneless change detection + Signals](0002-zoneless-and-signals.md)    |
| 0003  | Accepted | [Raw SVG for all visualizations, no charting library](0003-raw-svg-charts.md) |
| 0004  | Accepted | [Vitest over Jest for unit tests](0004-vitest-over-jest.md)            |
| 0005  | Accepted | [Standalone components, no NgModules](0005-standalone-components.md)   |
| 0006  | Accepted | [Keep UI dashboards alongside Grafana (for now)](0006-grafana-duplication.md) |
| 0007  | Accepted | [Retire Prometheus-fed UI visualisations in favour of Grafana](0007-retire-prometheus-ui-visualisations.md) |

## Template

Copy [`0000-template.md`](0000-template.md) for new ADRs.
