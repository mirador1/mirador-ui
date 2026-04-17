# ADR-0007: Retire Prometheus-fed UI visualisations in favour of Grafana

- **Status**: Accepted
- **Date**: 2026-04-17
- **Supersedes**: —
- **Refines**: [ADR-0006](0006-grafana-duplication.md)

## Context

An inventory (`docs/reference/prometheus-metrics-ui.md`) identified **79
distinct Prometheus metric names** rendered in three feature pages
(`dashboard/`, `visualizations/`, `observability/`). All 79 are also
available in the LGTM-bundled Grafana at `http://localhost:3001` and in
production Grafana Cloud, through the identical OTLP export pipeline.

[ADR-0006](0006-grafana-duplication.md) gave the general criterion for
keeping a UI view versus migrating it to Grafana — this ADR applies that
criterion at metric-category granularity, records the verdict for each
category, and commits the repository to the deletions.

## Decision

Retire every UI card, gauge, chart, or panel whose **sole input is a
Prometheus query with no session-local state and no click-to-trigger
action**. Keep Grafana as the single source of truth for time-series
observability. Provide a single `grafanaUrl` in `EnvService` so the
surviving pages can deep-link into the right Grafana dashboard.

### Per-category verdict

The inventory's 16 categories, grouped by decision:

| Category | Count | Verdict | Why |
| --- | ---: | --- | --- |
| `jvm_*` | 22 | **Remove** | Pure-read heap / GC / thread / buffer / compilation gauges — standard Grafana JVM dashboard covers every entry one-to-one. No click-to-trigger, no session state. |
| `hikaricp_*` | 7 | **Remove** | Connection-pool state (active/idle/pending/timeouts). Grafana panel `HikariCP connection pool` already exists with the same queries. |
| `jdbc_*` | 6 | **Remove** | Spring Data repository query counters + histograms. Pure observability read; Grafana `histogram_quantile` covers p50/p95/p99 view. |
| `process_*` | 3 | **Remove** | `process_cpu_usage`, `process_uptime_seconds`, `process_files_open_files`. Textbook Micrometer gauges; Grafana renders them from the same scrape. |
| `system_*` | 3 | **Remove** | `system_cpu_count`, `system_cpu_usage`, `system_load_average_1m`. Host-level metrics — Grafana dashboard. |
| `http_*` | 4 | **Remove** | HTTP throughput, latency histograms, active request count, error rate. Grafana panel `HTTP RED` covers this with `rate()` + `histogram_quantile`. |
| `tomcat_*` | 3 | **Remove** | Session count / max active sessions / rejected. Rarely examined; Grafana when needed. |
| `logback_*` | 1 | **Remove** | `logback_events_total` by level. Better consumed as a Grafana bar chart or as log queries in Loki. |
| `executor_*` | 5 | **Remove** | Spring task executor pool depth. Pure read; Grafana line chart. |
| `lettuce_*` | 3 | **Remove** | Redis command counters / latency. Grafana Redis dashboard covers it. |
| `disk_*` | 2 | **Remove** | Disk free / total. Node-exporter dashboard. |
| `application_*` | 1 | **Remove** | `application_started_time_seconds`. One-off; Grafana single stat. |
| `tasks_*` | 2 | **Remove** | Scheduled task execution timing. Small signal; Grafana. |
| `customer_*` | 7 | **Remove** | Custom business counters (create/list/enrich/aggregate). Pure increments — Grafana graph with the same names. |
| `spring_*` | 4 | **Remove** | Kafka templates, security filter counters. Grafana. |
| `kafka_*` | 3 | **Remove** | Consumer lag, custom event counters, enrich cycles. Grafana consumer-lag panel is the canonical view. |

### What stays in the UI

The following UI surfaces continue to be owned by this codebase because they
fail at least one clause of ADR-0006's criterion:

