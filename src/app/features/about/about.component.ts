import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly activeTab = signal<'overview' | 'pages' | 'stack' | 'infra' | 'shortcuts' | 'tech'>(
    'overview',
  );

  readonly tabs = [
    { id: 'overview', label: '📖 Overview' },
    { id: 'pages', label: '🗂️ Pages' },
    { id: 'stack', label: '🔧 Stack' },
    { id: 'infra', label: '🏗️ Infrastructure' },
    { id: 'shortcuts', label: '⌨️ Shortcuts' },
    { id: 'tech', label: '📚 Technologies' },
  ] as const;

  readonly technologies = [
    {
      name: 'AKHQ',
      description:
        'Advanced Kafka management UI with live tail, consumer lag, schema registry, and ACL management.',
      usage:
        'Pre-configured to connect to the local Kafka broker. The About page lists it on port 8083. Used to inspect topics, consumer groups, and replay messages during debugging.',
    },
    {
      name: 'Angular 21',
      description:
        'Frontend framework for building single-page applications. Uses standalone components, signals-based reactivity, and zoneless change detection.',
      usage:
        'The entire UI is an Angular 21 SPA. No NgModules — all components are standalone. Zoneless mode (no Zone.js) means change detection is triggered explicitly via signals and `markForCheck()`.',
    },
    {
      name: 'Apache Kafka',
      description: 'Distributed event streaming platform running in KRaft mode (no ZooKeeper).',
      usage:
        'Two messaging patterns: async events on `customer.created` topic (fire-and-forget after customer creation), and synchronous request-reply enrichment via `customer.request` / `customer.reply` topics with a 5-second timeout returning 504 on expiry.',
    },
    {
      name: 'Bucket4j',
      description: 'Java rate-limiting library based on the token-bucket algorithm.',
      usage:
        'Applied as a Spring interceptor: 100 requests per minute per IP address. Excess requests return HTTP 429 with a `Retry-After` header and the remaining wait time. Demonstrable in the Diagnostic and Chaos pages.',
    },
    {
      name: 'Docker Compose',
      description: 'Tool for defining and running multi-container Docker applications.',
      usage:
        'Two compose files: `docker-compose.yml` (PostgreSQL, Redis, Kafka, Ollama, Keycloak, admin tools) and `docker-compose.observability.yml` (Grafana, Prometheus, Zipkin, Jaeger, Pyroscope, LGTM, Nginx proxies). The Dashboard Architecture view shows live status of all 22 containers.',
    },
    {
      name: 'docker-socket-proxy',
      description:
        'Tecnativa proxy that exposes a filtered, read-only subset of the Docker Engine API over TCP.',
      usage:
        'Mounted on port 2375. Allows the Angular frontend (via a Nginx CORS proxy) to query container status, start/stop containers, and display the Architecture map without exposing the full Docker socket.',
    },
    {
      name: 'Flyway',
      description: 'Database schema migration tool for Java applications.',
      usage:
        'All PostgreSQL schema changes are versioned as `V{n}__description.sql` migration files. Flyway runs automatically on Spring Boot startup and is visible in the Database page under the "Schema & Flyway" preset category.',
    },
    {
      name: 'Grafana',
      description:
        'Open-source analytics and monitoring platform with pre-built and custom dashboards.',
      usage:
        'Two Grafana instances: port 3000 (standalone, Prometheus datasource) with pre-provisioned HTTP throughput/latency/JVM dashboards, and port 3001 (inside the LGTM container) with Tempo traces, Loki logs, and Prometheus metrics for full correlation.',
    },
    {
      name: 'HikariCP',
      description: 'High-performance JDBC connection pool for Java.',
      usage:
        'Default connection pool used by Spring Data JPA. Pool metrics (active connections, pending threads, pool size, timeouts) are exposed as Prometheus metrics and visible in the Metrics page under the JVM gauges section.',
    },
    {
      name: 'Jaeger',
      description:
        'Distributed tracing backend with advanced analysis features: trace comparison, critical path, flamegraph, dependency graph.',
      usage:
        'Receives traces via OTLP from the LGTM collector on port 16686. Used in the Observability page Traces tab alongside Zipkin. Particularly useful for comparing two traces side-by-side or visualising the critical path of slow requests.',
    },
    {
      name: 'Java 25',
      description:
        'Latest LTS-track JVM release with virtual threads (Project Loom), pattern matching, records, and sealed classes.',
      usage:
        'The Spring Boot backend runs on Java 25 with `spring.threads.virtual.enabled=true`. Virtual threads mean each HTTP request runs on a lightweight virtual thread instead of a platform thread, enabling high concurrency without thread pool tuning.',
    },
    {
      name: 'JWT (JSON Web Tokens)',
      description: 'Compact, self-contained tokens for stateless authentication.',
      usage:
        'Issued by `POST /auth/login` and by Keycloak (OAuth2). The Angular frontend stores the access token and refresh token, attaches `Authorization: Bearer <token>` to every API call via the auth interceptor, and silently refreshes on 401.',
    },
    {
      name: 'Kafka UI',
      description: 'Web UI for browsing Kafka topics, messages, and consumer groups.',
      usage:
        'Pre-configured on port 9080. Listed in the About Infrastructure tab and Dashboard Architecture view. Lighter alternative to AKHQ for quick topic inspection.',
    },
    {
      name: 'Keycloak 26',
      description: 'Open-source Identity and Access Management (IAM) with OAuth2/OIDC support.',
      usage:
        'Optional SSO provider on port 9090. The Spring Boot backend is configured to accept both local JWT tokens and Keycloak-issued OIDC tokens. A realm and client are pre-configured. The login page supports both paths.',
    },
    {
      name: 'Lefthook',
      description: 'Fast Git hooks manager written in Go.',
      usage:
        'Configured with a `pre-push` hook that runs the unit test suite (`mvn test`) before every `git push`. Prevents pushing code that breaks tests. Also runs Prettier formatting check.',
    },
    {
      name: 'Lettuce',
      description:
        'Non-blocking, reactive Redis client for Java, used internally by Spring Data Redis.',
      usage:
        'All Redis operations (idempotency key reads/writes, ring buffer LPUSH/LTRIM, Bucket4j counter increments) go through Lettuce. Its connection pool and operation metrics are exposed via Micrometer and visible in the Metrics page.',
    },
    {
      name: 'Loki',
      description:
        'Horizontally-scalable log aggregation system by Grafana Labs, queryable with LogQL.',
      usage:
        'Runs inside the LGTM container. Spring Boot sends logs via the `opentelemetry-logback-appender` → OTLP → LGTM collector → Loki. The Observability Logs tab queries Loki directly via a Nginx CORS proxy on port 3100 using LogQL. Each log line carries the `traceId` for Grafana trace-to-log correlation.',
    },
    {
      name: 'Micrometer',
      description: 'Instrumentation facade for JVM applications, vendor-neutral metrics API.',
      usage:
        'Every Spring Boot component is auto-instrumented: HTTP request histograms, JVM memory/GC/threads, HikariCP pool, Lettuce Redis, Kafka producer/consumer timing, Spring Security filter chain, Spring Data repository invocations. The backend exposes 180+ metrics at `/actuator/prometheus`. The Angular UI parses this raw text format to power 78 metric cards and 55 gauges.',
    },
    {
      name: 'Nginx',
      description: 'High-performance web server and reverse proxy.',
      usage:
        'Two Nginx CORS proxy instances: one forwards requests to Loki (port 3100) adding `Access-Control-Allow-Origin: *` headers so the Angular app can call Loki directly; another forwards to the docker-socket-proxy (port 2375) for container management from the browser.',
    },
    {
      name: 'Ollama',
      description: 'Tool for running large language models (LLMs) locally.',
      usage:
        'Runs the `llama3.2` model on port 11434. The `GET /customers/{id}/bio` endpoint calls Ollama via Spring AI to generate an AI-written customer biography. Protected by a Resilience4j circuit breaker that opens after 10 failures in 60 seconds.',
    },
    {
      name: 'OpenTelemetry',
      description: 'Vendor-neutral observability framework for traces, metrics, and logs.',
      usage:
        'Spring Boot exports traces and logs via OTLP to the LGTM collector on port 4318. Kafka observation is enabled so traceIds propagate through message headers across producer → broker → consumer → reply. The `opentelemetry-logback-appender` bridges Logback logs into the OTel pipeline.',
    },
    {
      name: 'pgAdmin',
      description: 'Full-featured PostgreSQL administration UI.',
      usage:
        'Pre-configured in desktop mode (no login) on port 5050. Auto-connects to the local PostgreSQL instance. Used for schema browsing, SQL execution, ERD visualisation, and backup.',
    },
    {
      name: 'pgweb',
      description: 'Lightweight, read-only web-based PostgreSQL client with a REST API.',
      usage:
        "Runs on port 8081. The Angular Database page uses pgweb's REST API (`/api/query`) to execute the 27 SQL presets directly from the browser without any backend involvement.",
    },
    {
      name: 'PostgreSQL 17',
      description: 'Advanced open-source relational database.',
      usage:
        'Primary data store for customer records. Managed by Spring Data JPA with Hibernate. Schema versioned by Flyway. The `shedlock` table is also stored here for distributed scheduler locking. Exposed on port 5432.',
    },
    {
      name: 'Prettier',
      description: 'Opinionated code formatter for TypeScript, HTML, SCSS, and JSON.',
      usage:
        'Enforced via Lefthook pre-push hooks and the GitLab CI pipeline. All Angular source files are formatted to a consistent style. Run manually with `npx prettier --write "src/**/*.{ts,html,scss,json}"`.',
    },
    {
      name: 'Prometheus',
      description: 'Time-series metrics database with PromQL query language.',
      usage:
        'Scrapes `/actuator/prometheus` every 15 seconds. Stores 180+ metrics. Powers the Grafana dashboards on port 3000. Also queried directly by the Angular Metrics page and Observability Latency tab to parse the raw text exposition format.',
    },
    {
      name: 'Pyroscope',
      description: 'Continuous profiling platform for CPU, memory allocation, and lock contention.',
      usage:
        'The Spring Boot app is started with the Pyroscope Java agent (itimer + alloc + lock profiling events) via `./run.sh app-profiled`. Flamegraphs are accessible on port 4040. Visible in the About page infrastructure tab.',
    },
    {
      name: 'Redis 7',
      description: 'In-memory data structure store used as cache, message broker, and database.',
      usage:
        'Three concurrent uses: (1) idempotency key storage with TTL — `Idempotency-Key` header value stored with a 24h expiry to prevent duplicate mutations; (2) RecentCustomerBuffer — a ring buffer of the last 10 created customer IDs via `LPUSH`/`LTRIM`; (3) Bucket4j rate-limit counters per IP.',
    },
    {
      name: 'Redis Commander',
      description: 'Redis web GUI with live command monitor.',
      usage:
        'Runs on port 8082. Auto-connects to the local Redis instance. Useful for watching real-time Redis commands during idempotency or rate-limit demonstrations.',
    },
    {
      name: 'RedisInsight',
      description: 'Official Redis desktop/web client with key browser, memory analysis, and CLI.',
      usage:
        'Runs on port 5540. Pre-configured to connect to the local Redis instance. Used to inspect idempotency keys, ring buffer contents, and rate-limit counters stored as hashes.',
    },
    {
      name: 'Resilience4j',
      description:
        'Lightweight fault-tolerance library for Java with circuit breaker, retry, bulkhead, and rate limiter patterns.',
      usage:
        'Circuit breaker on the Ollama `/bio` call: trips after 10 failures in 60 seconds, stays open for 30 seconds before probing. Retry on external JSONPlaceholder API calls (3 attempts, exponential backoff). Both are visible and triggerable in the Diagnostic page.',
    },
    {
      name: 'SCSS',
      description: 'CSS preprocessor adding variables, nesting, mixins, and functions.',
      usage:
        'All Angular component styles are written in SCSS. CSS custom properties (`var(--color-accent)`, `var(--bg-card)`) power the dark/light theme switching. No CSS-in-JS, no utility-class framework.',
    },
    {
      name: 'ShedLock',
      description: 'Distributed lock library for Spring `@Scheduled` jobs.',
      usage:
        'Uses a `shedlock` table in PostgreSQL to ensure that scheduled tasks run on exactly one node in a multi-instance deployment. Configured with `@EnableSchedulerLock`. Visible in the Settings page under Scheduled Jobs.',
    },
    {
      name: 'Spring AI',
      description: 'Spring integration for AI/ML models and vector stores.',
      usage:
        'Used to call the locally-running Ollama `llama3.2` model for the `GET /customers/{id}/bio` endpoint. The ChatClient is configured with a prompt template and wrapped in a Resilience4j circuit breaker.',
    },
    {
      name: 'Spring Boot 4',
      description:
        'Convention-over-configuration framework for production-ready Java applications.',
      usage:
        'The entire backend is a Spring Boot 4 application. Auto-configuration provides the embedded Tomcat server, Jackson JSON binding, Spring Security, Spring Data JPA, Spring Kafka, Spring Data Redis, Micrometer metrics, and Actuator endpoints out of the box.',
    },
    {
      name: 'Spring Data JPA',
      description: 'Spring abstraction over JPA/Hibernate for repository-based data access.',
      usage:
        'All customer CRUD operations use `JpaRepository<Customer, Long>` with JPQL queries. Custom specifications for dynamic search/filter. Micrometer auto-instruments all repository method calls with timing metrics.',
    },
    {
      name: 'Spring Security',
      description:
        'Security framework for authentication, authorisation, and protection against common exploits.',
      usage:
        'Configured with JWT filter chain: every request is validated against the local JWT secret or Keycloak public key. `@PreAuthorize` annotations restrict endpoints by role. Login attempt throttling tracks failed attempts per username. The Security Demo page deliberately bypasses security on its vulnerable endpoints.',
    },
    {
      name: 'Tempo',
      description:
        "Grafana's scalable distributed tracing backend optimised for storage and query of trace data.",
      usage:
        'Runs inside the LGTM container. Receives traces from the OTLP collector alongside Jaeger. Queried by the Grafana instance on port 3001. Enables trace-to-log correlation: clicking a traceId in the Loki logs panel jumps to the corresponding Tempo trace.',
    },
    {
      name: 'TypeScript 5.9',
      description: 'Strongly-typed superset of JavaScript that compiles to plain JS.',
      usage:
        'All Angular components, services, interceptors, and utilities are written in strict TypeScript. No `any` types in production code (except for Angular forms and dynamic HTTP responses). Compile-time type checking catches API contract mismatches before runtime.',
    },
    {
      name: 'Vitest',
      description: 'Fast Vite-native unit testing framework compatible with the Jest API.',
      usage:
        'Replaces Karma+Jasmine for Angular unit tests. Runs with a jsdom environment. Tests cover services, pipes, and pure functions. Executed by `./run.sh test` and the GitLab CI pipeline. No `fakeAsync`/`tick` — async is handled with real Promises and `vi.useFakeTimers()`.',
    },
    {
      name: 'Zipkin',
      description:
        'Distributed tracing system with a lightweight web UI for visualising request flows.',
      usage:
        'Receives traces via its native HTTP protocol. Accessible on port 9411. Queried by the Angular Observability Traces tab to display span waterfalls and flamegraphs. Lighter-weight alternative to Jaeger for quick per-request inspection.',
    },
  ];
  readonly portMap = [
    // Application
    {
      port: 8080,
      name: 'Customer API',
      category: 'App',
      note: 'REST API + WebSocket + Swagger UI',
    },
    { port: 4200, name: 'Angular UI', category: 'App', note: 'This frontend (ng serve)' },
    // Databases
    {
      port: 5432,
      name: 'PostgreSQL',
      category: 'Data',
      note: 'Primary database (via DB_PORT env)',
    },
    { port: 6379, name: 'Redis', category: 'Data', note: 'Cache, idempotency, ring buffer' },
    { port: 9092, name: 'Kafka', category: 'Data', note: 'KRaft mode, PLAINTEXT_HOST listener' },
    { port: 11434, name: 'Ollama', category: 'Data', note: 'Local LLM (llama3.2) for /bio' },
    { port: 9090, name: 'Keycloak', category: 'Data', note: 'OAuth2/OIDC — admin / admin' },
    // Admin Tools
    {
      port: 5050,
      name: 'pgAdmin',
      category: 'Admin',
      note: 'PostgreSQL UI (desktop mode, no login)',
    },
    { port: 8081, name: 'pgweb', category: 'Admin', note: 'Lightweight SQL client + REST API' },
    { port: 9080, name: 'Kafka UI', category: 'Admin', note: 'Topics, messages, consumer groups' },
    {
      port: 5540,
      name: 'RedisInsight',
      category: 'Admin',
      note: 'Redis key browser, memory analysis',
    },
    {
      port: 8082,
      name: 'Redis Commander',
      category: 'Admin',
      note: 'Live command monitor, auto-connects',
    },
    { port: 8083, name: 'AKHQ', category: 'Admin', note: 'Advanced Kafka UI — live tail, ACLs' },
    // Observability
    { port: 3000, name: 'Grafana', category: 'Obs', note: 'Pre-provisioned dashboards (no login)' },
    { port: 3001, name: 'Grafana (LGTM)', category: 'Obs', note: 'OTel traces, Loki logs, Tempo' },
    {
      port: 9091,
      name: 'Prometheus',
      category: 'Obs',
      note: 'Metrics store (9090 used by Keycloak)',
    },
    { port: 9411, name: 'Zipkin', category: 'Obs', note: 'Distributed tracing (lightweight UI)' },
    {
      port: 16686,
      name: 'Jaeger',
      category: 'Obs',
      note: 'Advanced tracing — comparison, flamegraph',
    },
    { port: 4040, name: 'Pyroscope', category: 'Obs', note: 'Continuous profiling — CPU, memory' },
    {
      port: 3100,
      name: 'Loki (CORS proxy)',
      category: 'Obs',
      note: 'Log queries via Nginx CORS proxy',
    },
    { port: 4318, name: 'OTLP HTTP', category: 'Obs', note: 'Spring Boot sends traces/logs here' },
    {
      port: 2375,
      name: 'Docker API proxy',
      category: 'Infra',
      note: 'Filtered, read-only Docker Engine API',
    },
  ];

  readonly portCategories = ['App', 'Data', 'Admin', 'Obs', 'Infra'];

  readonly runCommands = [
    { cmd: './run.sh all', desc: 'Start everything (infra + observability + app)' },
    { cmd: './run.sh restart', desc: 'Stop + restart everything (keeps data)' },
    { cmd: './run.sh stop', desc: 'Stop app + all containers' },
    { cmd: './run.sh nuke', desc: 'Full cleanup — containers, volumes, build artifacts' },
    { cmd: './run.sh status', desc: 'Check status of all services' },
    { cmd: './run.sh simulate', desc: 'Generate traffic (60 iterations, 2s pause)' },
    { cmd: './run.sh obs', desc: 'Start only the observability stack (Grafana, Prometheus…)' },
    { cmd: './run.sh app', desc: 'Start only the Spring Boot app' },
    { cmd: './run.sh app-profiled', desc: 'Start app with Pyroscope profiling agent' },
    { cmd: './run.sh test', desc: 'Unit tests (no Docker)' },
    { cmd: './run.sh integration', desc: 'Integration tests (Testcontainers)' },
    { cmd: './run.sh verify', desc: 'lint + unit + integration — mirrors full CI pipeline' },
    { cmd: './run.sh security-check', desc: 'OWASP Dependency-Check (CVE scan)' },
  ];

  readonly stack = [
    {
      category: 'Frontend',
      items: [
        {
          icon: '🅰️',
          name: 'Angular 21',
          detail: 'Standalone components, zoneless change detection, signals-based state',
        },
        { icon: '📘', name: 'TypeScript 5.9', detail: 'Strict mode, no external state library' },
        { icon: '🎨', name: 'SCSS', detail: 'CSS custom properties for dark/light theming' },
        {
          icon: '📊',
          name: 'Raw SVG',
          detail: 'All charts and visualizations — no charting library',
        },
        { icon: '🧪', name: 'Vitest', detail: 'Unit tests with jsdom environment' },
      ],
    },
    {
      category: 'Backend',
      items: [
        { icon: '🍃', name: 'Spring Boot 4', detail: 'Java 25, virtual threads, pattern matching' },
        {
          icon: '🐘',
          name: 'PostgreSQL 17',
          detail: 'Primary database, Flyway migrations, Spring Data JPA',
        },
        {
          icon: '🗄️',
          name: 'Redis 7',
          detail: 'Distributed caching, idempotency keys, ring buffer',
        },
        {
          icon: '📨',
          name: 'Apache Kafka',
          detail: 'KRaft mode, async events, request-reply enrich pattern',
        },
        {
          icon: '🧠',
          name: 'Ollama',
          detail: 'Local LLM (llama3.2) for bio generation via Spring AI',
        },
        { icon: '🔐', name: 'Keycloak 26', detail: 'OAuth2/OIDC identity provider (optional)' },
      ],
    },
    {
      category: 'Resilience',
      items: [
        {
          icon: '⚡',
          name: 'Resilience4j',
          detail: 'Circuit breaker on Ollama /bio, retry on external APIs',
        },
        { icon: '🚦', name: 'Bucket4j', detail: 'Rate limiting — 100 req/min per IP' },
        {
          icon: '🔁',
          name: 'Idempotency',
          detail: 'LRU cache (10k entries) with Idempotency-Key header',
        },
      ],
    },
    {
      category: 'Observability',
      items: [
        {
          icon: '🔥',
          name: 'Prometheus',
          detail: 'Metrics store — scrapes /actuator/prometheus every 15s (180+ metrics)',
        },
        {
          icon: '📊',
          name: 'Grafana',
          detail: 'Dashboards — HTTP throughput, latency, JVM, pre-provisioned',
        },
        { icon: '🔗', name: 'Zipkin', detail: 'Distributed tracing — span waterfall, service map' },
        {
          icon: '🔭',
          name: 'Jaeger',
          detail: 'Advanced tracing — trace comparison, dependency graph, critical path',
        },
        {
          icon: '🔍',
          name: 'Loki (LGTM)',
          detail: 'Log aggregation via OpenTelemetry Logback appender',
        },
        {
          icon: '🧬',
          name: 'Pyroscope',
          detail: 'Continuous profiling — CPU, memory, lock flamegraphs',
        },
        {
          icon: '📈',
          name: 'Micrometer',
          detail: '180+ metrics: HTTP histograms, JVM, HikariCP, Kafka, Redis, custom',
        },
      ],
    },
    {
      category: 'Admin Tools',
      items: [
        { icon: '🛢️', name: 'pgAdmin', detail: 'PostgreSQL web admin — schemas, SQL, ERD, backup' },
        { icon: '🔬', name: 'pgweb', detail: 'Lightweight SQL client with REST API (read-only)' },
        { icon: '🔎', name: 'RedisInsight', detail: 'Redis key browser, memory analysis, CLI' },
        {
          icon: '📟',
          name: 'Redis Commander',
          detail: 'Redis live command monitor, auto-connects',
        },
        { icon: '📋', name: 'Kafka UI', detail: 'Topics, messages, consumer groups browser' },
        {
          icon: '🔬',
          name: 'AKHQ',
          detail: 'Advanced Kafka UI — live tail, schema registry, ACLs',
        },
      ],
    },
    {
      category: 'Infrastructure',
      items: [
        {
          icon: '🐳',
          name: 'Docker Compose',
          detail: '20+ containers orchestrated across 2 compose files',
        },
        {
          icon: '🔒',
          name: 'docker-socket-proxy',
          detail: 'Filtered Docker API for the frontend (containers only)',
        },
        {
          icon: '🌐',
          name: 'Nginx CORS proxy',
          detail: 'Adds CORS headers for Loki and Docker API',
        },
      ],
    },
  ];

  readonly pages = [
    {
      icon: '🏠',
      name: 'Dashboard',
      detail:
        'Stats cards, live throughput chart, before/after comparator, health probes, architecture map with 22 services, start/stop Docker containers',
    },
    {
      icon: '👤',
      name: 'Customers',
      detail:
        'Full CRUD with search, sort, pagination, API versioning (v1/v2), import/export CSV/JSON, batch operations, per-customer tabs (Bio, Todos, Enrich)',
    },
    {
      icon: '🧪',
      name: 'Diagnostic',
      detail:
        '7 interactive scenarios: API versioning, idempotency, rate limiting, Kafka enrich, virtual threads, version diff, stress test',
    },
    {
      icon: '🔍',
      name: 'Telemetry',
      detail:
        'Traces (Zipkin), Logs (Loki/LogQL), Latency histogram, Live feed — all with traffic generation buttons',
    },
    {
      icon: '📊',
      name: 'Metrics',
      detail:
        '78 configurable Prometheus metric cards (Golden Signals), 55 JVM gauges, Sankey flow, Waterfall, Error timeline, Kafka lag, Slow queries, Bundle analysis',
    },
    {
      icon: '🛠️',
      name: 'API Client',
      detail:
        'Postman-like HTTP client with 13 presets, method selector, headers/body editor, response viewer, history',
    },
    {
      icon: '💥',
      name: 'Chaos',
      detail:
        '8 chaos actions (rate limit, Kafka timeout, circuit breaker, payload flood, concurrent writes, traffic gen, faker), impact monitor with live charts',
    },
    {
      icon: '🐘',
      name: 'Database',
      detail:
        '27 SQL presets in 5 categories: Customer Data, PG Diagnostics, Schema & Flyway, Production Investigation, Performance Optimization — via pgweb REST API',
    },
    {
      icon: '⚙️',
      name: 'Settings',
      detail:
        'Actuator endpoint explorer (Health, Info, Env, Beans, Metrics, Loggers, Prometheus), live logger level changes',
    },
    {
      icon: '📋',
      name: 'Activity',
      detail:
        'Session event timeline with 7 event types, type-based filtering, quick action buttons to generate all event types',
    },
  ];

  readonly shortcuts = [
    { keys: 'Ctrl+K', action: 'Open global search' },
    { keys: '?', action: 'Show keyboard shortcuts' },
    { keys: 'G → D', action: 'Go to Dashboard' },
    { keys: 'G → C', action: 'Go to Customers' },
    { keys: 'G → T', action: 'Go to Diagnostic' },
    { keys: 'G → S', action: 'Go to Settings' },
    { keys: 'G → A', action: 'Go to Activity' },
    { keys: 'R', action: 'Refresh current page' },
    { keys: 'D', action: 'Toggle dark/light mode' },
    { keys: 'Escape', action: 'Close modal / search' },
  ];

  readonly quickStart = `# Start everything (backend + frontend)
./run.sh all

# Or start individually:
cd ../workspace-modern/customer-service
docker compose up -d                                    # Infrastructure
docker compose -f docker-compose.observability.yml up -d  # Observability
./run.sh app-profiled                                   # Backend with Pyroscope

cd ../customer-observability-ui
npm install && npm start                                # Frontend on :4200

# Sign in: admin / admin

# Get a JWT token via curl
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

# Create a customer
curl -s -X POST http://localhost:8080/customers \\
  -H "Authorization: Bearer \${TOKEN}" \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Alice","email":"alice@example.com"}'

# Generate traffic for dashboards
./run.sh simulate`;

  portsByCategory(cat: string) {
    return this.portMap.filter((p) => p.category === cat);
  }
}
