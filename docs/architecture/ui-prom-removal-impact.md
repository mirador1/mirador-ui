# UI Prometheus removal — impact notes

This file captures the per-file **LOC deltas** and bundle-chunk sizes observed
during the retirement of Prometheus-fed UI visualisations. The decision
itself, with per-metric-category justification, lives in the ADR:

- **[ADR-0007 — Retire Prometheus-fed UI visualisations in favour of Grafana](../adr/0007-retire-prometheus-ui-visualisations.md)**

## Measured impact (commit-by-commit)

| Commit | Surface | Before | After | Delta |
| --- | --- | --- | --- | --- |
| `1fb787e` | `EnvService.grafanaUrl` added | — | — | +9 lines (enables deep-links) |
| `8d1957c` | `features/visualizations/` | 3 043 ts + 317 html | 217 ts + 125 html | **−3 149 lines**; chunk 84.13 kB → 18.88 kB |
| `dbeb207` | `features/dashboard/` | 1 229 ts + 384 html | 1 125 ts + 233 html | **−255 lines**; chunk 77.07 kB → 67.03 kB |
| _(pending)_ | `features/observability/` | 954 ts + ~380 html | expect ~700 ts + ~230 html | ~−400 lines |
| _(pending)_ | `core/metrics/metrics.service.ts` | 286 ts | 0 (deleted) | −286 lines |

Total expected once all steps land: **~−4 100 LOC** and ~**−85 kB** of lazy-loaded JS
(split across three chunks). None of the retired code had dedicated spec
files, so no test changes are required.

## Surviving Prometheus touch-points

After all planned commits, **the UI no longer reads `/actuator/prometheus`
at all**. The `prometheus-metrics-ui.md` inventory will be superseded; the
remaining surfaces on the three affected pages pull from:

- `/actuator/health` (health probes)
- `/actuator/quality` (quality summary — sourced from Jacoco / SpotBugs,
  not Prometheus)
- REST API endpoints (customer count, customer CRUD, bio / todos / enrich)
- `/analyze/bundle.json` (bundle treemap)
- Session-local state (Error Timeline, session activity, trace/log
  queries)

## If you're reading this because something broke

- **"Open metrics → 404"**: a leftover link from the old shell. Grafana
  moved — use `env.grafanaUrl()` (set in commit `1fb787e`) or open
  http://localhost:3001 manually.
- **"JVM / heap / GC panels disappeared"**: by design. See ADR-0007
  §"Per-category verdict". The equivalent in Grafana is the standard
  JVM Micrometer dashboard.
- **"I want something back"**: reintroduce only the interactive /
  session-local delta, not the pure read. ADR-0007's "What stays"
  table is the rubric.

---
[← Back to architecture index](README.md)
