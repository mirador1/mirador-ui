# UI Prometheus Removal Impact Analysis

**Date**: 2026-04-16  
**Scope**: Removing all UI visualisations fed by Prometheus metrics and delegating to Grafana (per ADR-0006 criterion).  
**Status**: Pre-deletion analysis — no code modified.

---

## 1. Surface affected

Per feature folder consuming Prometheus metrics (79 metric names, 16 categories per `docs/reference/prometheus-metrics-ui.md`):

| Feature | Primary file | Prom-fed LOC | Verdict |
|---------|--------------|-------------|---------|
| **visualizations** | `visualizations.component.ts` | ~2420 | DELETE 4 tabs (golden, jvm, errors, kafka, slowdb); KEEP topology, bundle, waterfall, sankey |
| **dashboard** | `dashboard.component.ts` | ~85 | DELETE live RPS/latency charts; KEEP health/docker/services/quality |
| **observability** | `observability.component.ts` | ~250 | DELETE latency histogram + live-feed tabs; KEEP traces/logs |

**Justification** (ADR-0006 criterion: **delete** if pure-read + no click-to-trigger + equivalent Grafana panel exists):
- **Golden Signals** (78 cards): pure Prometheus read → Grafana dashboard exists.
- **JVM Gauges** (55 cards): pure Prometheus read, textbook Micrometer metrics → standard Grafana JVM dashboard.
- **Kafka Lag**: `kafka_consumer_fetch_manager_records_lag_max` read-only → one-line PromQL in Grafana.
- **Slow Queries**: Spring Data `*_seconds_*` histograms read-only → PromQL histogram_quantile in Grafana.
- **Error Timeline**: tied to chaos triggers (5 probes every 3s when user triggers failures) — **KEEP**. Session-local spike correlation only works in-app.
- **Live RPS/Latency charts** (dashboard): pure read from `/actuator/prometheus` — **DELETE**. Redundant with `sum(rate(http_server_requests_seconds_count[1m]))` in Grafana.
- **Latency Histogram** (observability): pure read from histogram buckets — **DELETE**. Redundant with Grafana histogram_quantile panel.
- **Live Feed (observability)**: polling `/actuator/prometheus` for endpoint activity — **DELETE**. Redundant with Grafana time-series grouped by URI/status.

---

## 2. Core services affected

### MetricsService (`src/app/core/metrics/metrics.service.ts` — 287 LOC)

**Consumers** (via grep `inject(MetricsService)` and `metricsService.`):
- `dashboard.component.ts`: uses `samples()` for RPS chart, `latestMetrics()` for heap/CPU/error-rate cards.
- `visualizations.component.ts`: calls `parsePrometheus()` directly for metric card extraction.

**If all Prometheus-fed features deleted**:
- Dashboard no longer calls `metricsService.start()` (line 191), `toggle()`, or reads `samples()` / `latestMetrics()`.
- Visualizations no longer calls `parsePrometheus()` (line 2849).

**Verdict**: **Delete entirely**. No non-Prometheus code depends on it. No other services import `MetricsService`.

---

## 3. Bundle + budget impact

**Current budget** (`angular.json`):
- Initial JS: `maximumWarning: 560kB`, `maximumError: 1MB`
- Current app size: ~550 kB (gzipped production build).

**Estimated lazy-chunk reduction**:
- `visualizations.component.ts`: 3043 LOC → remove ~2420 Prom-LOC = ~80% reduction in file size (~8–10 kB gzipped).
- `dashboard.component.ts`: 1229 LOC → remove ~85 Prom-LOC = ~7% reduction (~0.5 kB gzipped).
- `observability.component.ts`: 954 LOC → remove ~250 Prom-LOC = ~26% reduction (~2–3 kB gzipped).
- `metrics.service.ts`: 287 LOC deleted entirely (~2 kB gzipped).

**Expected total reduction**: ~13–18 kB gzipped (2.5–3% of initial bundle).  
**Impact on budget**: Stays well under 560 kB warning threshold. No action needed.

---

## 4. Routes + nav

### Routes (`src/app/app.routes.ts`)
**No routes deleted** — all three features remain routable:
- `{ path: '/', loadComponent: () => DashboardComponent }`
- `{ path: '/visualizations', loadComponent: () => VisualizationsComponent }`
- `{ path: '/observability', loadComponent: () => ObservabilityComponent }`

### Nav entries (`src/app/shared/layout/app-shell.component.ts`)
**Metric page nav** (lines 149–171):
```
{
  id: 'metrics',
  label: 'Metrics',
  path: '/visualizations',
  tip: '78 configurable Prometheus metric cards...',
  children: [
    { label: 'Golden Signals (78)', ... },
    { label: 'JVM Gauges (55)', ... },
    { label: 'Error Timeline', ... },
    { label: 'Kafka Lag', ... },
    { label: 'Slow Queries', ... },
    { label: 'Bundle', ... },
  ],
}
```

