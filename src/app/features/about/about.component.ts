import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
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
      icon: '⚙️',
      name: 'Settings',
      detail:
        'Actuator endpoint explorer, loggers (change levels live), SQL Explorer with 20+ PostgreSQL diagnostic queries via pgweb',
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
}
