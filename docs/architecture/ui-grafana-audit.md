# UI → Grafana migration audit

Applies the criterion recorded in [ADR-0006](../adr/0006-grafana-duplication.md)
to every feature in `src/app/features/`. Features are classified as:
stays in UI, migrate to Grafana-as-Code, or partial.

## Summary

| Verdict              | Count | Features (short) |
| -------------------- | ----- | ---------------- |
| Stays in UI          | 14    | about, activity, audit, chaos, customers, database, diagnostic, login, maven-site, quality, request-builder, security, settings, timeline |
| Migrate to Grafana   | 0     | — |
| Partial              | 3     | dashboard, observability, visualizations |

No feature is 100% migratable: the three observability-heavy features all mix
pure Prometheus reads with interactive or drill-down behaviour that fails the
ADR's "no click-to-trigger" clause.

## Per-feature verdict

### `about/`
**Verdict**: stays. **Why**: static, multi-tab architecture documentation with
no HTTP calls — see the explicit note in `src/app/features/about/about.component.ts:21`.
Not an observability view.

### `activity/`
**Verdict**: stays. **Why**: renders `ActivityService`'s in-session event log
(`src/app/features/activity/activity.component.ts:29`). Scoped to the current
browser session, lost on reload — ADR clause 2.

### `audit/`
**Verdict**: stays. **Why**: paginated view of backend audit events with
filter/refresh UI (`src/app/features/audit/audit.component.ts:1-8`). Data is
relational (JDBC rows), not Prometheus/Loki/Tempo. No PromQL equivalent.

### `chaos/`
**Verdict**: stays. **Why**: the page's reason for existence is triggering
failures — rate-limit exhaustion, circuit-breaker trip, invalid-payload flood
(`src/app/features/chaos/chaos.component.ts:1-17`). ADR clause 1 (interactive,
mutates backend state).

### `customers/`
**Verdict**: stays. **Why**: full CRUD surface — create/edit/delete, bulk
actions, import/export (`src/app/features/customers/customers.component.ts:1-14`).
ADR clause 1.

### `dashboard/`
**Verdict**: **partial**. **Why**: the landing page mixes interactive controls
(Docker start/stop, observability deep-links) with pure Prometheus reads.
- **Migrate**: live-throughput RPS chart (delegates to `MetricsService`, fed by
  `/actuator/prometheus`, `src/app/features/dashboard/dashboard.component.ts:1127-1130`,
  matches `sum(rate(http_server_requests_seconds_count[1m]))`); 24h request
  heatmap (Prometheus-sourced, same metric grouped by hour).
- **Stays**: health-probe cards (`/actuator/health` — not Prometheus), Docker
  service control panel (mutates container state), dependency-graph topology,
  observability links. ADR clause 3 (landing surface for ops-on-call).

### `database/`
**Verdict**: stays. **Why**: SQL explorer proxying pgweb, plus VACUUM/maintenance
triggers (`src/app/features/database/database.component.ts:1-9, 36-40`). ADR
clause 1.

### `diagnostic/`
**Verdict**: stays. **Why**: seven interactive test scenarios (API versioning,
idempotency, rate-limit bursts, Kafka enrich, stress test) that fire requests
and inspect responses (`src/app/features/diagnostic/diagnostic.component.ts:1-17`).
ADR clause 1.

### `login/`
**Verdict**: stays. **Why**: authentication entry point — Auth0 redirect or
local JWT form (`src/app/features/login/login.component.ts:1-9`). Session-scoped
(ADR clause 2), not an observability surface.

### `maven-site/`
**Verdict**: stays. **Why**: full-viewport iframe of the Maven-generated
quality site (`src/app/features/maven-site/maven-site-full.component.ts:7-23`).
Static HTML artifact, not a metric read.

### `observability/`
**Verdict**: **partial**. **Why**: four tabs with different profiles
(`src/app/features/observability/observability.component.ts:1-16`).
- **Migrate**: Latency tab (parses Prometheus histogram buckets — direct
  PromQL equivalent: `histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))`).
  Live Feed tab (HTTP status rates from `http_server_requests_seconds_count`
  — trivial PromQL panel).