**Change**: Update nav text to drop "(78)", "(55)" counts and note "View in Grafana" link. Remove Golden Signals / JVM Gauges / Slow Queries from children; add "Grafana Dashboards" link.

**Observability nav** (lines 122–147): Update "Latency Histogram" and "Live Feeds" to note "Replaced by Grafana Explore" or remove entirely.

### Grafana URL prerequisite
**Note**: `EnvService` (lines 1–110) has no `grafanaUrl` property. To make nav links work, add:
```typescript
export interface Environment {
  grafanaUrl?: string;  // e.g., 'http://localhost:3001'
}
```
This is **out of scope** for this analysis but **required** before rollout.

---

## 5. Tests affected

**Spec files in the app** (find `/src/app/**/*.spec.ts`):
- `app.spec.ts`, `auth.service.spec.ts`, `toast.service.spec.ts`, `env.service.spec.ts`, `theme.service.spec.ts`, `api.service.spec.ts`, `info-tip.component.spec.ts`

**None** of these import or test `visualizations`, `dashboard`, `observability`, or `MetricsService`.

**Count affected spec files**: **0** (no component test suites exist for these features).

---

## 6. UX / user-journey implications

### Before (with in-app Prometheus visualizations)
1. **Operator:** Open `/visualizations` → see 78 metric cards rendered live every 3s → click a card to see tooltip + trend.
   - **After:** Same page loads but Golden Signals / JVM tabs are gone. User must open Grafana in new tab.
   
2. **SRE investigating error spike:** Open `/observability` → "Live Feeds" tab shows real-time endpoint activity polled from Prometheus.
   - **After:** Tab is gone. User goes to Grafana Explore, enters `sum by (uri, status) (rate(http_server_requests_seconds_count[1m]))`, sees same data with +1 click.

3. **On-call ops:** Land on `/` (dashboard) → see live RPS bar chart updating every 3s + latency p50/p95/p99 polylines.
   - **After:** Charts are gone. User still sees health probes, Docker service controls, architecture graph. If they want throughput history, they go to Grafana dashboard.

4. **Chaos-testing engineer:** Trigger `/chaos/rate-limit-exhaustion` → open `/visualizations` "Error Timeline" → see real-time spike in error bar chart (correlated with probe frequency).
   - **After:** Error Timeline tab **stays**. Chaos workflow unchanged.

5. **Developer:** Profiling slow endpoint → `/database` SQL explorer finds offending query → no Prometheus dependence.
   - **After:** Unchanged.

### Degraded journeys (3 concrete breaks)
1. **One-click drill-down from metric to trace**: Previously, click a metric card → none exist in app now. Before it was a way to see "this JVM heap gauge spike correlates with span latency spikes in Tempo."
   - **Workaround**: Open Grafana + Tempo side-by-side manually.

2. **Session-local metric correlation** (in-app memory): "I triggered chaos at 14:32, and here's the live chart showing the spike." Memory is erased on page reload or app close.
   - **Workaround**: Grafana has 24h retention; historical correlation is better there.

3. **No Prometheus latency distribution** on landing page: Previously, dashboard showed a quick snapshot (p50/p95/p99 histograms). Now ops must navigate to Grafana to see latency percentiles.
   - **Workaround**: Link Grafana dashboard from the dashboard page header.

### What still works
- Health probes (UP/DOWN/UNREACHABLE) — not Prometheus-fed, pulls `/actuator/health`.
- Docker service control (start/stop containers) — not Prometheus-fed, calls Docker API.
- Chaos triggers (rate-limit, circuit-breaker, invalid payload) — not Prometheus-fed, fires backend requests.
- Diagnostic runs (API versioning, idempotency, stress test) — not Prometheus-fed.
- Activity timeline (session events) — session-scoped, not Prometheus-fed.
- Request-builder (Postman-like HTTP client) — not Prometheus-fed.
- Customer CRUD (create/edit/delete/search/import/export) — API-backed, not Prometheus-fed.

---

## 7. Recommended deletion order

**Low risk → High risk**:

1. **Delete visualizations Golden Signals + JVM Gauges tabs** (~1200 LOC + HTML).
   - Rationale: 78+55=133 pure-read cards with zero UI interactions. Simplest extraction.
   - Dependencies: Only `visualizations.component.ts` affected; no cascade.
   - Verification: Page still loads; Topology/Bundle/Waterfall/Sankey tabs remain.

2. **Delete visualizations Slow Queries tab** (~46 LOC).
   - Rationale: One PromQL filter on histogram; no UI state.
   - Dependencies: Confined to `visualizations.component.ts`.

