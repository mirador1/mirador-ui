# Customer Observability UI

Angular 21 frontend that demonstrates and exercises every observable feature of the [`customer-service`](../workspace-modern/customer-service) Spring Boot backend.

## Purpose

The UI makes backend mechanisms **visible and interactive** without requiring curl or Postman:

- Health probes with live UP/DOWN indicators
- Full customer lifecycle with API versioning, pagination, and idempotency
- Per-customer LLM bio, external Todos, and Kafka enrichment
- Interactive diagnostic scenarios (rate limiting, idempotency replay, Kafka timing, virtual threads)
- One-click links to the full observability stack (Grafana, Prometheus, Tempo, Loki, Swagger)

## Prerequisites

| Dependency | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Angular CLI | installed via `npx` or globally |
| `customer-service` backend | running on `localhost:8080` |

Start the backend first:

```bash
# from workspace-modern/customer-service/
docker compose up -d          # PostgreSQL, Kafka, Redis, Ollama
docker compose -f docker-compose.observability.yml up -d   # Grafana, Prometheus, Tempo, Loki
./mvnw spring-boot:run
```

## Quick start

```bash
npm install
npm start          # dev server → http://localhost:4200
```

Sign in with **admin / admin** (JWT issued by the backend's built-in auth).

## Screens

### Dashboard

Real-time health overview of the backend.

- **Health probes** — `/actuator/health`, `/readiness`, `/liveness` with UP/DOWN badges
- **Observability links** — direct links to Grafana (metrics), Grafana LGTM (traces + logs), Prometheus, Swagger UI, Actuator metrics endpoint, Keycloak admin

### Customers

Full customer management interface showcasing all backend capabilities.

| Feature | Endpoint | Notes |
|---|---|---|
| Create customer | `POST /customers` | Validation, RFC 9457 errors |
| Idempotency | `POST /customers` + `Idempotency-Key` header | LRU cache — replay button sends same key twice |
| List (v1) | `GET /customers` `X-API-Version: 1.0` | `{id, name, email}` |
| List (v2) | `GET /customers` `X-API-Version: 2.0` | Adds `createdAt` field |
| Summary projection | `GET /customers/summary` | SELECT id, name only |
| Recent customers | `GET /customers/recent` | Redis LPUSH ring buffer (last 10) |
| Aggregate | `GET /customers/aggregate` | Two parallel tasks on Java virtual threads |
| AI bio | `GET /customers/{id}/bio` | Ollama llama3.2, circuit breaker fallback |
| Todos | `GET /customers/{id}/todos` | JSONPlaceholder via `@HttpExchange`, resilience4j retry |
| Enrich | `GET /customers/{id}/enrich` | Kafka request-reply, 5 s timeout → 504 |

### Diagnostic

Five interactive scenarios, each with a **Run** button and a terminal-style log panel:

| Scenario | What it shows |
|---|---|
| **API Versioning** | Side-by-side v1 vs v2 response — spot the `createdAt` difference |
| **Idempotency** | Same `Idempotency-Key` sent twice — second call returns cached response, no duplicate |
| **Rate Limiting** | Concurrent request burst — observe 429 responses once the 100 req/min bucket empties |
| **Kafka Enrich** | Request-reply timing — shows 504 if Kafka/consumer is not running |
| **Virtual Threads** | Aggregate response time — two parallel backend tasks via Java virtual threads |

## Architecture

```
Angular 21 (standalone, zoneless)
│
├── core/auth/          AuthService (signal-based JWT)
│                       authInterceptor (adds Bearer header)
│
├── core/api/           ApiService (all backend endpoints)
│
├── features/
│   ├── login/          JWT sign-in form
│   ├── dashboard/      Health probes + observability links
│   ├── customers/      CRUD, versioning, per-customer actions
│   └── diagnostic/     Interactive scenarios
│
└── shared/layout/      AppShell (topbar, router outlet)
```

Key Angular patterns used:
- **Standalone components** — no NgModules
- **Zoneless change detection** — `provideZonelessChangeDetection()`
- **Signals** — all reactive state uses `signal()` / `computed()`
- **Lazy routes** — each feature is a separate JS chunk
- **Functional HTTP interceptor** — `HttpInterceptorFn` for JWT injection

## Port map

| Service | URL |
|---|---|
| This UI | http://localhost:4200 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Grafana (metrics) | http://localhost:3000 |
| Grafana LGTM (traces/logs) | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Keycloak | http://localhost:9090/admin |

## Build

```bash
npm run build       # production bundle → dist/
npm test            # vitest unit tests
```
