# ADR-0008 — Retire the Observability UI page in favour of Grafana

- **Status**: Accepted
- **Date**: 2026-04-19
- **Refines**: [ADR-0006](0006-grafana-duplication.md), [ADR-0007](0007-retire-prometheus-ui-visualisations.md)
- **Related (backend)**: mirador-service ADR-0026 (Spring Boot scope limit), ADR-0029 below

## Context

[ADR-0007](0007-retire-prometheus-ui-visualisations.md) retired the
79 Prometheus-fed UI visualisations (dashboard gauges, visualizations
page, observability latency histogram). It kept the **Observability
page** because its three remaining tabs speak TraceQL (Tempo) / LogQL
(Loki) / Spring Boot `/actuator/loggers` — not PromQL.

Six months of operating that page reveals:

- **Trace search**: the in-UI OTLP parser (~250 LOC) is a re-invention
  of Grafana Explore's Tempo datasource. Every Tempo feature we add
  (span filtering, metric exemplars, service map) already exists in
  Grafana one click away.
- **Log search**: the in-UI LogQL editor (~150 LOC) re-invents
  Grafana Explore's Loki datasource. Same argument.
- **Loggers panel**: the only part with real write behaviour —
  `POST /actuator/loggers/{name}` to change level at runtime. That's
  Spring Boot admin, not observability consumption.

The principle that justified ADR-0007 applies here too: **if the
feature's sole input is an observability query and there's no
session-local state / no write action, the custom UI is duplicating
a mature tool**.

The backend is aligned:

- `/obs/loki/*` and `/obs/tempo/*` BFF endpoints were removed by
  mirador-service ADR-0026 (Spring Boot scope limit).
- `EnvService.grafanaUrl()` is env-aware (compose :3000, kind :13000,
  prod :23000).
- Grafana has the full LGTM datasources pre-provisioned.

## Decision

**Delete the Observability feature page**. The nav entry becomes a
redirect to Grafana Explore, pre-filtered on `service.name=mirador`
and pointing at the right datasource (Tempo / Loki / Mimir) based on
the user's intent.

The **Loggers** section survives — it's app-admin, not observability.
Move it into the Settings page (`/settings`), which already hosts the
Actuator Endpoint Explorer.

## Consequences

### Positive

- **~800 LOC deleted** from the UI (ObservabilityComponent + SCSS
  + HTML template).
- **No more TraceQL / LogQL reinvention**. Upstream improvements to
  Grafana Explore come for free.
- **Clearer boundary**: UI owns business domain + app-admin (Settings,
  Database, Customers, Chaos trigger); Grafana owns observability
  consumption.
- **Faster page loads** — no more polling five-minute windows of Loki
  data over the tunnel on every tab switch.

### Negative

- **One less page to show in the portfolio**. Mitigated by: the
  remaining pages become visibly cleaner, the architecture decision
  itself is the narrative.
- **Users learn Grafana Explore** instead of a custom in-UI search.
  Grafana Explore is widely-known industrial tooling — net positive
  for anyone doing ops.
- **Loggers page moves** — one link to update in the sidebar.

## Migration plan (executed in this MR)

1. Delete `src/app/features/observability/` (component + template + styles).
2. Move the logger-level-editor (if still useful) into
   `SettingsComponent` as a collapsible section.
3. Update `app.routes.ts`: drop the `/observability` route, add a
   redirect `/observability → <grafana>/explore?…` at sidebar-click
   time (implemented in `AppShellComponent`).
4. Update `AppShellComponent.navTree`: the "Observability" item
   becomes an `external: true` entry that opens Grafana Explore in a
   new tab.
5. Delete `docs/architecture/observability.md` references to the
   in-UI trace / log tabs.

## Alternatives considered

| Option                                                      | Why rejected                                                    |
|-------------------------------------------------------------|-----------------------------------------------------------------|
| Keep the page as-is                                         | Duplicates Grafana; ~400 LOC of parser code to maintain forever. |
| Embed Grafana Explore in an iframe                          | iframe CORS + theme sync + tunneled 3-env URL soup. Not worth. |
| Keep only the Loggers tab                                   | Loggers belongs in Settings, not Observability. Cleaner there. |
| Replace parser by the official `@grafana/data` npm package  | Ships as a Grafana plugin, not a standalone SDK. Wrong layer.   |

## Revisit this when

- Grafana Explore becomes unable to reach the tunnelled LGTM (unlikely
  while ADR-0025 holds and `env.grafanaUrl()` points at the right port).
- We decide to build a Grafana panel plugin (Angular-based panel
  running inside Grafana rather than next to it).
