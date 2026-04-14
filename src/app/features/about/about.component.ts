import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  readonly activeTab = signal<'overview' | 'pages' | 'stack' | 'infra' | 'shortcuts'>('overview');

  readonly tabs = [
    { id: 'overview', label: '📖 Overview' },
    { id: 'pages', label: '🗂️ Pages' },
    { id: 'stack', label: '🔧 Stack' },
    { id: 'infra', label: '🏗️ Infrastructure' },
    { id: 'shortcuts', label: '⌨️ Shortcuts' },
  ] as const;
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
