/**
 * dashboard-topology-data.ts — static topology graph data for the
 * Dashboard architecture map.
 *
 * Extracted 2026-04-22 under Phase B-6 (file-length hygiene). The 270+
 * lines of node + edge definitions were dominating the dashboard
 * component file (1022 → ~713 LOC after this move). Pure data, zero
 * runtime impact — the component re-imports the three constants and
 * exposes them via class members of the same names.
 *
 * Imports SVC (port/URL registry) from `dashboard-types.ts` because
 * several nodes spread `...SVC.xxx` to inherit the canonical port + URL.
 */
import { SVC } from './dashboard-types';

/** A single node in the dashboard architecture map. Rendered as an SVG card with status badge. */
export interface TopoNode {
  /** Stable identifier used in `topoStatus` map + edge endpoints. */
  id: string;
  /** Display label shown on the node card. */
  label: string;
  /** 0-indexed column position (CLIENT / APP / DATA STORES / DATA TOOLS / OBS COLLECTORS / CI/CD). */
  col: number;
  /** 0-indexed row position within the column. */
  row: number;
  /** Emoji icon shown on the node card. */
  icon: string;
  /** Service port (when applicable) — used for the "open in browser" link. */
  port?: string;
  /** Direct URL — used when the service has a UI we can deep-link to. */
  url?: string;
  /** Docker container name — looked up against the live container list to derive status. */
  container?: string;
  /** Short tooltip shown on hover. */
  tip: string;
  /** Long-form description shown in the side panel when the node is selected. */
  detail: string;
  /** Optional logo image path served from /public/. */
  image?: string;
}

/** A single directed edge in the topology graph. All edges flow strictly left → right (lower col → higher col). */
export interface TopoEdge {
  /** Source node ID. */
  from: string;
  /** Destination node ID. */
  to: string;
}

export const DASHBOARD_TOPO_COLUMNS: readonly string[] = [
  '🌐 Client',
  '🍃 Application',
  '🗄️ Data Stores',
  '🛠️ Data Tools',
  '📡 Obs Collectors',
  '🔧 CI/CD',
];

