# User Manual

Per-feature walkthrough of every page in the UI. Anchors below let ADRs, commit messages and issues link to specific sections.

## Table of contents

1. [Dashboard](#dashboard)
2. [Customers](#customers)
3. [Diagnostic](#diagnostic)
4. [Observability](#observability)
5. [Visualizations](#visualizations)
6. [API Builder](#api-builder)
7. [Chaos & Traffic](#chaos--traffic)
8. [Settings](#settings)
9. [Activity](#activity)
10. [Login](#login)

---

## Dashboard

The home page. Shows the backend health at a glance.

**Stats cards** — Total customers, HTTP request count, latency percentiles (p50/p95/p99) from Prometheus.

**Live throughput chart** — Click "Start live chart" to see a bar chart of requests/second updating every 3s. The chart **persists when you navigate** to other pages (backed by `MetricsService` singleton).

**Health probes** — Three cards for `/actuator/health`, `/readiness`, `/liveness`. Each shows UP/DOWN badge and raw JSON. The sparkline above tracks health status over time.

**Auto-refresh** — Toggle 1s / 5s / 10s / 30s polling. Toast notifications fire when backend health changes (UP -> DOWN or vice versa).

**Docker service control** — Lists all Docker containers with their status. Start/stop/restart containers directly from the UI via the Docker API server (port 3333).

**Dependency graph** — SVG graph of backend services (API, PostgreSQL, Redis, Kafka, Ollama, Keycloak) with color-coded health status (green=UP, red=DOWN, gray=unknown). Status derived from `/actuator/health` components + Docker container state.

**Quick traffic generator** — Fires 10 requests across various endpoints (including slow ones: bio, enrich, aggregate) to populate metrics.

**Request heatmap** — 24-hour grid showing request volume distribution. Intensity = traffic volume.

**Before/After comparator** — Take "Snapshot A", make changes, take "Snapshot B". The table shows the diff with percentage change for each metric (customers, requests, latency p50/p95/p99).

**Observability links** — One-click access to Grafana, Prometheus, Zipkin, Pyroscope, Swagger, pgAdmin, Kafka UI, RedisInsight, Keycloak.

---

## Customers

Full CRUD with advanced features.

**Search** — Type in the search box. Debounced at 300ms, queries the backend.

**Sort** — Click any column header (ID, Name, Email, CreatedAt). Click again to reverse.

**Create** — Fill name + email in the left panel. Toggle "Idempotency-Key" to test replay safety.

**Edit** — Click "Edit" on any row. Modal form with save/cancel.

**Delete** — Click "Del" on a row, confirm in the modal. Or select multiple rows with checkboxes and "Delete selected" for batch delete.

**API Versioning** — Toggle v1.0 / v2.0. v2.0 adds the `createdAt` column.

**Views** — "Full" shows all fields, "Summary" shows only id + name (SELECT projection).

**Per-customer actions** — Click Bio (Ollama LLM), Todos (JSONPlaceholder), or Enrich (Kafka request-reply) to open the detail panel with tabs.

**Export** — "JSON" or "CSV" buttons download the current page data.

**Import** — "Import" button opens a file picker. Upload a `.json` array or `.csv` file. Progress bar shows creation status. Report shows ok/errors count.

---

## Diagnostic

Seven interactive scenarios with terminal-style colored logs.

| Scenario | What it tests |
|---|---|
| **API Versioning** | Side-by-side v1 vs v2 response comparison |
| **Idempotency** | Same key sent twice, verifies cached response |
| **Rate Limiting** | Burst N concurrent requests, observe 429s |
| **Kafka Enrich** | Request-reply timing, 504 on timeout |
| **Virtual Threads** | Parallel task execution time |
| **Version Diff** | Colored diff (green = added, red = removed) between v1 and v2 |
| **Stress Test** | Sustained load: configurable duration, concurrency, endpoint. Live SVG chart of throughput + errors |

**Run All** — Executes all 5 core scenarios sequentially (excludes Version Diff and Stress Test).

**History** — Toggle "History" to see past runs with timestamps and durations. "Export" downloads as JSON.

---

## Observability

Four tabs for live backend telemetry.

**Traces** — Queries Zipkin API via the Docker API proxy (`/docker-api/zipkin/api/v2/traces`). Shows trace list with operation, duration, span count. Click to expand span waterfall. "Flame" button opens a flame graph view.

**Logs** — Queries Loki with LogQL via the Docker API proxy (`/docker-api/loki/loki/api/v1/query_range`). Color-coded by level (ERROR=red, WARN=yellow, INFO=green, DEBUG=blue). "Live" button polls every 5s.

**Latency** — Fetches Prometheus histogram buckets and renders a bar chart of latency distribution. Converts cumulative buckets to differential counts.

**Live Feed** — Polls `/actuator/prometheus` every 2s and displays a scrolling feed of endpoint metrics (method, URI, status).

---

## Visualizations

Nine advanced visualization tabs.

**Golden Signals** — The 4 SRE golden signals: Latency (p95), Traffic (total requests), Errors (5xx rate), Saturation (thread count). Color-coded: green=ok, yellow=warn, red=critical. Thresholds: latency >500ms=critical, >100ms=warn; errors >5%=critical, >1%=warn.

**JVM Gauges** — Circular gauge charts (SVG arcs) for Heap Memory, CPU Usage, Live Threads, GC Pause. Values from `/actuator/prometheus` JVM metrics.

**Topology** — Animated service dependency map with 7 nodes (Browser, API, PostgreSQL, Redis, Kafka, Ollama, Kafka Consumer). "Animate traffic" sends colored particles along edges. Node health determined by `/actuator/health` + proxy checks to Kafka UI and Ollama.

**Waterfall** — Fires 6 parallel requests and renders them as horizontal bars (like Chrome DevTools Network tab). Shows start offset, duration, and status for each.

**Sankey** — Flow diagram from endpoint to HTTP status (2xx/3xx/4xx/5xx). Bar width proportional to request volume. Built from Prometheus `http_server_requests_seconds_count` metrics.

**Error Timeline** — Live stacked bar chart showing OK vs error responses over time. Polls every 3s by sending 5 probe requests.

**Kafka Lag** — Line chart (SVG path) of consumer lag over time. Polls every 5s from `kafka_consumer_fetch_manager_records_lag_max` metric.

**Slow Queries** — Parses `spring_data_repository_invocations_seconds` metrics from Prometheus. Shows query method, average duration, and call count.

**Bundle** — Treemap showing the relative size of each Angular lazy chunk. 3D block view with CSS transforms.

---

## API Builder

Postman-like HTTP client built into the app.

**Presets** — 13 pre-configured requests (health, customers CRUD, bio, todos, enrich, aggregate, prometheus, loggers). Click to load.

**Request form** — Method selector (GET/POST/PUT/DELETE/PATCH), URL input, headers textarea (one per line: `Key: Value`), body textarea for POST/PUT.

**Response** — Shows status code (color-coded: green <300, blue 3xx, yellow 4xx, red 5xx), response time, collapsible headers, and formatted body in a terminal-style panel.

**History** — Last 20 requests. Click to replay.

---

## Chaos & Traffic

Simulate failures and generate realistic traffic.

**Chaos actions:**
- **Exhaust Rate Limit** — 120 rapid requests to exceed the 100/min bucket
- **Kafka Timeout** — Triggers the 5s enrich timeout by calling `/customers/1/enrich`
- **Circuit Breaker Trip** — 10 rapid `/bio` calls to trip Ollama's circuit breaker
- **Invalid Payload Flood** — 50 empty POST requests for validation errors
- **Concurrent Writes** — 20 simultaneous customer creates
- **Generate Traffic** — Mixed GET/POST traffic for N seconds (configurable duration)

**Impact monitor** — Real-time chart showing OK vs error responses (polls every 2s with 5 health pings). Also shows live traffic breakdown from Prometheus with RPS calculation. Start it before running chaos actions to see the impact.

**Faker generator** — Creates N customers with realistic random names and emails. Configurable count (1-500) and delay between requests (ms). Abortable.

---

## Settings

Backend configuration explorer.

**Config properties** — Lists relevant properties from `/actuator/env` (rate limit, timeout, circuit breaker, Kafka, resilience, server.port, spring.application).

**Actuator explorer** — Click any endpoint button (Health, Info, Env, Beans, Metrics, Loggers, Prometheus) to see the raw response. Prometheus endpoint returns plain text; others return formatted JSON.

**Loggers** — Browse all Spring loggers. Filter by name. Click a level button (TRACE/DEBUG/INFO/WARN/ERROR) to change it live via POST to `/actuator/loggers/{name}`.

**SQL Explorer** — Execute SQL queries against the backend (requires a `/sql` endpoint). 4 preset queries included. Falls back to pgAdmin link if the endpoint is unavailable.

---

## Activity

Chronological event timeline for the current session.

Events logged: customer create/update/delete, health state changes, diagnostic runs, environment switches, bulk imports.

**Filters** — Click type badges to filter (All, Create, Update, Delete, Health, Diagnostic, Environment, Import).

**Clear** — Resets the timeline.

---

## Login

JWT authentication form. Default credentials: **admin / admin**.

On successful login, stores the JWT token in localStorage and redirects to the dashboard. The auth interceptor automatically attaches the token to all subsequent API requests.