3. **Delete visualizations Kafka Lag tab** (~90 LOC).
   - Rationale: Single metric `kafka_consumer_fetch_manager_records_lag_max`; minimal state.
   - Dependencies: Confined to `visualizations.component.ts`.

4. **Delete visualizations Error Timeline tab** (~89 LOC) **— BLOCKED**.
   - Rationale: Tied to chaos workflows; session-local correlation.
   - Postpone: Keep for now per ADR-0006 clause 2 (session-scoped + interactive feedback loop).

5. **Delete dashboard RPS/Latency charts** (~85 LOC).
   - Rationale: Pure Prometheus reads; replaceable by two Grafana panels.
   - Dependencies: `dashboard.component.ts` + template. Leaves health/docker/topology untouched.
   - Verification: Dashboard still renders; MetricsService stops being auto-started.

6. **Delete observability Latency Histogram tab** (~100 LOC).
   - Rationale: Single histogram_quantile PromQL; no state.
   - Dependencies: Confined to `observability.component.ts`.
   - Risk: Removes one of four tabs; UI looks lighter but still functional.

7. **Delete observability Live Feeds tab** (~150 LOC).
   - Rationale: Pure Prometheus polling; equivalent exists in Grafana Explore.
   - Dependencies: Confined to `observability.component.ts`.

8. **Delete `MetricsService`** (287 LOC + imports).
   - Rationale: Becomes unreachable after steps 1–7.
   - Dependencies: Update imports in `dashboard.component.ts` + `visualizations.component.ts`.
   - Verification: No other service imports it; app compiles cleanly.

9. **Update nav + route text** (2–3 LOC changes).
   - Rationale: Remove "(78)", "(55)" counts; update tips.
   - **Prerequisite**: Add `grafanaUrl` to `EnvService` and link from nav/pages.

---

## 8. Known unknowns / verification checklist

- [ ] **Per-customer Bio/Todos/Enrich tabs**: Do they use Prometheus metrics?
  - **Status**: Checked `customers.component.ts` — uses API calls only (Ollama LLM, JSONPlaceholder, Kafka request-reply). No Prometheus.
  
- [ ] **Health-probe sparkline on dashboard**: Is it Prometheus-fed or `/actuator/health`?
  - **Status**: Checked `dashboard.component.ts` lines 117–120 — uses `/actuator/health` polling, not Prometheus. Safe to keep.

- [ ] **What happens if Grafana is unavailable?**
  - **Gap**: No fallback link in nav. If `grafanaUrl` is not configured, nav link is null. Flag this as a prerequisite.
  
- [ ] **Running without Grafana** (e.g., `./run.sh app` without `./run.sh obs`)?
  - **Impact**: User can no longer view metric dashboards anywhere in the app. Traces/Logs tabs also fail (Tempo/Loki unreachable). This is acceptable per ADR-0006 ("remove the implicit expectation that the UI must mirror every dashboard").
  
- [ ] **Metric card extraction logic in visualizations** — used anywhere else?
  - **Status**: Only `visualizations.component.ts` calls `metricsService.parsePrometheus()` (line 2849). Safe to delete.

- [ ] **Bundle analytics** (treemap of lazy chunks) — does it use Prometheus?
  - **Status**: Loads `/analyze/bundle.json` from build artifacts, not Prometheus. **KEEP**.

---

## Summary of deletions

| Category | LOC | Verdict |
|----------|-----|---------|
| **Visualizations (4 tabs)** | ~1420 | DELETE |
| **Dashboard (2 charts)** | ~85 | DELETE |
| **Observability (2 tabs)** | ~250 | DELETE |
| **MetricsService** | ~287 | DELETE |
| **HTML templates** | ~550 | DELETE |
| **Total Prometheus-fed code** | **~2592 LOC** | **DELETE** |

**Features deleted entirely**: 0  
**Features partially deleted**: 3 (visualizations, dashboard, observability)  
**Features kept intact**: 14 (all others: about, activity, audit, chaos, customers, database, diagnostic, login, maven-site, quality, request-builder, security, settings, timeline)

### Difficult-to-classify code
- **Error Timeline tab** (visualizations): Mixes pure-read Prometheus polling with session-local state and chaos-action correlation. Technically deletable per ADR-0006, but user experience degrades (no in-app spike correlation). **Recommendation**: Keep for now; revisit if chaos feature moves to diagnostic page.
- **MetricsService lifecycle** in dashboard `ngOnInit()`: Currently auto-starts polling even if user never clicks live chart. After deletion, remove `this.metricsService.start()` call entirely (no side effects).

---

[← Back to architecture index](README.md)