| UI surface | Reason it stays |
| --- | --- |
| **Health probes** on dashboard (`/actuator/health` strip) | Not a Prometheus metric — pulls the actuator endpoint directly. Used for UP/DOWN toasts and fast triage before an operator opens Grafana. |
| **Docker service control** on dashboard | Click-to-trigger (start/stop containers via Docker Engine API). Grafana panels are read-only. |
| **Code quality summary** on dashboard | Sourced from `/actuator/quality`, not Prometheus. Static per build. |
| **Error Timeline** tab in `visualizations/` | Session-local: meaningful only while the operator is watching a chaos action land. Stored in memory, erased on reload — Grafana's 24h retention is a different product. |
| **Bundle treemap** in `visualizations/` | Reads `/analyze/bundle.json` from the build artefact, not Prometheus. |
| **Traces** tab in `observability/` | Tempo drill-down with in-session trace inspection (click span → filter). Grafana Explore covers the query but not the component's specific drill-down flows. |
| **Logs** tab in `observability/` | Same — in-session LogQL composition tied to the UI's request-builder flow. |
| **Customer count card** on dashboard | Backed by the REST API, not Prometheus. |
| **Every other feature** | `chaos/`, `customers/`, `diagnostic/`, `request-builder/`, `security/`, `activity/`, `timeline/`, `audit/`, `database/`, `login/`, `settings/`, `about/`, `quality/`, `maven-site/`, `pipelines/` — none of these display a Prometheus metric. Untouched. |

### Implementation

Execution order (one commit per step, each runs a clean production build):

1. `feat(env)`: add `grafanaUrl` to `EnvService` so retired pages can link
   to Grafana. Done in commit `1fb787e`.
2. `refactor(visualizations)`: drop Golden Signals (78 cards), JVM Gauges
   (55 cards), Kafka Lag, Slow Queries tabs. Keep Error Timeline + Bundle.
   Commit `8d1957c` (chunk 84 kB → 19 kB).
3. `refactor(dashboard)`: drop live RPS / latency charts and JVM-system
   card grid. Keep customer-count card, health probes, Docker control,
   quality summary. Commit `dbeb207` (chunk 77 kB → 67 kB).
4. `refactor(observability)`: drop Latency Histogram + Live Feeds tabs.
   Keep Traces + Logs.
5. `refactor(core)`: delete `MetricsService` once no consumer remains.
6. `chore(nav)`: trim the `metrics` / `observability` / `dashboard` nav
   children to the surviving set; add "Grafana →" entries.

## Consequences

### Positive

- **Single source of truth for time-series metrics.** Grafana + its
  retention policy handle historical analysis; the UI handles
  interactions and session-local views.
- **~13–18 kB gzipped bundle reduction** (~2.5 % of the initial JS),
  plus ~2 590 LOC fewer to maintain (`MetricsService` + tab code in the
  three feature pages).
- **Fewer silent degradations.** Polling `/actuator/prometheus` is a hot
  path: a single slow scrape response today blocks three UI pages at
  once. After migration, Grafana absorbs that load instead.
- **ADR-0006's criterion is now executed**, not just documented.

### Negative

- **No one-click metric-to-trace drill-down inside the app.** The
  derived-field `trace_id` → Tempo path in Grafana still works, but
  users must open Grafana first.
- **Running without Grafana** (e.g. `./run.sh app` alone) loses metric
  views entirely. Mitigation: the `./run.sh obs` command already brings
  up the LGTM stack, and this is documented in the retired pages'
  new "Open Grafana →" banners.
- **Grafana-as-Code is now a prerequisite.** The dashboards we rely on
  must live in `deploy/grafana/` (separate work item in `TASKS.md`) so
  the experience is reproducible in a fresh clone.

### Neutral

- `EnvService.grafanaUrl` gains a new field. Non-Local environments must
  now include it.
- The `/visualizations`, `/`, and `/observability` routes remain, just
  with slimmer content. No routing tests were affected.

## Alternatives considered

### Alternative A — keep everything, accept the duplication

Rejected: the duplication tax compounds with every metric added to the
backend. Today it's 79 metrics across three pages; left alone it would
keep growing proportionally.

### Alternative B — move the UI panels into Grafana iframes

Rejected: iframes compose poorly with our CSP, force a second auth flow
(Grafana login vs. Auth0), and still leave the in-app duplication
problem because a metric-card UI would live around the iframe. Evaluated
once more in [ADR-0006 §Alternative A](0006-grafana-duplication.md#alternatives-considered).

### Alternative C — delete all three pages entirely

Rejected: each page also hosts non-Prometheus content (health probes,
Docker control, session-local traces/logs, Error Timeline) that has no
Grafana equivalent.

## References

- [ADR-0006 — Keep UI dashboards alongside Grafana (for now)](0006-grafana-duplication.md)
- `docs/reference/prometheus-metrics-ui.md` — the 79-metric inventory
- `docs/architecture/ui-prom-removal-impact.md` — per-file LOC impact analysis
- `docs/architecture/ui-grafana-audit.md` — the preceding feature-level audit
- Commits: `1fb787e`, `8d1957c`, `dbeb207` (and the remaining refactor
  commits listed in Section "Implementation").
