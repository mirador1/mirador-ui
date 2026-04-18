import { Component, signal } from '@angular/core';

/**
 * AboutComponent — Architecture documentation shell.
 *
 * Phase 2 of the About-page trim (ADR-0008 industrial pass): the template
 * used to inline ~2 900 lines of prose across 14 tabs. All prose now lives
 * in versioned Markdown under `docs/architecture/*.md`, rendered by GitLab.
 * The component keeps what is genuinely interactive:
 *   - 'overview' — hero SVG + tech-badges banner + link to overview.md
 *   - 'infra'    — port map + run.sh quick-start + external services grid
 *   - 'tech'     — sortable list of 207 technologies (driven by `technologies`)
 * Every other tab is a compact "doc pane" that links out to its Markdown
 * counterpart on GitLab. No HTTP calls, no runtime data fetching.
 */
@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  /** Signal: currently active documentation tab. Defaults to overview. */
  readonly activeTab = signal<
    | 'overview'
    | 'infra'
    | 'deploy'
    | 'deploy-docker'
    | 'deploy-k8s'
    | 'deploy-gcp'
    | 'tech'
    | 'compat'
    | 'obs-arch'
    | 'resilience'
    | 'security-arch'
    | 'messaging'
    | 'data'
    | 'testing'
  >('overview');

  /** Tab definitions rendered as the nav pill row. The `id` must match `activeTab` values. */
  readonly tabs = [
    { id: 'overview', label: '📖 Overview' },
    { id: 'infra', label: '🏗️ Infrastructure' },
    { id: 'deploy', label: '🚀 Deployment' },
    { id: 'deploy-docker', label: '🐳 Docker' },
    { id: 'deploy-k8s', label: '☸️ Kubernetes local' },
    { id: 'deploy-gcp', label: '☁️ Google Cloud' },
    { id: 'tech', label: '📚 Technologies' },
    { id: 'compat', label: '🔀 Compatibility' },
    { id: 'obs-arch', label: '🔭 Observability' },
    { id: 'resilience', label: '🛡️ Resilience' },
    { id: 'security-arch', label: '🔐 Security' },
    { id: 'messaging', label: '📨 Messaging' },
    { id: 'data', label: '🗄️ Data Layer' },
    { id: 'testing', label: '🧪 Testing' },
  ] as const;

  readonly technologies: Array<{
    name: string;
    url: string;
    description: string;
    usage: string;
    icon: string;
  }> = [
    {
      name: 'Angular 21',
      icon: '🅰️',
      url: 'https://angular.dev',
      description:
        'Frontend framework for building single-page applications. Uses standalone components, signals-based reactivity, and zoneless change detection.',
      usage:
        'The entire UI is an Angular 21 SPA. No NgModules — all components are standalone. Zoneless mode (no Zone.js) means change detection is triggered explicitly via signals and `markForCheck()`.',
    },
    {
      name: 'Apache Kafka',
      icon: '📨',
      url: 'https://kafka.apache.org',
      description: 'Distributed event streaming platform running in KRaft mode (no ZooKeeper).',
      usage:
        'Two messaging patterns: async events on `customer.created` topic (fire-and-forget after customer creation), and synchronous request-reply enrichment via `customer.request` / `customer.reply` topics with a 5-second timeout returning 504 on expiry.',
    },
    {
      name: 'Bucket4j',
      icon: '🪣',
      url: 'https://bucket4j.com',
      description: 'Java rate-limiting library based on the token-bucket algorithm.',
      usage:
        'Applied as a Spring interceptor: 100 requests per minute per IP address. Excess requests return HTTP 429 with a `Retry-After` header and the remaining wait time. Demonstrable in the Diagnostic and Chaos pages.',
    },
    {
      name: 'Docker Compose',
      icon: '🐳',
      url: 'https://docs.docker.com/compose',
      description: 'Tool for defining and running multi-container Docker applications.',
      usage:
        'Two compose files: `docker-compose.yml` (PostgreSQL, Redis, Kafka, Ollama, Keycloak, admin tools) and `docker-compose.observability.yml` (Grafana, Prometheus, Pyroscope, LGTM all-in-one with Tempo+Loki, Nginx proxies). The Dashboard Architecture view shows live status of all containers.',
    },
    {
      name: 'GitLab Runner',
      icon: '🏃',
      url: 'https://docs.gitlab.com/runner/',
      description: 'Open-source agent that picks up GitLab CI jobs and executes them locally.',
      usage:
        'Runs via `docker-compose.runner.yml`. Connects to gitlab.com with outbound HTTPS long-polling — no port needs to be opened. Register with `./run.sh register-cloud <TOKEN>` (token from gitlab.com → Project → Settings → CI/CD → Runners). Every push runs the full pipeline on this machine, consuming zero shared-runner minutes. Concurrency is auto-configured to (nproc - 1).',
    },
    {
      name: 'docker-socket-proxy',
      icon: '🔌',
      url: 'https://github.com/Tecnativa/docker-socket-proxy',
      description:
        'Tecnativa proxy that exposes a filtered, read-only subset of the Docker Engine API over TCP.',
      usage:
        'Mounted on port 2375. Allows the Angular frontend (via a Nginx CORS proxy) to query container status, start/stop containers, and display the Architecture map without exposing the full Docker socket.',
    },
    {
      name: 'Flyway',
      icon: '🦋',
      url: 'https://flywaydb.org',
      description: 'Database schema migration tool for Java applications.',
      usage:
        'All PostgreSQL schema changes are versioned as `V{n}__description.sql` migration files. Flyway runs automatically on Spring Boot startup and is visible in the Database page under the "Schema & Flyway" preset category.',
    },
    {
      name: 'Grafana',
      icon: '📊',
      url: 'https://grafana.com',
      description:
        'Open-source analytics and monitoring platform with pre-built and custom dashboards.',
      usage:
        'Grafana LGTM all-in-one on port 3000 (inside the otel-lgtm container). Bundles Tempo (traces), Loki (logs), and Mimir (metrics) with pre-provisioned dashboards for full correlation — click a metric spike to jump to the matching trace, click a trace to jump to its logs.',
    },
    {
      name: 'HikariCP',
      icon: '🏊',
      url: 'https://github.com/brettwooldridge/HikariCP',
      description: 'High-performance JDBC connection pool for Java.',
      usage:
        'Default connection pool used by Spring Data JPA. Pool metrics (active connections, pending threads, pool size, timeouts) are exposed as Prometheus metrics and visible in the Metrics page under the JVM gauges section.',
    },
    {
      name: 'Hibernate 6',
      icon: '🔶',
      url: 'https://hibernate.org/orm',
      description: 'ORM framework and JPA provider for Java — maps objects to relational tables.',
      usage:
        'Used under Spring Data JPA as the JPA provider. Handles entity lifecycle, lazy/eager loading, JPQL query execution. Spring Boot 4 ships with Hibernate 6.x which requires the Jakarta EE 10 namespace (`jakarta.*` instead of `javax.*`).',
    },
    {
      name: 'Jackson 3',
      icon: '🔄',
      url: 'https://github.com/FasterXML/jackson',
      description:
        'High-performance JSON processor for Java — serialisation, deserialisation, data binding.',
      usage:
        'Spring Boot 4 ships with Jackson 3 (Jakarta namespace). All REST request/response bodies are bound via `@RequestBody` / `@ResponseBody`. Custom serialisers handle `Page<T>` wrappers and API versioning (v1/v2 field projection). Tests use `JsonMapper.builder()` instead of the deprecated `ObjectMapper` constructor.',
    },
    {
      name: 'Java 25',
      icon: '☕',
      url: 'https://openjdk.org',
      description:
        'Latest LTS-track JVM release with virtual threads (Project Loom), pattern matching, records, and sealed classes.',
      usage:
        'The Spring Boot backend runs on Java 25 with `spring.threads.virtual.enabled=true`. Virtual threads mean each HTTP request runs on a lightweight virtual thread instead of a platform thread, enabling high concurrency without thread pool tuning.',
    },
    {
      name: 'JWT (JSON Web Tokens)',
      icon: '🔑',
      url: 'https://jwt.io',
      description: 'Compact, self-contained tokens for stateless authentication.',
      usage:
        'Issued by `POST /auth/login` and by Keycloak (OAuth2). The Angular frontend stores the access token and refresh token, attaches `Authorization: Bearer <token>` to every API call via the auth interceptor, and silently refreshes on 401.',
    },
    {
      name: 'Kafka UI',
      icon: '🔷',
      url: 'https://github.com/kafbat/kafka-ui',
      description: 'Web UI for browsing Kafka topics, messages, and consumer groups.',
      usage:
        'Pre-configured on port 9080. Listed in the About Infrastructure tab and Dashboard Architecture view. Supports topic inspection, consumer lag monitoring, message browsing, and live tail.',
    },
    {
      name: 'Keycloak 26',
      icon: '🔐',
      url: 'https://www.keycloak.org',
      description: 'Open-source Identity and Access Management (IAM) with OAuth2/OIDC support.',
      usage:
        'Optional SSO provider on port 9090. The Spring Boot backend is configured to accept both local JWT tokens and Keycloak-issued OIDC tokens. A realm and client are pre-configured. The login page supports both paths.',
    },
    {
      name: 'kind',
      icon: '☸️',
      url: 'https://kind.sigs.k8s.io',
      description:
        'Kubernetes IN Docker — runs a full multi-node Kubernetes cluster inside Docker containers.',
      usage:
        'Used for local Kubernetes deployment. A single-node cluster exposes the full stack on port 8090 via nginx-ingress. Helm charts deploy the Spring Boot app, Angular frontend, PostgreSQL, Redis, Kafka, and the observability stack. Manifests live in `infra/k8s/`.',
    },
    {
      name: 'Lefthook',
      icon: '🪝',
      url: 'https://github.com/evilmartians/lefthook',
      description: 'Fast Git hooks manager written in Go.',
      usage:
        'Configured with a `pre-push` hook that runs the unit test suite (`mvn test`) before every `git push`. Prevents pushing code that breaks tests. Also runs Prettier formatting check.',
    },
    {
      name: 'Lettuce',
      icon: '🔴',
      url: 'https://lettuce.io',
      description:
        'Non-blocking, reactive Redis client for Java, used internally by Spring Data Redis.',
      usage:
        'All Redis operations (idempotency key reads/writes, ring buffer LPUSH/LTRIM, Bucket4j counter increments) go through Lettuce. Its connection pool and operation metrics are exposed via Micrometer and visible in the Metrics page.',
    },
    {
      name: 'Loki',
      icon: '📝',
      url: 'https://grafana.com/oss/loki',
      description:
        'Horizontally-scalable log aggregation system by Grafana Labs, queryable with LogQL.',
      usage:
        'Runs inside the LGTM container. Spring Boot sends logs via the `opentelemetry-logback-appender` → OTLP → LGTM collector → Loki. The Observability Logs tab queries Loki directly via a Nginx CORS proxy on port 3100 using LogQL. Each log line carries the `traceId` for Grafana trace-to-log correlation.',
    },
    {
      name: 'Maven',
      icon: '📦',
      url: 'https://maven.apache.org',
      description:
        'Build automation tool for Java projects with dependency management and lifecycle phases.',
      usage:
        'Builds the Spring Boot backend. Uses multi-profile configuration: default (Spring Boot 4 + Java 25), `-Dcompat` (SB4 + Java 21), `-Dsb3` (Spring Boot 3 + Java 21), `-Dsb3 -Djava17` (SB3 + Java 17). Each profile swaps BOM versions and compiler target via properties. Lefthook and CI run `mvn verify` before push/merge.',
    },
    {
      name: 'Micrometer',
      icon: '📏',
      url: 'https://micrometer.io',
      description: 'Instrumentation facade for JVM applications, vendor-neutral metrics API.',
      usage:
        'Every Spring Boot component is auto-instrumented: HTTP request histograms, JVM memory/GC/threads, HikariCP pool, Lettuce Redis, Kafka producer/consumer timing, Spring Security filter chain, Spring Data repository invocations. The backend exposes 180+ metrics at `/actuator/prometheus`. The Angular UI parses this raw text format to power 78 metric cards and 55 gauges.',
    },
    {
      name: 'Nginx',
      icon: '🌐',
      url: 'https://nginx.org',
      description: 'High-performance web server and reverse proxy.',
      usage:
        'Two Nginx CORS proxy instances: one forwards requests to Loki (port 3100) adding `Access-Control-Allow-Origin: *` headers so the Angular app can call Loki directly; another forwards to the docker-socket-proxy (port 2375) for container management from the browser.',
    },
    {
      name: 'Ollama',
      icon: '🦙',
      url: 'https://ollama.com',
      description: 'Tool for running large language models (LLMs) locally.',
      usage:
        'Runs the `llama3.2` model on port 11434. The `GET /customers/{id}/bio` endpoint calls Ollama via Spring AI to generate an AI-written customer biography. Protected by a Resilience4j circuit breaker that opens after 10 failures in 60 seconds.',
    },
    {
      name: 'OpenTelemetry',
      icon: '📡',
      url: 'https://opentelemetry.io',
      description: 'Vendor-neutral observability framework for traces, metrics, and logs.',
      usage:
        'Spring Boot exports traces and logs via OTLP to the LGTM collector on port 4318. Kafka observation is enabled so traceIds propagate through message headers across producer → broker → consumer → reply. The `opentelemetry-logback-appender` bridges Logback logs into the OTel pipeline.',
    },
    {
      name: 'pgAdmin',
      icon: '🐘',
      url: 'https://www.pgadmin.org',
      description: 'Full-featured PostgreSQL administration UI.',
      usage:
        'Pre-configured in desktop mode (no login) on port 5050. Auto-connects to the local PostgreSQL instance. Used for schema browsing, SQL execution, ERD visualisation, and backup.',
    },
    {
      name: 'pgweb',
      icon: '🐘',
      url: 'https://sosedoff.github.io/pgweb',
      description: 'Lightweight, read-only web-based PostgreSQL client with a REST API.',
      usage:
        "Runs on port 8081. The Angular Database page uses pgweb's REST API (`/api/query`) to execute the 27 SQL presets directly from the browser without any backend involvement.",
    },
    {
      name: 'PostgreSQL 17',
      icon: '🐘',
      url: 'https://www.postgresql.org',
      description: 'Advanced open-source relational database.',
      usage:
        'Primary data store for customer records. Managed by Spring Data JPA with Hibernate. Schema versioned by Flyway. The `shedlock` table is also stored here for distributed scheduler locking. Exposed on port 5432.',
    },
    {
      name: 'Prettier',
      icon: '✨',
      url: 'https://prettier.io',
      description: 'Opinionated code formatter for TypeScript, HTML, SCSS, and JSON.',
      usage:
        'Enforced via Lefthook pre-push hooks and the GitLab CI pipeline. All Angular source files are formatted to a consistent style. Run manually with `npx prettier --write "src/**/*.{ts,html,scss,json}"`.',
    },
    {
      name: 'Mimir (via otel-lgtm)',
      icon: '🔥',
      url: 'https://grafana.com/oss/mimir',
      description: 'Scalable Prometheus-compatible metrics backend, bundled inside otel-lgtm.',
      usage:
        'The OTel Collector inside otel-lgtm scrapes `/actuator/prometheus` every 15s and stores metrics in Mimir. Prometheus-compatible query API exposed at localhost:9091. Replaces the standalone Prometheus container.',
    },
    {
      name: 'Pyroscope',
      icon: '🔬',
      url: 'https://grafana.com/oss/pyroscope',
      description: 'Continuous profiling platform for CPU, memory allocation, and lock contention.',
      usage:
        'The Spring Boot app is started with the Pyroscope Java agent (itimer + alloc + lock profiling events) via `./run.sh app-profiled`. Flamegraphs are accessible on port 4040. Visible in the About page infrastructure tab.',
    },
    {
      name: 'Redis 7',
      icon: '🔴',
      url: 'https://redis.io',
      description: 'In-memory data structure store used as cache, message broker, and database.',
      usage:
        'Three concurrent uses: (1) idempotency key storage with TTL — `Idempotency-Key` header value stored with a 24h expiry to prevent duplicate mutations; (2) RecentCustomerBuffer — a ring buffer of the last 10 created customer IDs via `LPUSH`/`LTRIM`; (3) Bucket4j rate-limit counters per IP.',
    },
    {
      name: 'Redis Commander',
      icon: '🖥️',
      url: 'https://github.com/joeferner/redis-commander',
      description: 'Redis web GUI with live command monitor.',
      usage:
        'Runs on port 8082. Auto-connects to the local Redis instance. Useful for watching real-time Redis commands during idempotency or rate-limit demonstrations.',
    },
    {
      name: 'RedisInsight',
      icon: '👁️',
      url: 'https://redis.io/insight',
      description: 'Official Redis desktop/web client with key browser, memory analysis, and CLI.',
      usage:
        'Runs on port 5540. Pre-configured to connect to the local Redis instance. Used to inspect idempotency keys, ring buffer contents, and rate-limit counters stored as hashes.',
    },
    {
      name: 'Resilience4j',
      icon: '🛡️',
      url: 'https://resilience4j.readme.io',
      description:
        'Lightweight fault-tolerance library for Java with circuit breaker, retry, bulkhead, and rate limiter patterns.',
      usage:
        'Circuit breaker on the Ollama `/bio` call: trips after 10 failures in 60 seconds, stays open for 30 seconds before probing. Retry on external JSONPlaceholder API calls (3 attempts, exponential backoff). Both are visible and triggerable in the Diagnostic page.',
    },
    {
      name: 'SCSS',
      icon: '🎨',
      url: 'https://sass-lang.com',
      description: 'CSS preprocessor adding variables, nesting, mixins, and functions.',
      usage:
        'All Angular component styles are written in SCSS. CSS custom properties (`var(--color-accent)`, `var(--bg-card)`) power the dark/light theme switching. No CSS-in-JS, no utility-class framework.',
    },
    {
      name: 'ShedLock',
      icon: '🔒',
      url: 'https://github.com/lukas-krecan/ShedLock',
      description: 'Distributed lock library for Spring `@Scheduled` jobs.',
      usage:
        'Uses a `shedlock` table in PostgreSQL to ensure that scheduled tasks run on exactly one node in a multi-instance deployment. Configured with `@EnableSchedulerLock`. Visible in the Settings page under Scheduled Jobs.',
    },
    {
      name: 'Spring AI',
      icon: '🤖',
      url: 'https://spring.io/projects/spring-ai',
      description: 'Spring integration for AI/ML models and vector stores.',
      usage:
        'Used to call the locally-running Ollama `llama3.2` model for the `GET /customers/{id}/bio` endpoint. The ChatClient is configured with a prompt template and wrapped in a Resilience4j circuit breaker.',
    },
    {
      name: 'Spring Boot 4',
      icon: '🍃',
      url: 'https://spring.io/projects/spring-boot',
      description:
        'Convention-over-configuration framework for production-ready Java applications.',
      usage:
        'The entire backend is a Spring Boot 4 application. Auto-configuration provides the embedded Tomcat server, Jackson JSON binding, Spring Security, Spring Data JPA, Spring Kafka, Spring Data Redis, Micrometer metrics, and Actuator endpoints out of the box.',
    },
    {
      name: 'Spring Data JPA',
      icon: '🗄️',
      url: 'https://spring.io/projects/spring-data-jpa',
      description: 'Spring abstraction over JPA/Hibernate for repository-based data access.',
      usage:
        'All customer CRUD operations use `JpaRepository<Customer, Long>` with JPQL queries. Custom specifications for dynamic search/filter. Micrometer auto-instruments all repository method calls with timing metrics.',
    },
    {
      name: 'Spring Data Redis',
      icon: '🔴',
      url: 'https://spring.io/projects/spring-data-redis',
      description:
        'Spring abstraction over Redis with templates, repositories, and serialisation support.',
      usage:
        'Used for three concurrent features: idempotency key storage (`StringRedisTemplate` with TTL), the recent-customers ring buffer (`LPUSH`/`LTRIM` via `RedisTemplate`), and as the storage backend for Bucket4j rate-limit counters. All operations go through the Lettuce connection pool.',
    },
    {
      name: 'Spring Kafka',
      icon: '📨',
      url: 'https://spring.io/projects/spring-kafka',
      description:
        'Spring integration for Apache Kafka — producer templates, consumer annotations, and observation.',
      usage:
        'Two messaging patterns: `@KafkaListener` on `customer.created` for async event processing, and `ReplyingKafkaTemplate` for synchronous request-reply enrichment on `customer.request` / `customer.reply` with a 5 s timeout. Kafka observation is enabled so traceIds flow through message headers for distributed tracing.',
    },
    {
      name: 'Spring Security',
      icon: '🔐',
      url: 'https://spring.io/projects/spring-security',
      description:
        'Security framework for authentication, authorisation, and protection against common exploits.',
      usage:
        'Configured with JWT filter chain: every request is validated against the local JWT secret or Keycloak public key. `@PreAuthorize` annotations restrict endpoints by role. Login attempt throttling tracks failed attempts per username. The Security Demo page deliberately bypasses security on its vulnerable endpoints.',
    },
    {
      name: 'SpringDoc OpenAPI',
      icon: '📋',
      url: 'https://springdoc.org',
      description: 'Automatic OpenAPI 3.1 documentation generation for Spring Boot REST APIs.',
      usage:
        'Generates a live OpenAPI spec at `/v3/api-docs` and the Swagger UI at `/swagger-ui.html` (port 8080). Annotations on controllers add descriptions, examples, and response schemas. The API Client page in the UI links directly to the Swagger UI.',
    },
    {
      name: 'Tempo',
      icon: '⏱️',
      url: 'https://grafana.com/oss/tempo',
      description:
        "Grafana's scalable distributed tracing backend optimised for storage and query of trace data.",
      usage:
        'Runs inside the LGTM container (Grafana on port 3000). Spring Boot sends traces via OTLP → OTel collector → Tempo. Query with TraceQL in Grafana Explore or the Angular Observability Traces tab. Tempo HTTP API exposed on port 3200. Enables trace-to-log correlation: clicking a traceId in the Loki logs panel jumps straight to the matching trace.',
    },
    {
      name: 'Testcontainers',
      icon: '🐳',
      url: 'https://testcontainers.com',
      description: 'JVM library that spins up Docker containers for integration tests.',
      usage:
        'Integration tests start real PostgreSQL, Redis, and Kafka containers via `@SpringBootTest` with Testcontainers. No mocks for infrastructure — tests run against the actual databases and brokers. Executed by `./run.sh integration` or `mvn verify -Pintegration`. Containers are destroyed after each test class.',
    },
    {
      name: 'TypeScript 5.9',
      icon: '🔷',
      url: 'https://www.typescriptlang.org',
      description: 'Strongly-typed superset of JavaScript that compiles to plain JS.',
      usage:
        'All Angular components, services, interceptors, and utilities are written in strict TypeScript. No `any` types in production code (except for Angular forms and dynamic HTTP responses). Compile-time type checking catches API contract mismatches before runtime.',
    },
    {
      name: 'Vitest',
      icon: '🧪',
      url: 'https://vitest.dev',
      description: 'Fast Vite-native unit testing framework compatible with the Jest API.',
      usage:
        'Replaces Karma+Jasmine for Angular unit tests. Runs with a jsdom environment. Tests cover services, pipes, and pure functions. Executed by `./run.sh test` and the GitLab CI pipeline. No `fakeAsync`/`tick` — async is handled with real Promises and `vi.useFakeTimers()`.',
    },
  ];
  readonly portMap: Array<{
    port: number | null;
    name: string;
    category: string;
    note: string;
    url?: string | null;
  }> = [
    // Application
    {
      port: 8080,
      name: 'Customer API (local)',
      category: 'App',
      note: 'Spring Boot — direct process (ng serve connects here)',
      url: 'http://localhost:8080/swagger-ui.html',
    },
    {
      port: 4200,
      name: 'Angular UI (ng serve)',
      category: 'App',
      note: 'Dev server → API on :8080 (not kind). Use :8090 for the kind cluster.',
    },
    // Kubernetes access: ADR-0025 in mirador-service dropped the kind
    // ingress entirely — kind and GKE are now reached through kubectl
    // port-forward (bin/pf-prod.sh), same tunnel port map for both.
    {
      port: 18080,
      name: 'Backend (prod tunnel)',
      category: 'App',
      note: 'bin/pf-prod.sh — backend reached through kubectl port-forward',
      url: 'http://localhost:18080',
    },
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
    // Admin Tools. pgAdmin + pgweb + Redis Commander were dropped in
    // favour of CloudBeaver (one SQL client instead of two) + RedisInsight
    // (one Redis UI instead of two). See mirador-service MR 77.
    {
      port: 8978,
      name: 'CloudBeaver',
      category: 'Admin',
      note: 'DBeaver web — set admin password on first visit, register the db connection',
      url: 'http://localhost:8978',
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
    // CI/CD
    {
      port: null,
      name: 'GitLab Runner',
      category: 'CI',
      note: 'Executes CI jobs locally — zero gitlab.com minutes consumed',
      url: null,
    },
    // Observability
    {
      port: 3000,
      name: 'Grafana LGTM',
      category: 'Obs',
      note: 'Traces · Logs · Metrics (no login)',
      url: 'http://localhost:3000',
    },
    {
      port: 3000,
      name: 'Grafana (LGTM)',
      category: 'Obs',
      note: 'Tempo traces + Loki logs — use Explore for TraceQL',
      url: 'http://localhost:3000/explore',
    },
    {
      port: 9091,
      name: 'Mimir',
      category: 'Obs',
      note: 'Metrics (Prometheus-compatible API, bundled in otel-lgtm)',
      url: 'http://localhost:9091',
    },
    {
      port: 3200,
      name: 'Tempo API',
      category: 'Obs',
      note: 'Trace query API — use Grafana Explore for the UI',
      url: 'http://localhost:3000/explore?schemaVersion=1&panes=%7B%22df4%22%3A%7B%22datasource%22%3A%22tempo%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22queryType%22%3A%22traceqlSearch%22%2C%22limit%22%3A20%7D%5D%2C%22range%22%3A%7B%22from%22%3A%22now-1h%22%2C%22to%22%3A%22now%22%7D%7D%7D&orgId=1',
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

  readonly portCategories = ['App', 'Data', 'Admin', 'CI', 'Obs', 'Infra'];

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

  /**
   * Root URL for architecture docs on GitLab. Tabs link here instead of
   * inlining prose — the component is a UI shell around a set of Markdown
   * pages that are rendered natively by GitLab (and versioned in-repo, so
   * deep-links survive refactors unlike the old inline copy).
   */
  readonly docsBase = 'https://gitlab.com/mirador1/mirador-ui/-/blob/main/docs/architecture';
}
