# ADR-0006: Keep UI dashboards alongside Grafana (for now)

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

The backend (`mirador-service`) ships a full LGTM stack (Loki, Grafana,
Tempo, Mimir) via `docker-compose.observability.yml`, plus the production
deployment emits OTLP to Grafana Cloud. Grafana is therefore the
authoritative home for dashboards, alerts, and long-term metric storage.

In parallel, this UI exposes three features that visualise the **same
backend metrics** Grafana already covers:

- `src/app/features/observability/` — RED/USE panels, percentile charts.
- `src/app/features/visualizations/` — HTTP status rates, latency heatmaps.
- `src/app/features/dashboard/` — top-level summary cards.

This is deliberate duplication. The question this ADR records: *under what
criterion should a UI view stay in-app vs migrate to Grafana?*

## Decision

Keep a UI view in-app if **any** of these is true:

1. **It is interactive in a way Grafana cannot express.** Chaos triggers,
   diagnostic runs, request builder, customer CRUD, activity timeline —
   these mutate backend state. Grafana panels are read-only.
2. **It renders data that is scoped to the current user session.** The
   in-session activity log, local profiling, and auth debug views have no
   equivalent in a server-side dashboard.
3. **It is the landing surface for a non-ops user.** A customer-facing or
   ops-on-call user opening the UI expects a summary without being sent
   to a second tool.

Migrate a view to Grafana-as-code if **all** of these are true:

1. It is purely a read of Prometheus/Loki/Tempo data.
2. It does not drive any UI-side action (no click-to-trigger).
3. The equivalent Grafana panel exists or can be expressed in PromQL/LogQL
   without custom rendering.

Pure observability reads that match the migration criterion:

- Most of `observability/` (latency histograms, error rate panels).
- The metric-only half of `visualizations/` (HTTP status rates).
- The top-of-`dashboard/` summary cards sourced from Prometheus.

Features that **stay in-app** under the criterion:

- Chaos triggers, diagnostics runs, request-builder, customer management,
  in-session activity timeline, auth debug, keyboard-shortcut help.

## Consequences

### Positive

- One stable criterion instead of ad-hoc "should this be in Grafana?"
  debates per view.
- Removes the implicit expectation that the UI must mirror every
  dashboard — frees us to delete duplicate panels when we start the
  Grafana-as-Code track (see `TASKS.md`).
- Grafana becomes the single source of truth for historical metrics;
  the UI keeps only the live/interactive surface.

### Negative

- Split surface area: some observability lives in the UI, some in
  Grafana. Users need to know which. Mitigated by linking out to the
  relevant Grafana dashboard from each remaining in-app panel.
- A migration effort is now committed — it is not "we might clean this
  up someday".

### Neutral

- The SVG rendering work done for `observability/` and `visualizations/`
  is not wasted: it proved the zero-library visualisation approach
  (see [ADR-0003](0003-raw-svg-charts.md)) and stays load-bearing for
  the interactive views.

## Alternatives considered

### Alternative A — Embed Grafana panels in the UI via iframe

Rejected for now: couples the UI's auth flow to Grafana's session, and
iframes break our single-origin CSP. Revisit if/when Grafana Cloud ships
a first-class embedding SDK for our auth setup.

### Alternative B — Delete all in-app observability views immediately

Rejected: the interactive half of `observability/` / `visualizations/`
(drill-down from a failed request to its trace) has no Grafana
equivalent today.

### Alternative C — Keep everything in both places indefinitely

Rejected: doubles the maintenance cost for no new user capability. The
current duplication is a transition state, not the end state.

## References

- `src/app/features/observability/` — current in-app panels.
- `src/app/features/visualizations/` — current in-app visualisations.
- `src/app/features/dashboard/` — summary cards.
- Backend LGTM stack: `mirador-service/docker-compose.observability.yml`.
- Related `TASKS.md` entries: "Grafana-as-Code" and
  "UI → Grafana migration audit".
- [ADR-0003](0003-raw-svg-charts.md) — raw-SVG charting rationale,
  unchanged by this ADR.
