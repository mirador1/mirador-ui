# Overview

A full-stack observability and management platform built with Angular 21 and Spring Boot 4.

## What is Mirador?

A full-stack **observability and management platform** built with Angular 21 and Spring Boot 4. It demonstrates production-grade patterns for distributed tracing, structured logging, metrics collection, continuous profiling, chaos testing, and resilience — all visible and controllable from the browser.

*Mirador* — Spanish for *watchtower* or *viewpoint*. A place to watch, understand, and act.

- [gitlab.com/mirador1](https://gitlab.com/mirador1)
- [mirador1.duckdns.org](http://mirador1.duckdns.org)

> *(Hero illustration rendered in the UI — see the About page, tab "Overview".)*

## Tech stack badges

- Java 25
- Spring Boot 4
- PostgreSQL 17
- Apache Kafka 3.8
- Redis 7
- Angular 21
- Docker Compose
- GitLab CI/CD
- OpenTelemetry (traces, logs, metrics)
- Ollama (LLM)
- Keycloak (OAuth2)

## Architecture Overview

The system is composed of **22 services** organized in 8 layers, all orchestrated via two Docker Compose files. Data flows strictly left-to-right: Client → Application → Data Stores → Tools → Collectors → Dashboards.

| Layer | Role | Key Technologies |
| --- | --- | --- |
| Client | Angular SPA served by `ng serve` on :4200 | Angular 21 · TypeScript · SCSS · Raw SVG · Vitest |
| Application | REST API on :8080 — JWT + Keycloak | Spring Boot 4 · Java 25 · Virtual Threads · Micrometer · Swagger |
| Data Stores | Persistence, cache, messaging, AI | PostgreSQL 17 · Redis 7 · Kafka (KRaft) · Ollama llama3.2 |
| Resilience | Fault tolerance patterns | Bucket4j (rate limit) · Resilience4j (circuit breaker, retry) · Idempotency keys |
| Data Tools | Admin UI for each data store | pgAdmin · pgweb · RedisInsight · Redis Commander · Kafka UI |
| Obs Collectors | Trace, log & metric collection | OpenTelemetry OTLP → LGTM (Loki + Tempo + Mimir) · Prometheus |
| Obs Dashboards | Telemetry visualization | Grafana LGTM (incl. Pyroscope) · Prometheus UI |
| Infrastructure | Orchestration & proxies | Docker Compose (2 files, 22 containers) · docker-socket-proxy · Nginx CORS proxy |

> *(Diagram rendered in the UI — see the About page, tab "Overview". Columns: CLIENT → APPLICATION → DATA STORES → ADMIN TOOLS → OBSERVABILITY, with a QUALITY TOOLS & INFRA footer row.)*

---
[← Back to architecture index](README.md)
