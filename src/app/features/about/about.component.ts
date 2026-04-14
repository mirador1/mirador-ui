import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly activeTab = signal<
    | 'overview'
    | 'pages'
    | 'stack'
    | 'infra'
    | 'tech'
    | 'compat'
    | 'obs-arch'
    | 'resilience'
    | 'security-arch'
    | 'messaging'
    | 'data'
    | 'testing'
  >('overview');

  readonly tabs = [
    { id: 'overview', label: '📖 Overview' },
    { id: 'pages', label: '🗂️ Pages' },
    { id: 'stack', label: '🔧 Stack' },
    { id: 'infra', label: '🏗️ Infrastructure' },
    { id: 'tech', label: '📚 Technologies' },
    { id: 'compat', label: '🔀 Compatibility' },
    { id: 'obs-arch', label: '🔭 Observability' },
    { id: 'resilience', label: '🛡️ Resilience' },
    { id: 'security-arch', label: '🔐 Security' },
    { id: 'messaging', label: '📨 Messaging' },
    { id: 'data', label: '🗄️ Data Layer' },
    { id: 'testing', label: '🧪 Testing' },
  ] as const;

  readonly technologies: Array<{ name: string; url: string; description: string; usage: string }> =
    [
      {
        name: 'AKHQ',
        url: 'https://akhq.io',
        description:
          'Advanced Kafka management UI with live tail, consumer lag, schema registry, and ACL management.',
        usage:
          'Pre-configured to connect to the local Kafka broker. The About page lists it on port 8083. Used to inspect topics, consumer groups, and replay messages during debugging.',
      },
      {
        name: 'Angular 21',
        url: 'https://angular.dev',
        description:
          'Frontend framework for building single-page applications. Uses standalone components, signals-based reactivity, and zoneless change detection.',
        usage:
          'The entire UI is an Angular 21 SPA. No NgModules — all components are standalone. Zoneless mode (no Zone.js) means change detection is triggered explicitly via signals and `markForCheck()`.',
      },
      {
        name: 'Apache Kafka',
        url: 'https://kafka.apache.org',
        description: 'Distributed event streaming platform running in KRaft mode (no ZooKeeper).',
        usage:
          'Two messaging patterns: async events on `customer.created` topic (fire-and-forget after customer creation), and synchronous request-reply enrichment via `customer.request` / `customer.reply` topics with a 5-second timeout returning 504 on expiry.',
      },
      {
        name: 'Bucket4j',
        url: 'https://bucket4j.com',
        description: 'Java rate-limiting library based on the token-bucket algorithm.',
        usage:
          'Applied as a Spring interceptor: 100 requests per minute per IP address. Excess requests return HTTP 429 with a `Retry-After` header and the remaining wait time. Demonstrable in the Diagnostic and Chaos pages.',
      },
      {
        name: 'Docker Compose',
        url: 'https://docs.docker.com/compose',
        description: 'Tool for defining and running multi-container Docker applications.',
        usage:
          'Two compose files: `docker-compose.yml` (PostgreSQL, Redis, Kafka, Ollama, Keycloak, admin tools) and `docker-compose.observability.yml` (Grafana, Prometheus, Zipkin, Jaeger, Pyroscope, LGTM, Nginx proxies). The Dashboard Architecture view shows live status of all 22 containers.',
      },
      {
        name: 'docker-socket-proxy',
        url: 'https://github.com/Tecnativa/docker-socket-proxy',
        description:
          'Tecnativa proxy that exposes a filtered, read-only subset of the Docker Engine API over TCP.',
        usage:
          'Mounted on port 2375. Allows the Angular frontend (via a Nginx CORS proxy) to query container status, start/stop containers, and display the Architecture map without exposing the full Docker socket.',
      },
      {
        name: 'Flyway',
        url: 'https://flywaydb.org',
        description: 'Database schema migration tool for Java applications.',
        usage:
          'All PostgreSQL schema changes are versioned as `V{n}__description.sql` migration files. Flyway runs automatically on Spring Boot startup and is visible in the Database page under the "Schema & Flyway" preset category.',
      },
      {
        name: 'Grafana',
        url: 'https://grafana.com',
        description:
          'Open-source analytics and monitoring platform with pre-built and custom dashboards.',
        usage:
          'Two Grafana instances: port 3000 (standalone, Prometheus datasource) with pre-provisioned HTTP throughput/latency/JVM dashboards, and port 3001 (inside the LGTM container) with Tempo traces, Loki logs, and Prometheus metrics for full correlation.',
      },
      {
        name: 'HikariCP',
        url: 'https://github.com/brettwooldridge/HikariCP',
        description: 'High-performance JDBC connection pool for Java.',
        usage:
          'Default connection pool used by Spring Data JPA. Pool metrics (active connections, pending threads, pool size, timeouts) are exposed as Prometheus metrics and visible in the Metrics page under the JVM gauges section.',
      },
      {
        name: 'Jaeger',
        url: 'https://www.jaegertracing.io',
        description:
          'Distributed tracing backend with advanced analysis features: trace comparison, critical path, flamegraph, dependency graph.',
        usage:
          'Receives traces via OTLP from the LGTM collector on port 16686. Used in the Observability page Traces tab alongside Zipkin. Particularly useful for comparing two traces side-by-side or visualising the critical path of slow requests.',
      },
      {
        name: 'Java 25',
        url: 'https://openjdk.org',
        description:
          'Latest LTS-track JVM release with virtual threads (Project Loom), pattern matching, records, and sealed classes.',
        usage:
          'The Spring Boot backend runs on Java 25 with `spring.threads.virtual.enabled=true`. Virtual threads mean each HTTP request runs on a lightweight virtual thread instead of a platform thread, enabling high concurrency without thread pool tuning.',
      },
      {
        name: 'JWT (JSON Web Tokens)',
        url: 'https://jwt.io',
        description: 'Compact, self-contained tokens for stateless authentication.',
        usage:
          'Issued by `POST /auth/login` and by Keycloak (OAuth2). The Angular frontend stores the access token and refresh token, attaches `Authorization: Bearer <token>` to every API call via the auth interceptor, and silently refreshes on 401.',
      },
      {
        name: 'Kafka UI',
        url: 'https://github.com/kafbat/kafka-ui',
        description: 'Web UI for browsing Kafka topics, messages, and consumer groups.',
        usage:
          'Pre-configured on port 9080. Listed in the About Infrastructure tab and Dashboard Architecture view. Lighter alternative to AKHQ for quick topic inspection.',
      },
      {
        name: 'Keycloak 26',
        url: 'https://www.keycloak.org',
        description: 'Open-source Identity and Access Management (IAM) with OAuth2/OIDC support.',
        usage:
          'Optional SSO provider on port 9090. The Spring Boot backend is configured to accept both local JWT tokens and Keycloak-issued OIDC tokens. A realm and client are pre-configured. The login page supports both paths.',
      },
      {
        name: 'Lefthook',
        url: 'https://github.com/evilmartians/lefthook',
        description: 'Fast Git hooks manager written in Go.',
        usage:
          'Configured with a `pre-push` hook that runs the unit test suite (`mvn test`) before every `git push`. Prevents pushing code that breaks tests. Also runs Prettier formatting check.',
      },
      {
        name: 'Lettuce',
        url: 'https://lettuce.io',
        description:
          'Non-blocking, reactive Redis client for Java, used internally by Spring Data Redis.',
        usage:
          'All Redis operations (idempotency key reads/writes, ring buffer LPUSH/LTRIM, Bucket4j counter increments) go through Lettuce. Its connection pool and operation metrics are exposed via Micrometer and visible in the Metrics page.',
      },
      {
        name: 'Loki',
        url: 'https://grafana.com/oss/loki',
        description:
          'Horizontally-scalable log aggregation system by Grafana Labs, queryable with LogQL.',
        usage:
          'Runs inside the LGTM container. Spring Boot sends logs via the `opentelemetry-logback-appender` → OTLP → LGTM collector → Loki. The Observability Logs tab queries Loki directly via a Nginx CORS proxy on port 3100 using LogQL. Each log line carries the `traceId` for Grafana trace-to-log correlation.',
      },
      {
        name: 'Micrometer',
        url: 'https://micrometer.io',
        description: 'Instrumentation facade for JVM applications, vendor-neutral metrics API.',
        usage:
          'Every Spring Boot component is auto-instrumented: HTTP request histograms, JVM memory/GC/threads, HikariCP pool, Lettuce Redis, Kafka producer/consumer timing, Spring Security filter chain, Spring Data repository invocations. The backend exposes 180+ metrics at `/actuator/prometheus`. The Angular UI parses this raw text format to power 78 metric cards and 55 gauges.',
      },
      {
        name: 'Nginx',
        url: 'https://nginx.org',
        description: 'High-performance web server and reverse proxy.',
        usage:
          'Two Nginx CORS proxy instances: one forwards requests to Loki (port 3100) adding `Access-Control-Allow-Origin: *` headers so the Angular app can call Loki directly; another forwards to the docker-socket-proxy (port 2375) for container management from the browser.',
      },
      {
        name: 'Ollama',
        url: 'https://ollama.com',
        description: 'Tool for running large language models (LLMs) locally.',
        usage:
          'Runs the `llama3.2` model on port 11434. The `GET /customers/{id}/bio` endpoint calls Ollama via Spring AI to generate an AI-written customer biography. Protected by a Resilience4j circuit breaker that opens after 10 failures in 60 seconds.',
      },
      {
        name: 'OpenTelemetry',
        url: 'https://opentelemetry.io',
        description: 'Vendor-neutral observability framework for traces, metrics, and logs.',
        usage:
          'Spring Boot exports traces and logs via OTLP to the LGTM collector on port 4318. Kafka observation is enabled so traceIds propagate through message headers across producer → broker → consumer → reply. The `opentelemetry-logback-appender` bridges Logback logs into the OTel pipeline.',
      },
      {
        name: 'pgAdmin',
        url: 'https://www.pgadmin.org',
        description: 'Full-featured PostgreSQL administration UI.',
        usage:
          'Pre-configured in desktop mode (no login) on port 5050. Auto-connects to the local PostgreSQL instance. Used for schema browsing, SQL execution, ERD visualisation, and backup.',
      },
      {
        name: 'pgweb',
        url: 'https://sosedoff.github.io/pgweb',
        description: 'Lightweight, read-only web-based PostgreSQL client with a REST API.',
        usage:
          "Runs on port 8081. The Angular Database page uses pgweb's REST API (`/api/query`) to execute the 27 SQL presets directly from the browser without any backend involvement.",
      },
      {
        name: 'PostgreSQL 17',
        url: 'https://www.postgresql.org',
        description: 'Advanced open-source relational database.',
        usage:
          'Primary data store for customer records. Managed by Spring Data JPA with Hibernate. Schema versioned by Flyway. The `shedlock` table is also stored here for distributed scheduler locking. Exposed on port 5432.',
      },
      {
        name: 'Prettier',
        url: 'https://prettier.io',
        description: 'Opinionated code formatter for TypeScript, HTML, SCSS, and JSON.',
        usage:
          'Enforced via Lefthook pre-push hooks and the GitLab CI pipeline. All Angular source files are formatted to a consistent style. Run manually with `npx prettier --write "src/**/*.{ts,html,scss,json}"`.',
      },
      {
        name: 'Prometheus',
        url: 'https://prometheus.io',
        description: 'Time-series metrics database with PromQL query language.',
        usage:
          'Scrapes `/actuator/prometheus` every 15 seconds. Stores 180+ metrics. Powers the Grafana dashboards on port 3000. Also queried directly by the Angular Metrics page and Observability Latency tab to parse the raw text exposition format.',
      },
      {
        name: 'Pyroscope',
        url: 'https://grafana.com/oss/pyroscope',
        description:
          'Continuous profiling platform for CPU, memory allocation, and lock contention.',
        usage:
          'The Spring Boot app is started with the Pyroscope Java agent (itimer + alloc + lock profiling events) via `./run.sh app-profiled`. Flamegraphs are accessible on port 4040. Visible in the About page infrastructure tab.',
      },
      {
        name: 'Redis 7',
        url: 'https://redis.io',
        description: 'In-memory data structure store used as cache, message broker, and database.',
        usage:
          'Three concurrent uses: (1) idempotency key storage with TTL — `Idempotency-Key` header value stored with a 24h expiry to prevent duplicate mutations; (2) RecentCustomerBuffer — a ring buffer of the last 10 created customer IDs via `LPUSH`/`LTRIM`; (3) Bucket4j rate-limit counters per IP.',
      },
      {
        name: 'Redis Commander',
        url: 'https://github.com/joeferner/redis-commander',
        description: 'Redis web GUI with live command monitor.',
        usage:
          'Runs on port 8082. Auto-connects to the local Redis instance. Useful for watching real-time Redis commands during idempotency or rate-limit demonstrations.',
      },
      {
        name: 'RedisInsight',
        url: 'https://redis.io/insight',
        description:
          'Official Redis desktop/web client with key browser, memory analysis, and CLI.',
        usage:
          'Runs on port 5540. Pre-configured to connect to the local Redis instance. Used to inspect idempotency keys, ring buffer contents, and rate-limit counters stored as hashes.',
      },
      {
        name: 'Resilience4j',
        url: 'https://resilience4j.readme.io',
        description:
          'Lightweight fault-tolerance library for Java with circuit breaker, retry, bulkhead, and rate limiter patterns.',
        usage:
          'Circuit breaker on the Ollama `/bio` call: trips after 10 failures in 60 seconds, stays open for 30 seconds before probing. Retry on external JSONPlaceholder API calls (3 attempts, exponential backoff). Both are visible and triggerable in the Diagnostic page.',
      },
      {
        name: 'SCSS',
        url: 'https://sass-lang.com',
        description: 'CSS preprocessor adding variables, nesting, mixins, and functions.',
        usage:
          'All Angular component styles are written in SCSS. CSS custom properties (`var(--color-accent)`, `var(--bg-card)`) power the dark/light theme switching. No CSS-in-JS, no utility-class framework.',
      },
      {
        name: 'ShedLock',
        url: 'https://github.com/lukas-krecan/ShedLock',
        description: 'Distributed lock library for Spring `@Scheduled` jobs.',
        usage:
          'Uses a `shedlock` table in PostgreSQL to ensure that scheduled tasks run on exactly one node in a multi-instance deployment. Configured with `@EnableSchedulerLock`. Visible in the Settings page under Scheduled Jobs.',
      },
      {
        name: 'Spring AI',
        url: 'https://spring.io/projects/spring-ai',
        description: 'Spring integration for AI/ML models and vector stores.',
        usage:
          'Used to call the locally-running Ollama `llama3.2` model for the `GET /customers/{id}/bio` endpoint. The ChatClient is configured with a prompt template and wrapped in a Resilience4j circuit breaker.',
      },
      {
        name: 'Spring Boot 4',
        url: 'https://spring.io/projects/spring-boot',
        description:
          'Convention-over-configuration framework for production-ready Java applications.',
        usage:
          'The entire backend is a Spring Boot 4 application. Auto-configuration provides the embedded Tomcat server, Jackson JSON binding, Spring Security, Spring Data JPA, Spring Kafka, Spring Data Redis, Micrometer metrics, and Actuator endpoints out of the box.',
      },
      {
        name: 'Spring Data JPA',
        url: 'https://spring.io/projects/spring-data-jpa',
        description: 'Spring abstraction over JPA/Hibernate for repository-based data access.',
        usage:
          'All customer CRUD operations use `JpaRepository<Customer, Long>` with JPQL queries. Custom specifications for dynamic search/filter. Micrometer auto-instruments all repository method calls with timing metrics.',
      },
      {
        name: 'Spring Security',
        url: 'https://spring.io/projects/spring-security',
        description:
          'Security framework for authentication, authorisation, and protection against common exploits.',
        usage:
          'Configured with JWT filter chain: every request is validated against the local JWT secret or Keycloak public key. `@PreAuthorize` annotations restrict endpoints by role. Login attempt throttling tracks failed attempts per username. The Security Demo page deliberately bypasses security on its vulnerable endpoints.',
      },
      {
        name: 'Tempo',
        url: 'https://grafana.com/oss/tempo',
        description:
          "Grafana's scalable distributed tracing backend optimised for storage and query of trace data.",
        usage:
          'Runs inside the LGTM container. Receives traces from the OTLP collector alongside Jaeger. Queried by the Grafana instance on port 3001. Enables trace-to-log correlation: clicking a traceId in the Loki logs panel jumps to the corresponding Tempo trace.',
      },
      {
        name: 'TypeScript 5.9',
        url: 'https://www.typescriptlang.org',
        description: 'Strongly-typed superset of JavaScript that compiles to plain JS.',
        usage:
          'All Angular components, services, interceptors, and utilities are written in strict TypeScript. No `any` types in production code (except for Angular forms and dynamic HTTP responses). Compile-time type checking catches API contract mismatches before runtime.',
      },
      {
        name: 'Vitest',
        url: 'https://vitest.dev',
        description: 'Fast Vite-native unit testing framework compatible with the Jest API.',
        usage:
          'Replaces Karma+Jasmine for Angular unit tests. Runs with a jsdom environment. Tests cover services, pipes, and pure functions. Executed by `./run.sh test` and the GitLab CI pipeline. No `fakeAsync`/`tick` — async is handled with real Promises and `vi.useFakeTimers()`.',
      },
      {
        name: 'Zipkin',
        url: 'https://zipkin.io',
        description:
          'Distributed tracing system with a lightweight web UI for visualising request flows.',
        usage:
          'Receives traces via its native HTTP protocol. Accessible on port 9411. Queried by the Angular Observability Traces tab to display span waterfalls and flamegraphs. Lighter-weight alternative to Jaeger for quick per-request inspection.',
      },
    ];
  readonly portMap: Array<{
    port: number;
    name: string;
    category: string;
    note: string;
    url?: string;
  }> = [
    // Application
    {
      port: 8080,
      name: 'Customer API',
      category: 'App',
      note: 'REST API + WebSocket + Swagger UI',
      url: 'http://localhost:8080/swagger-ui.html',
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
    {
      port: 11434,
      name: 'Ollama',
      category: 'Data',
      note: 'Local LLM (llama3.2) for /bio',
      url: 'http://localhost:11434',
    },
    {
      port: 9090,
      name: 'Keycloak',
      category: 'Data',
      note: 'OAuth2/OIDC — admin / admin',
      url: 'http://localhost:9090',
    },
    // Admin Tools
    {
      port: 5050,
      name: 'pgAdmin',
      category: 'Admin',
      note: 'PostgreSQL UI (desktop mode, no login)',
      url: 'http://localhost:5050',
    },
    {
      port: 8081,
      name: 'pgweb',
      category: 'Admin',
      note: 'Lightweight SQL client + REST API',
      url: 'http://localhost:8081',
    },
    {
      port: 9080,
      name: 'Kafka UI',
      category: 'Admin',
      note: 'Topics, messages, consumer groups',
      url: 'http://localhost:9080',
    },
    {
      port: 5540,
      name: 'RedisInsight',
      category: 'Admin',
      note: 'Redis key browser, memory analysis',
      url: 'http://localhost:5540',
    },
    {
      port: 8082,
      name: 'Redis Commander',
      category: 'Admin',
      note: 'Live command monitor, auto-connects',
      url: 'http://localhost:8082',
    },
    {
      port: 8083,
      name: 'AKHQ',
      category: 'Admin',
      note: 'Advanced Kafka UI — live tail, ACLs',
      url: 'http://localhost:8083',
    },
    // Observability
    {
      port: 3000,
      name: 'Grafana',
      category: 'Obs',
      note: 'Pre-provisioned dashboards (no login)',
      url: 'http://localhost:3000',
    },
    {
      port: 3001,
      name: 'Grafana (LGTM)',
      category: 'Obs',
      note: 'OTel traces, Loki logs, Tempo',
      url: 'http://localhost:3001',
    },
    {
      port: 9091,
      name: 'Prometheus',
      category: 'Obs',
      note: 'Metrics store (9090 used by Keycloak)',
      url: 'http://localhost:9091',
    },
    {
      port: 9411,
      name: 'Zipkin',
      category: 'Obs',
      note: 'Distributed tracing (lightweight UI)',
      url: 'http://localhost:9411',
    },
    {
      port: 16686,
      name: 'Jaeger',
      category: 'Obs',
      note: 'Advanced tracing — comparison, flamegraph',
      url: 'http://localhost:16686',
    },
    {
      port: 4040,
      name: 'Pyroscope',
      category: 'Obs',
      note: 'Continuous profiling — CPU, memory',
      url: 'http://localhost:4040',
    },
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

  readonly stack: Array<{
    category: string;
    items: Array<{ icon: string; name: string; detail: string; url?: string }>;
  }> = [
    {
      category: 'Frontend',
      items: [
        {
          icon: '🅰️',
          name: 'Angular 21',
          detail: 'Standalone components, zoneless change detection, signals-based state',
          url: 'https://angular.dev',
        },
        {
          icon: '📘',
          name: 'TypeScript 5.9',
          detail: 'Strict mode, no external state library',
          url: 'https://www.typescriptlang.org',
        },
        {
          icon: '🎨',
          name: 'SCSS',
          detail: 'CSS custom properties for dark/light theming',
          url: 'https://sass-lang.com',
        },
        {
          icon: '📊',
          name: 'Raw SVG',
          detail: 'All charts and visualizations — no charting library',
          url: 'https://developer.mozilla.org/en-US/docs/Web/SVG',
        },
        {
          icon: '🧪',
          name: 'Vitest',
          detail: 'Unit tests with jsdom environment',
          url: 'https://vitest.dev',
        },
      ],
    },
    {
      category: 'Backend',
      items: [
        {
          icon: '🍃',
          name: 'Spring Boot 4',
          detail: 'Java 25, virtual threads, pattern matching',
          url: 'https://spring.io/projects/spring-boot',
        },
        {
          icon: '🐘',
          name: 'PostgreSQL 17',
          detail: 'Primary database, Flyway migrations, Spring Data JPA',
          url: 'https://www.postgresql.org',
        },
        {
          icon: '🗄️',
          name: 'Redis 7',
          detail: 'Distributed caching, idempotency keys, ring buffer',
          url: 'https://redis.io',
        },
        {
          icon: '📨',
          name: 'Apache Kafka',
          detail: 'KRaft mode, async events, request-reply enrich pattern',
          url: 'https://kafka.apache.org',
        },
        {
          icon: '🧠',
          name: 'Ollama',
          detail: 'Local LLM (llama3.2) for bio generation via Spring AI',
          url: 'https://ollama.com',
        },
        {
          icon: '🔐',
          name: 'Keycloak 26',
          detail: 'OAuth2/OIDC identity provider (optional)',
          url: 'https://www.keycloak.org',
        },
      ],
    },
    {
      category: 'Resilience',
      items: [
        {
          icon: '⚡',
          name: 'Resilience4j',
          detail: 'Circuit breaker on Ollama /bio, retry on external APIs',
          url: 'https://resilience4j.readme.io',
        },
        {
          icon: '🚦',
          name: 'Bucket4j',
          detail: 'Rate limiting — 100 req/min per IP',
          url: 'https://bucket4j.com',
        },
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
          url: 'https://prometheus.io',
        },
        {
          icon: '📊',
          name: 'Grafana',
          detail: 'Dashboards — HTTP throughput, latency, JVM, pre-provisioned',
          url: 'https://grafana.com',
        },
        {
          icon: '🔗',
          name: 'Zipkin',
          detail: 'Distributed tracing — span waterfall, service map',
          url: 'https://zipkin.io',
        },
        {
          icon: '🔭',
          name: 'Jaeger',
          detail: 'Advanced tracing — trace comparison, dependency graph, critical path',
          url: 'https://www.jaegertracing.io',
        },
        {
          icon: '🔍',
          name: 'Loki (LGTM)',
          detail: 'Log aggregation via OpenTelemetry Logback appender',
          url: 'https://grafana.com/oss/loki',
        },
        {
          icon: '🧬',
          name: 'Pyroscope',
          detail: 'Continuous profiling — CPU, memory, lock flamegraphs',
          url: 'https://grafana.com/oss/pyroscope',
        },
        {
          icon: '📈',
          name: 'Micrometer',
          detail: '180+ metrics: HTTP histograms, JVM, HikariCP, Kafka, Redis, custom',
          url: 'https://micrometer.io',
        },
      ],
    },
    {
      category: 'Admin Tools',
      items: [
        {
          icon: '🛢️',
          name: 'pgAdmin',
          detail: 'PostgreSQL web admin — schemas, SQL, ERD, backup',
          url: 'https://www.pgadmin.org',
        },
        {
          icon: '🔬',
          name: 'pgweb',
          detail: 'Lightweight SQL client with REST API (read-only)',
          url: 'https://sosedoff.github.io/pgweb',
        },
        {
          icon: '🔎',
          name: 'RedisInsight',
          detail: 'Redis key browser, memory analysis, CLI',
          url: 'https://redis.io/insight',
        },
        {
          icon: '📟',
          name: 'Redis Commander',
          detail: 'Redis live command monitor, auto-connects',
          url: 'https://github.com/joeferner/redis-commander',
        },
        {
          icon: '📋',
          name: 'Kafka UI',
          detail: 'Topics, messages, consumer groups browser',
          url: 'https://github.com/kafbat/kafka-ui',
        },
        {
          icon: '🔬',
          name: 'AKHQ',
          detail: 'Advanced Kafka UI — live tail, schema registry, ACLs',
          url: 'https://akhq.io',
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
          url: 'https://docs.docker.com/compose',
        },
        {
          icon: '🔒',
          name: 'docker-socket-proxy',
          detail: 'Filtered Docker API for the frontend (containers only)',
          url: 'https://github.com/Tecnativa/docker-socket-proxy',
        },
        {
          icon: '🌐',
          name: 'Nginx CORS proxy',
          detail: 'Adds CORS headers for Loki and Docker API',
          url: 'https://nginx.org',
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
