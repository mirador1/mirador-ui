# Observability

Instrument once, visualise everywhere — a single OTLP exporter fans out to every backend.

A single OpenTelemetry OTLP exporter on the Spring Boot side fans out to every backend simultaneously. Switching dashboards does not require any backend change — only the consumer changes.

## Signal Routes

| Signal | Source | Transport | Backends |
| --- | --- | --- | --- |
| **Traces** | Spring Boot auto-instrumentation | OTEL OTLP (:4318) | Tempo — via Grafana LGTM (:3000, Explore → Traces) |
| **Logs** | Logback via OTel appender | OTEL OTLP (:4318) | Loki → Grafana LGTM (:3000) · direct LogQL via Nginx proxy (:3100) |
| **Metrics** | Micrometer (180+ metrics) | LGTM Prometheus scraper → `/actuator/prometheus` | Mimir API (:9091) · Grafana (:3000) · Angular Metrics page |
| **Profiles** | Grafana Pyroscope (built into LGTM) | OTLP push (:4040 via LGTM) | Grafana Explore Profiles (:3000) — CPU, alloc, lock flamegraphs |

## Key Correlation Patterns

- **Trace–Log correlation** — Every log line carries the active `traceId` in the MDC. Grafana Loki panel shows a "Jump to trace" link that opens the corresponding Tempo span.
- **Exemplars (metric → trace)** — Prometheus histogram buckets embed a `traceId` exemplar. Grafana renders a scatter-plot overlay — clicking a dot opens the exact trace for that request.
- **Continuous profiling** — Grafana Pyroscope is bundled inside the LGTM container — no separate service needed. Flamegraphs (CPU, alloc, lock) are available directly in **Grafana → Explore Profiles** at :3000.
- **Kafka trace propagation** — TraceId is injected into Kafka message headers by the OTel Kafka instrumentation, so spans connect across producer → broker → consumer → reply.

---
[← Back to architecture index](README.md)