export const DASHBOARD_TOPO_NODES: readonly TopoNode[] = [
  // Col 0 — Client
  {
    id: 'client',
    label: 'Browser',
    col: 0,
    row: 0,
    icon: '🌐',
    url: 'http://localhost:4200',
    tip: 'Angular 21 frontend',
    detail:
      'Standalone Angular 21 app with zoneless change detection and signals. Provides full observability, customer management, diagnostics, chaos testing, and 78+ Prometheus metrics visualization. All charts built with raw SVG.',
  },
  // Col 1 — Application
  {
    id: 'api',
    label: 'Customer API',
    col: 1,
    row: 0,
    icon: '🍃',
    port: '8080',
    container: 'spring-app',
    tip: 'Spring Boot REST API',
    detail:
      'Spring Boot 4 + Java 25 backend. Customer CRUD with pagination, search, sort, API versioning (v1/v2). Resilience: circuit breaker (Resilience4j), rate limiting (Bucket4j 100 req/min), idempotency keys (LRU cache). Virtual threads for /aggregate.',
  },
  {
    id: 'swagger',
    label: 'Swagger UI',
    col: 1,
    row: 1,
    icon: '📄',
    url: 'http://localhost:8080/swagger-ui.html',
    tip: 'API documentation',
    detail:
      'OpenAPI 3 interactive documentation generated from Spring Boot REST controllers. Try any endpoint from the browser. Authenticate with JWT from /auth/login (admin/admin). Shows request/response schemas, examples, and error codes.',
    image: 'images/tools/swagger.png',
  },
  {
    id: 'actuator',
    label: 'Actuator',
    col: 1,
    row: 2,
    icon: '📈',
    url: 'http://localhost:8080/actuator',
    tip: 'Management endpoints',
    detail:
      'Spring Boot Actuator exposes health probes (composite, readiness, liveness), Prometheus metrics (180+ metrics), environment properties, Spring beans, and loggers. The Angular UI queries these endpoints for all dashboard data.',
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    col: 1,
    row: 3,
    icon: '🔐',
    port: '9090',
    container: 'keycloak',
    url: 'http://localhost:9090/admin',
    tip: 'Identity provider',
    detail:
      'Keycloak 26 — OAuth2/OIDC provider. Optional: the app also supports its own JWT auth via /auth/login (admin/admin). When enabled, JWT tokens issued by Keycloak are validated alongside built-in tokens. Manages realms, users, roles, and clients.',
    image: 'images/tools/keycloak.png',
  },
  // Col 2 — Data Stores
  {
    id: 'pg',
    label: 'PostgreSQL',
    col: 2,
    row: 0,
    icon: '🐘',
    port: '5432',
    container: 'postgres-demo',
    tip: 'Primary database',
    detail:
      'PostgreSQL 17 — stores all customer data. Schema managed by Flyway migrations. Spring Data JPA generates queries. HikariCP connection pool (10 connections). Stopping PostgreSQL triggers health DOWN and makes all CRUD endpoints fail.',
    image: 'images/tools/pgadmin.png',
  },
  {
    id: 'redis',
    label: 'Redis',
    col: 2,
    row: 1,
    icon: '🗄️',
    port: '6379',
    container: 'redis-demo',
    tip: 'Distributed cache',
    detail:
      'Redis 7 — backs the RecentCustomerBuffer (ring buffer of last 10 created customers via LPUSH/LTRIM). Stores idempotency keys with TTL. Also used for rate limit counters by Bucket4j. Lettuce client with Micrometer instrumentation.',
    image: 'images/tools/redisinsight.png',
  },
  {
    id: 'kafka',
    label: 'Kafka',
    col: 2,
    row: 2,
    icon: '📨',
    port: '9092',
    container: 'kafka-demo',
    tip: 'Async messaging',
    detail:
      'Apache Kafka in KRaft mode (no ZooKeeper). Topics: customer.created (async events on every POST), customer.request/customer.reply (synchronous request-reply enrich pattern with 5s timeout). Stopping Kafka causes 504 Gateway Timeout on /enrich.',
    image: 'images/tools/kafka-ui.gif',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    col: 2,
    row: 3,
    icon: '🧠',
    port: '11434',
    container: 'ollama',
    tip: 'Local LLM runtime',
    detail:
      'Ollama runs the llama3.2 model locally. Powers /customers/{id}/bio via Spring AI ChatClient. Protected by Resilience4j circuit breaker — 10 failed calls in 60s trips the breaker, returns 503 fallback immediately for 30s before half-opening.',
  },
  // Col 3 — Data Tools. Single CloudBeaver tile replaces the former
  // pgAdmin + pgweb split (mirador-service MR 77).
  {
    id: 'cloudbeaver',
    label: 'CloudBeaver',
    col: 3,
    row: 0,
    icon: '🐘',
    port: '8978',
    container: 'cloudbeaver',
    url: 'http://localhost:8978',
    tip: 'Web SQL browser',
    detail:
      'CloudBeaver — DBeaver web edition, one container. Set admin password on first visit, register a Postgres connection (host db, db customer-service, user demo, password demo). ERD + SQL editor + history survive via the cloudbeaver_data volume.',
    image: 'images/tools/pgadmin.png', // reusing asset until a cloudbeaver.png lands
  },
  {
    id: 'redisinsight',
    label: 'RedisInsight',
    col: 3,
    row: 2,
    icon: '🔎',
    port: '5540',
    container: 'redisinsight',
    url: 'http://localhost:5540',
    tip: 'Redis key browser',
    detail:
      'RedisInsight — visual Redis explorer. Browse keys (idempotency keys with TTL, recent customer ring buffer, rate limit buckets), inspect data types, monitor memory usage, run Redis commands. Connect to redis-demo:6379.',
    image: 'images/tools/redisinsight.png',
  },
  // Redis Commander node removed with mirador-service MR 77 cleanup.
  {
    id: 'consumer',
    label: 'Kafka Consumer',
    col: 3,
    row: 4,
    icon: '📥',
    tip: 'Kafka listener',
    detail:
      'Spring Kafka listener inside the backend. Listens on customer.created topic (logs events, updates stats) and customer.request topic (enriches customer data, publishes reply to customer.reply). Uses CustomerEnrichHandler for the request-reply pattern.',
  },
  {
    id: 'kafka-ui',
    label: 'Kafka UI',
    col: 3,
    row: 5,
    icon: '📋',
    port: '9080',
    container: 'kafka-ui',
    url: 'http://localhost:9080',
    tip: 'Topics & consumers',
    detail:
      'Provectus Kafka UI — browse topics (customer.created, customer.request, customer.reply), inspect individual messages with headers and payload, monitor consumer groups and lag. Also used by the Angular topology view to check Kafka health.',
    image: 'images/tools/kafka-ui.gif',
  },
  // Col 4 — Observability Collectors
  {
    id: 'loki',
    label: 'Grafana (otel-lgtm)',
    col: 4,
    row: 1,
    icon: '📦',
    port: '3000',
    container: 'customerservice-lgtm',
    url: 'http://localhost:3000/',
    tip: 'Loki, Grafana, Tempo, Mimir, Pyroscope',
    detail:
      'Grafana otel-lgtm — bundles Loki (logs), Tempo (traces), Mimir (metrics), Grafana (UI), et Pyroscope (profiling). Spring Boot envoie traces et logs via OTLP port 4318. Le OTel Collector intégré scrape /actuator/prometheus toutes les 15s → Mimir. API Mimir (Prometheus-compatible) exposée sur localhost:9091. Profiles Pyroscope via Explore → Profiles.',
    image: 'images/tools/grafana.png',
  },
  // Col 5 — CI/CD
  {
    id: 'gitlab-com',
    label: 'gitlab.com',
    col: 5,
    row: 0,
    icon: '🌍',
    url: 'https://gitlab.com/mirador1/mirador-service/-/pipelines',
    tip: 'Dépôt distant — pipelines gitlab.com',
    detail:
      "Instance SaaS gitlab.com — groupe mirador1, projets mirador-service et mirador-ui. Les pipelines s'exécutent sur le runner local enregistré (glrt-*). Enregistrer un runner : ./run.sh runner puis ./run.sh register-cloud <TOKEN>. URL : https://gitlab.com/mirador1.",
    image: 'images/tools/gitlab.png',
  },
  {
    id: 'sonarqube',
    label: 'SonarQube',
    col: 5,
    row: 1,
    icon: '🔍',
    container: 'sonarqube',
    tip: 'Static analysis — Java + TypeScript',
    ...SVC.sonarqube,
    detail:
      'SonarQube Community Edition — free self-hosted static analysis at port 9000. Aggregates bugs, code smells, vulnerabilities, duplications and coverage trends. First startup: log in admin/admin, change password, generate a project token, set SONAR_TOKEN in .env. Run: `./run.sh sonar`.',
  },
  {
    id: 'maven-site',
    label: 'Maven Site (API)',
    col: 5,
    row: 2,
    icon: '📊',
    container: 'maven-site',
    tip: 'Backend API quality reports — nginx',
    ...SVC['maven-site'],
    detail:
      'Nginx 1.27 serving the Maven-generated site for the Spring Boot backend (target/site/) at port 8084. Contains: Surefire tests, JaCoCo coverage, SpotBugs, PMD, Checkstyle, Javadoc, OWASP CVE scan, Mutation Testing (PIT). Generate: `./run.sh site`.',
  },
  {
    id: 'compodoc',
    label: 'Compodoc (UI)',
    col: 5,
    row: 3,
    icon: '📐',
    container: 'compodoc',
    tip: 'Angular UI API docs — nginx',
    ...SVC.compodoc,
    detail:
      'Nginx 1.27 serving Compodoc-generated documentation for the Angular frontend at port 8085. Documents all components, services, interfaces, routes with JSDoc — equivalent of Javadoc for the UI. Generate: `cd mirador-ui && npm run compodoc`.',
  },
];

// All edges flow strictly left → right (lower col → higher col)
export const DASHBOARD_TOPO_EDGES: readonly TopoEdge[] = [
  // Col 0 → 1
  { from: 'client', to: 'api' },
  // Col 1 → 2 (API uses data stores)
  { from: 'api', to: 'pg' },
  { from: 'api', to: 'redis' },
  { from: 'api', to: 'kafka' },
  { from: 'api', to: 'ollama' },
  // Col 2 → 3 (data stores → their tools)
  { from: 'pg', to: 'cloudbeaver' },
  { from: 'redis', to: 'redisinsight' },
  { from: 'kafka', to: 'consumer' },
  { from: 'kafka', to: 'kafka-ui' },
  // Col 5 CI/CD → quality tools
  { from: 'gitlab-com', to: 'sonarqube' },
  { from: 'gitlab-com', to: 'maven-site' },
  { from: 'gitlab-com', to: 'compodoc' },
  // Col 1 → 4 (API pushes to obs collectors via OTLP on port 4318)
  { from: 'api', to: 'loki' }, // OTLP traces + logs → LGTM (Tempo + Loki inside)
];
