# ADR-0009 — Browser telemetry via OpenTelemetry → OTLP → Tempo

- **Status**: Accepted (Phase A landed in MR 30; Phase B pending backend MR)
- **Date**: 2026-04-19
- **Refines**: [ADR-0006](0006-grafana-duplication.md), [ADR-0007](0007-retire-prometheus-ui-visualisations.md), [ADR-0008](0008-retire-observability-ui-in-favour-of-grafana.md)
- **Related (backend)**: mirador-service ADR-0026 (Spring Boot scope limit)

## Context

Up to this point, browser-side observability in Mirador UI consisted
of:

- `console.error(err)` scattered in RxJS error callbacks — lost as
  soon as the user closes DevTools.
- The session-local `ActivityService` timeline — in-memory, per-tab,
  capped at 200 entries, gone on reload.
- Toasts for expected HTTP errors.
- Zero correlation between a 500 the user just saw and the trace Tempo
  captured on the backend.

ADR-0008 retired the in-UI Observability page on the principle that
**Grafana Explore owns observability consumption**. The same argument
applies to browser telemetry: we should feed it into the same LGTM
bundle the backend already writes to, not invent a second pipeline.

## Decision

**Use OpenTelemetry's browser SDK directly, not Grafana Faro.**

Rationale:

- Faro needs a dedicated Faro-compatible receiver (Alloy, Grafana Cloud
  Faro, or a Faro collector container). Any of those adds infra,
  conflicting with the ~€2/month portfolio budget.
- OTLP HTTP is already exposed by the LGTM bundle on `:4318`. Spring
  Boot writes to it today. Browser traces would land in the same
  Tempo instance, correlated by `traceparent` header propagation.
- W3C trace context means clicking a slow request in the browser lets
  the dev jump to the exact backend span chain in Grafana Explore.
- OTel SDK is the upstream library — if we later want Faro's session
  tracking, we swap the exporter, not the whole stack.

**What gets captured (Phase B)**:

| Signal | How | Lands in |
|---|---|---|
| HTTP client spans | `@opentelemetry/instrumentation-fetch` + `-xml-http-request` | Tempo |
| Unhandled exceptions | Custom Angular `ErrorHandler` → span event | Tempo |
| Router navigations | Manual spans around `Router.events` | Tempo |
| Core Web Vitals (LCP, CLS, INP) | `web-vitals` lib → span events | Tempo |
| Console errors | Logged via `TelemetryService.error()` + captured span | Tempo |

Logs and measurements stay out of scope until we either adopt Alloy or
pay for Grafana Cloud — OTel browser SDK logs are experimental and
half the receivers don't accept them yet.

## Phased delivery

### Phase A — landed in this MR (no backend change)

- `TelemetryService` — structured logger with bounded history signal,
  used by `ActivityService` and feature components in place of
  `console.*`.
- `AppErrorHandler` — custom `ErrorHandler` that routes uncaught
  exceptions to `TelemetryService` + `ToastService` + `ActivityService`,
  so users see a toast AND a dev opening the Activity page sees the
  stack trace, instead of a silent JS console error.
- `env.service.ts.otlpUrl` — env-aware OTLP CORS-proxy URL (one per
  environment: 4319 local, 14319 kind, 24319 prod). `null` when the
  proxy is not running.
- `environment.production` is not used — Angular's `isDevMode()`
  replaces it. Telemetry is a no-op in dev mode to keep the DevTools
  network tab clean.
- No new runtime deps in Phase A — this is an in-UI refactor.

### Phase B — needs mirador-service MR (backend repo)

The browser cannot POST directly to `:4318` — no CORS headers on the
LGTM bundle's OTLP receiver. Phase B adds:

1. **Nginx CORS proxy** (`mirador-service/infra/observability/cors-proxy.conf`)
   — new server block on `:4319` forwarding to `:4318` with the
   existing `Access-Control-Allow-Origin: http://localhost:4200`
   headers (same pattern as the Loki proxy).
2. **Compose port exposure** — add `"4319:4319"` to the nginx-cors
   service in `docker-compose.observability.yml`.
3. **UI npm deps** — `@opentelemetry/sdk-trace-web`,
   `context-zone`, `exporter-trace-otlp-http`,
   `instrumentation-fetch`, `instrumentation-xml-http-request`,
   `resources`, `semantic-conventions` (all pinned via Renovate).
4. **Wire the exporter** — `TelemetryService.initOtel()` builds a
   `WebTracerProvider`, registers the fetch / xhr auto-instrumentations
   with a propagator allowlist (`/^http:\/\/localhost:(8080|18080|28080)/`),
   exports to `env.otlpUrl() + '/v1/traces'`.

Phase B is a separate MR because it touches both repos and because the
backend change lands independently (the existing UI keeps working
without it — just no browser spans).

## Consequences

### Positive

- **Single observability consumption surface** — browser traces in
  Grafana Explore, next to backend traces, correlated by traceId.
- **Bounded blast radius** — TelemetryService gates on `isDevMode()`
  and on `env.otlpUrl()`; if the proxy is offline, it degrades to
  local-only logging, no failed HTTP from the browser.
- **No vendor lock** — OTel is upstream; a later switch to Alloy or
  Grafana Cloud Faro is a transport change, not a rewrite.

### Negative

- **No Web Vitals or session-replay today** — Faro bundles those;
  OTel browser doesn't. Added in Phase B via the `web-vitals` lib
  emitting span events, session-replay declined (privacy + bundle
  cost).
- **Browser bundle grows by ~40 kB gzipped** (Phase B) — acceptable
  given the initial-total budget still sits at 143 kB after MR 1-3
  LOC cuts.
- **Phase B requires a backend MR** — noted in TASKS.md; the UI side
  of Phase B is idempotent (no-op until the proxy is up).

## Revisit this when

- We adopt Grafana Alloy on the backend — switch the exporter to Alloy
  OTLP endpoint and enable logs/measurements.
- Mirador gets real users — session tracking + replay may justify Faro
  or Sentry.
- Bundle size breaches the 1 MB error budget — we pre-split the OTel
  SDK into a lazy chunk loaded only on feature pages with outbound
  HTTP.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Grafana Faro direct | Adds a Faro receiver (Alloy container / Grafana Cloud) — infra cost beyond €2 budget. |
| Sentry / GlitchTip | Another SaaS or self-host — overlaps with what Tempo already stores. |
| `console.*` everywhere | No correlation with backend spans, lost on refresh. |
| Custom `/telemetry` BFF | ADR-0026 just removed `/obs/*` BFFs. Reintroducing them would violate that. |
| Full Web Vitals dashboard | Useful but premature for a portfolio demo; added when we have real traffic. |