- **Stays**: Traces tab (TraceQL search + click-to-drill into span waterfall;
  Grafana already covers search but the in-app waterfall is load-bearing for
  the ADR Alt-B "drill-down from failed request to trace" case). Logs tab
  (ad-hoc LogQL search with 5s live polling — Grafana Explore covers this,
  but the UI's tight coupling with the request-builder flow keeps it
  session-useful).

### `quality/`
**Verdict**: stays. **Why**: Maven quality report sourced from
`/actuator/quality` — Surefire, JaCoCo, SpotBugs
(`src/app/features/quality/quality.component.ts:1-9`). Build-time artifact,
not a Prometheus time series. No PromQL equivalent.

### `request-builder/`
**Verdict**: stays. **Why**: Postman-like HTTP client built into the app
(`src/app/features/request-builder/request-builder.component.ts:1-11`). Fires
arbitrary requests — ADR clause 1.

### `security/`
**Verdict**: stays. **Why**: interactive OWASP vulnerability demos — SQLi, XSS,
IDOR, JWT inspection, live header checks
(`src/app/features/security/security.component.ts:1-13`). ADR clause 1 (each
tab drives a backend call) and clause 2 (JWT decode is session-scoped).

### `settings/`
**Verdict**: stays. **Why**: actuator explorer plus live logger-level mutation
via POST (`src/app/features/settings/settings.component.ts:1-9`). ADR clause 1.

### `timeline/`
**Verdict**: stays. **Why**: SSE feed of new customer events plus a 2s-polled
Prometheus tail (`src/app/features/timeline/timeline.component.ts:1-11`). The
SSE half is session-scoped (ADR clause 2); the Prometheus half is already
duplicated by `observability/` Live Feed and not worth a standalone Grafana
panel.

### `visualizations/`
**Verdict**: **partial**. **Why**: 78 Prometheus cards across six tabs
(`src/app/features/visualizations/visualizations.component.ts:206-243`).
- **Migrate**: Golden Signals tab (the 4 SRE signals are canonical Grafana
  panels); JVM Gauges tab (heap/CPU/threads/GC — all standard JVM Micrometer
  dashboard, PromQL over `jvm_memory_used_bytes`, `process_cpu_usage`,
  `jvm_threads_*`, `jvm_gc_*`, lines 326-694); Kafka Lag tab
  (`kafka_consumer_fetch_manager_records_lag_max`); Slow Queries tab (Spring
  Data repository invocation histograms).
- **Stays**: Error Timeline tab (tied to the chaos-action workflow — 5 probe
  requests every 3s, only meaningful while the user is triggering failures);
  Bundle tab (Angular bundle-size treemap, a build artifact, not a backend
  metric); Topology graph (dependency diagram, not a time series).

## Recommended Grafana migration plan

Ordered by "purest Prometheus read first, cheapest to move":

1. **`visualizations/` → JVM Gauges tab.** All 30+ panels are textbook JVM
   Micrometer PromQL (`jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes`,
   `process_cpu_usage`, `jvm_threads_live_threads`, `jvm_gc_pause_seconds_*`).
   Panel definitions are already structured in code (one object per metric)
   — script them into a Grafana dashboard JSON.
2. **`visualizations/` → Golden Signals tab.** Latency/Traffic/Errors/Saturation
   are canonical dashboards in the Grafana marketplace; port with minor tweaks.
3. **`observability/` → Latency tab.** Single panel:
   `histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket[5m])))`.
4. **`visualizations/` → Kafka Lag tab.** One-line PromQL:
   `kafka_consumer_fetch_manager_records_lag_max`.
5. **`visualizations/` → Slow Queries tab.** PromQL over
   `spring_data_repository_invocations_seconds_*` histograms.
6. **`dashboard/` → live RPS chart + 24h heatmap.**
   `sum(rate(http_server_requests_seconds_count[1m]))` plus an hour-bucketed
   Grafana heatmap panel.
7. **`observability/` → Live Feed tab.** Time-series panel grouped by URI/status,
   `sum by (uri, status) (rate(http_server_requests_seconds_count[1m]))`.

Once all seven are live in Grafana (as code, versioned under the backend
repo's `grafana/` folder), delete the corresponding in-app panels and add a
"View in Grafana" link to the feature header. Keep everything else in the UI
— the interactive half is why the dashboard exists.

---
[← Back to architecture index](README.md)
