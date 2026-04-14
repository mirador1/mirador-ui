/**
 * DashboardComponent — Home page with backend health overview.
 *
 * Features:
 * - Health probes: /actuator/health, /readiness, /liveness with UP/DOWN badges
 * - Stats cards: customer count, HTTP request count, latency percentiles
 * - Live throughput chart: RPS bar chart (delegates to MetricsService singleton)
 * - Auto-refresh: configurable polling interval (1s / 5s / 10s / 30s)
 * - Health change detection: toasts on UP/DOWN transitions
 * - Docker service control: list/start/stop/restart containers via Docker Engine API proxy
 * - Dependency graph: SVG graph of backend services with health status colors
 * - Quick traffic generator: fires mixed requests to populate metrics
 * - Request heatmap: 24h traffic distribution grid
 * - Snapshot comparator: before/after metric diffs with percentage change
 * - Observability links: one-click access to Grafana, Prometheus, Zipkin, etc.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { JsonPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { ActivityService } from '../../core/activity/activity.service';
import { MetricsService, ParsedMetrics } from '../../core/metrics/metrics.service';
import { InfoTipComponent } from '../../shared/info-tip/info-tip.component';

/** Snapshot of all three health probe statuses at a point in time */
interface HealthSnapshot {
  time: Date;
  health: string;
  readiness: string;
  liveness: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe, DecimalPipe, FormsModule, RouterLink, InfoTipComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  readonly metricsService = inject(MetricsService);

  health = signal<unknown>(null);
  readiness = signal<unknown>(null);
  liveness = signal<unknown>(null);
  error = signal('');
  lastRefresh = signal<Date | null>(null);

  // ── Stats ──────────────────────────────────────────────────────────────────
  customerCount = signal<number | null>(null);
  metrics = signal<ParsedMetrics | null>(null);
  metricsError = signal('');

  // ── Health history ─────────────────────────────────────────────────────────
  healthHistory = signal<HealthSnapshot[]>([]);

  // ── Real-time chart (persisted in MetricsService) ──────────────────────────

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  autoRefreshInterval = signal<number>(5);
  readonly intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '1s', value: 1 },
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
  ];
  private _timer: ReturnType<typeof setInterval> | null = null;
  /** Tracks previous health status to detect UP/DOWN transitions and trigger toasts */
  private _previousHealthStatus: string | null = null;

  /** Quick links — items that don't have a corresponding Docker container in Service Control */
  readonly quickLinks = [
    {
      label: 'Swagger UI',
      sub: 'Interactive API documentation',
      url: `${this.env.baseUrl()}/swagger-ui.html`,
      icon: '📄',
      tip: 'OpenAPI 3 interactive documentation generated from the Spring Boot REST controllers. Try out any endpoint directly from the browser. Authenticate with the JWT token from /auth/login (admin/admin).',
    },
    {
      label: 'Actuator /metrics',
      sub: 'Raw Prometheus scrape endpoint',
      url: `${this.env.baseUrl()}/actuator/prometheus`,
      icon: '📈',
      tip: 'Raw Prometheus text exposition format. Contains all Micrometer metrics: HTTP request counts and histograms, JVM heap/threads/GC, Kafka consumer lag, Spring Data repository invocation times, and custom application metrics.',
    },
  ];

  ngOnInit(): void {
    this.refresh();
    this.setAutoRefresh(this.autoRefreshInterval());
    this.loadContainers();
    window.addEventListener('app:refresh', this._onRefresh);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    window.removeEventListener('app:refresh', this._onRefresh);
  }

  private _onRefresh = () => this.refresh();

  refresh(): void {
    this.error.set('');

    this.api.getHealth().subscribe({
      next: (v) => {
        const newStatus = (v as { status?: string })?.status ?? '?';
        if (this._previousHealthStatus && this._previousHealthStatus !== newStatus) {
          if (newStatus === 'UP') {
            this.toast.show('Backend is back UP', 'success');
            this.activity.log('health-change', 'Backend health → UP');
          } else {
            this.toast.show(`Backend health changed to ${newStatus}`, 'error', 6000);
            this.activity.log('health-change', `Backend health → ${newStatus}`);
          }
        }
        this._previousHealthStatus = newStatus;
        this.health.set(v);
        this.lastRefresh.set(new Date());
        this.recordHistory();
      },
      error: () => {
        if (this._previousHealthStatus && this._previousHealthStatus !== 'UNREACHABLE') {
          this.toast.show('Backend is unreachable!', 'error', 6000);
          this.activity.log('health-change', 'Backend unreachable');
        }
        this._previousHealthStatus = 'UNREACHABLE';
        this.health.set({ status: 'UNREACHABLE' });
        this.error.set(`Backend not reachable at ${this.env.baseUrl()}`);
        this.recordHistory();
      },
    });

    this.api.getReadiness().subscribe({
      next: (v) => this.readiness.set(v),
      error: () => this.readiness.set({ status: 'UNREACHABLE' }),
    });

    this.api.getLiveness().subscribe({
      next: (v) => this.liveness.set(v),
      error: () => this.liveness.set({ status: 'UNREACHABLE' }),
    });

    this.api.getCustomers(0, 1).subscribe({
      next: (page) => this.customerCount.set(page.totalElements),
      error: () => this.customerCount.set(null),
    });

    this.api.getPrometheusMetrics().subscribe({
      next: (text) => this.metrics.set(this.metricsService.parsePrometheus(text)),
      error: () => this.metricsError.set('Could not fetch metrics'),
    });

    // Refresh dependency graph and Docker containers alongside health probes
    this.refreshTopology();
    this.loadContainers();
  }

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  setAutoRefresh(seconds: number): void {
    this.autoRefreshInterval.set(seconds);
    this.stopTimer();
    if (seconds > 0) {
      this._timer = setInterval(() => this.refresh(), seconds * 1000);
    }
  }

  private stopTimer(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ── Real-time chart (delegates to MetricsService) ──────────────────────────
  toggleChart(): void {
    this.metricsService.toggle();
  }

  chartBars(): Array<{ x: number; height: number; rps: number }> {
    const samples = this.metricsService.samples();
    if (samples.length < 2) return [];
    const maxRps = Math.max(1, ...samples.map((s) => s.rps));
    const barWidth = 300 / 40;
    return samples.map((s, i) => ({
      x: i * barWidth,
      height: (s.rps / maxRps) * 80,
      rps: s.rps,
    }));
  }

  chartMaxRps(): number {
    const samples = this.metricsService.samples();
    return Math.max(1, ...samples.map((s) => s.rps));
  }

  // ── Docker service control ─────────────────────────────────────────────────
  // Calls the Docker Engine API via the CORS proxy (localhost:2375)
  // backed by docker-socket-proxy (tecnativa/docker-socket-proxy) in docker-compose.
  private readonly dockerApiUrl = 'http://localhost:2375';

  /** Known project containers — only these are shown in the UI */
  private readonly knownContainers: Record<
    string,
    {
      icon: string;
      label: string;
      description: string;
      detail: string;
      image?: string;
      port?: string;
      url?: string;
    }
  > = {
    'postgres-demo': {
      icon: '🐘',
      label: 'PostgreSQL',
      description: 'Primary database',
      detail:
        'PostgreSQL 17 — stores all customer data. Used by Spring Data JPA with Flyway migrations. Stopping it triggers DB health DOWN and makes all CRUD endpoints fail.',
      image: 'images/tools/pgadmin.png',
      port: '5432',
    },
    'redis-demo': {
      icon: '🗄️',
      label: 'Redis',
      description: 'Distributed cache',
      detail:
        'Redis 7 — backs the RecentCustomerBuffer (ring buffer of last 10 created customers). Also used for idempotency key storage. Stopping it makes /customers/recent return errors.',
      image: 'images/tools/redisinsight.png',
      port: '6379',
      url: 'http://localhost:5540',
    },
    'kafka-demo': {
      icon: '📨',
      label: 'Kafka',
      description: 'Async messaging',
      detail:
        'Apache Kafka in KRaft mode (no ZooKeeper). Handles async customer events (customer.created topic) and the request-reply enrich pattern (customer.request → customer.reply). Stopping it causes 504 timeouts on /customers/{id}/enrich.',
      image: 'images/tools/kafka-ui.gif',
      port: '9092',
      url: 'http://localhost:9080',
    },
    ollama: {
      icon: '🧠',
      label: 'Ollama',
      description: 'Local LLM runtime',
      detail:
        'Ollama runs the llama3.2 model locally. Powers the /customers/{id}/bio endpoint via Spring AI. Protected by a Resilience4j circuit breaker — stopping Ollama trips the breaker after 10 failed /bio calls.',
      port: '11434',
    },
    keycloak: {
      icon: '🔐',
      label: 'Keycloak',
      description: 'Identity provider',
      detail:
        'Keycloak 26 — OAuth2/OIDC provider. Optional: the app also supports its own JWT auth via /auth/login (admin/admin). When enabled, JWT tokens issued by Keycloak are validated alongside built-in tokens.',
      image: 'images/tools/keycloak.png',
      port: '9090',
      url: 'http://localhost:9090/admin',
    },
    'spring-app': {
      icon: '🍃',
      label: 'Spring Boot',
      description: 'Backend API',
      detail:
        'The customer-service Spring Boot application running in Docker (alternative to running on the host). Exposes the REST API, actuator endpoints, and Swagger UI. Usually run on the host with ./mvnw spring-boot:run instead.',
      image: 'images/tools/swagger.png',
      port: '8080',
      url: 'http://localhost:8080/swagger-ui.html',
    },
    'customerservice-prometheus': {
      icon: '🔥',
      label: 'Prometheus',
      description: 'Metrics store',
      detail:
        'Scrapes /actuator/prometheus every 15s. Stores time-series metrics (HTTP request counts, latency histograms, JVM gauges). Queried by Grafana dashboards and directly by the Angular UI for golden signals, latency charts, and Sankey diagrams.',
      image: 'images/tools/prometheus.png',
      port: '9091',
      url: 'http://localhost:9091',
    },
    'customerservice-lgtm': {
      icon: '🔍',
      label: 'LGTM Stack',
      description: 'Grafana · Loki · Tempo · Mimir',
      detail:
        'Grafana LGTM all-in-one (port 3001): bundles Loki (logs), Tempo (distributed traces), Mimir (long-term metrics), and Grafana (UI) in a single container. Spring Boot sends traces and logs via OpenTelemetry OTLP on port 4318 → OTel Collector → Tempo / Loki. There is no standalone Tempo UI — use Grafana Explore (port 3001) to search traces with TraceQL. Tempo HTTP API also exposed on port 3200 for direct lookups.',
      image: 'images/tools/grafana.png',
      port: '3001',
      url: 'http://localhost:3000/dashboards',
    },
    'customerservice-pyroscope': {
      icon: '🧬',
      label: 'Pyroscope',
      description: 'Continuous profiling',
      detail:
        'Grafana Pyroscope — captures CPU and memory flamegraphs continuously. The Pyroscope Java agent is embedded in the app and pushes JFR profiles every 10s. Useful for identifying hot methods and memory leaks.',
      image: 'images/tools/pyroscope.png',
      port: '4040',
      url: 'http://localhost:4040/explore?profileTypeId=process_cpu:cpu:nanoseconds:cpu:nanoseconds&labelSelector=%7Bservice_name%3D%22customer-service%22%7D',
    },
    pgweb: {
      icon: '🔬',
      label: 'pgweb',
      description: 'SQL client + REST API',
      detail:
        'Lightweight PostgreSQL web client with REST API. Read-only mode, CORS enabled. The Angular frontend calls GET /api/query for the SQL Explorer in Settings.',
      port: '8081',
      url: 'http://localhost:8081',
    },
    pgadmin: {
      icon: '🛢️',
      label: 'pgAdmin',
      description: 'PostgreSQL web UI',
      detail:
        'pgAdmin 4 — web-based PostgreSQL administration tool. Connect to postgres-demo:5432 (user: postgres, password: postgres, db: customerdb). Useful for inspecting the customer table, running ad-hoc SQL, and checking Flyway migrations.',
      image: 'images/tools/pgadmin.png',
      port: '5050',
      url: 'http://localhost:5050',
    },
    'kafka-ui': {
      icon: '📋',
      label: 'Kafka UI',
      description: 'Topics & consumers',
      detail:
        'Provectus Kafka UI — browse topics (customer.created, customer.request, customer.reply), inspect messages, monitor consumer groups and lag. Also used by the Angular topology view to check Kafka health.',
      image: 'images/tools/kafka-ui.gif',
      port: '9080',
      url: 'http://localhost:9080',
    },
    'redis-commander': {
      icon: '📟',
      label: 'Redis Commander',
      description: 'Redis web UI + live monitor',
      detail:
        'Lightweight Redis web UI with live command monitoring. Auto-connects to Redis. Shows real-time command stream — useful for watching idempotency keys and rate limit buckets change.',
      port: '8082',
      url: 'http://localhost:8082',
    },
    redisinsight: {
      icon: '🔎',
      label: 'RedisInsight',
      description: 'Redis key browser',
      detail:
        'RedisInsight — visual Redis explorer. Browse keys (idempotency keys, recent customer buffer), inspect TTLs, run Redis commands. Connect to redis-demo:6379.',
      image: 'images/tools/redisinsight.png',
      port: '5540',
      url: 'http://localhost:5540',
    },
  };

  dockerContainers = signal<
    Array<{
      name: string;
      status: string;
      image: string;
      running: boolean;
      icon: string;
      label: string;
      description: string;
      detail: string;
      screenshot?: string;
      port?: string;
      url?: string;
    }>
  >([]);
  dockerLoading = signal(false);
  dockerActionLoading = signal<string | null>(null);
  dockerError = signal('');

  loadContainers(): void {
    this.dockerLoading.set(true);
    this.dockerError.set('');
    this.http
      .get<any[]>(`${this.dockerApiUrl}/containers/json?all=true`)
      .pipe(catchError(() => of(null)))
      .subscribe((containers) => {
        this.dockerLoading.set(false);
        if (!containers) {
          this.dockerError.set(
            'Cannot reach Docker API (localhost:2375). Run: docker compose -f docker-compose.observability.yml up -d',
          );
          return;
        }
        // Filter to known project containers only, enrich with description
        const mapped = containers
          .map((c: any) => {
            const name = (c.Names?.[0] || '').replace(/^\//, '');
            const known = this.knownContainers[name];
            if (!known) return null; // skip unknown/orphan containers
            return {
              name,
              status: c.Status || '',
              image: c.Image || '',
              running: c.State === 'running',
              icon: known.icon,
              label: known.label,
              description: known.description,
              detail: known.detail,
              screenshot: known.image,
              port: known.port,
              url: known.url,
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort((a, b) => {
            // Running first, then alphabetical
            if (a.running !== b.running) return a.running ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        this.dockerContainers.set(mapped);
      });
  }

  dockerAction(name: string, action: 'stop' | 'start' | 'restart'): void {
    this.dockerActionLoading.set(`${name}:${action}`);
    // Docker Engine API: POST /containers/{name}/{action}
    this.http
      .post<any>(`${this.dockerApiUrl}/containers/${name}/${action}`, null)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.dockerActionLoading.set(null);
        this.toast.show(`${action} ${name}`, 'info');
        this.activity.log('health-change', `Docker ${action}: ${name}`);
        // Refresh containers list and health after a short delay
        setTimeout(() => {
          this.loadContainers();
          this.refresh();
        }, 2000);
      });
  }

  dockerRunningCount(): number {
    return this.dockerContainers().filter((c) => c.running).length;
  }

  isDockerActionLoading(name: string, action: string): boolean {
    return this.dockerActionLoading() === `${name}:${action}`;
  }

  // ── Quick traffic generator ────────────────────────────────────────────────
  trafficRunning = signal(false);

  quickTraffic(): void {
    this.trafficRunning.set(true);
    const base = this.env.baseUrl();
    // Fetch first available customer ID, then build endpoint list
    this.api.getFirstCustomerId().subscribe((id) => {
      const endpoints = [
        `${base}/customers?page=0&size=5`,
        `${base}/customers?page=0&size=5`,
        `${base}/customers/recent`,
        `${base}/actuator/health`,
        `${base}/customers/aggregate`,
        `${base}/customers/${id}/bio`,
        `${base}/customers/${id}/todos`,
        `${base}/customers/${id}/enrich`,
        `${base}/customers?page=0&size=100`,
      ];
      let done = 0;
      const total = endpoints.length;
      this.toast.show(
        `Sending ${total} requests (including slow ones: bio, enrich, aggregate)...`,
        'info',
      );
      for (const url of endpoints) {
        this.http
          .get(url)
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            done++;
            if (done === total) {
              this.trafficRunning.set(false);
              this.toast.show(`${total} requests done — latency metrics updated`, 'success');
              this.refresh();
            }
          });
      }
    }); // end getFirstCustomerId subscribe
  }

  // ── Topology map ───────────────────────────────────────────────────────────
  //
  // Layout designed to avoid edge crossings. All links flow left→right or
  // connect nodes on the same row (horizontal). No diagonal that crosses
  // another edge.
  //
  //  Row 1 (y=35):  Actuator ────────── PostgreSQL ── pgAdmin ──── Prometheus
  //  Row 2 (y=100): Browser ── API ──── Redis ─────── RedisInsight ── Grafana ── Pyroscope
  //  Row 3 (y=165):    Keycloak         Kafka ─────── Consumer ────── Zipkin
  //  Row 4 (y=230):    Swagger UI       Ollama ─────── Kafka UI ───── Loki
  //
  // ── Topology: 6 strict columns, all edges flow left → right ──────────────
  //
  //  Col 1         Col 2          Col 3           Col 4            Col 5           Col 6
  //  CLIENT        APPLICATION    DATA STORES     DATA TOOLS       OBS COLLECTORS  OBS DASHBOARDS
  //  ─────────     ───────────    ──────────      ──────────       ──────────────  ──────────────
  //  Browser  →    API        →   PostgreSQL  →   pgAdmin          Prometheus  →   Grafana
  //                Swagger        Redis       →   pgweb            Tempo       →   Grafana
  //                Actuator       Kafka       →   RedisInsight     Loki            Pyroscope
  //                Keycloak       Ollama      →   Redis Commander
  //                                               Kafka Consumer
  //                                               Kafka UI
  //
  readonly topoColumns = [
    '🌐 Client',
    '🍃 Application',
    '🗄️ Data Stores',
    '🛠️ Data Tools',
    '📡 Obs Collectors',
    '🔧 CI/CD',
  ];

  readonly topoNodes: Array<{
    id: string;
    label: string;
    col: number;
    row: number;
    icon: string;
    port?: string;
    url?: string;
    container?: string;
    tip: string;
    detail: string;
    image?: string;
  }> = [
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
    // Col 3 — Data Tools
    {
      id: 'pgadmin',
      label: 'pgAdmin',
      col: 3,
      row: 0,
      icon: '🛢️',
      port: '5050',
      container: 'pgadmin',
      url: 'http://localhost:5050',
      tip: 'PostgreSQL admin UI',
      detail:
        'pgAdmin 4 — full PostgreSQL administration: browse schemas, run SQL, inspect Flyway migrations, monitor connections, view ERD diagrams, backup/restore. Desktop mode (no login). Server pre-configured: db:5432, user demo, database customer-service.',
      image: 'images/tools/pgadmin.png',
    },
    {
      id: 'pgweb',
      label: 'pgweb',
      col: 3,
      row: 1,
      icon: '🔬',
      port: '8081',
      container: 'pgweb',
      url: 'http://localhost:8081',
      tip: 'SQL client + REST API',
      detail:
        'Lightweight PostgreSQL web client (15MB Go binary). Read-only mode, CORS enabled. The Angular Settings page calls its REST API (GET /api/query?query=SELECT...) for the SQL Explorer and PostgreSQL diagnostics (table sizes, index usage, cache hit ratio, bloat).',
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
    {
      id: 'redis-commander',
      label: 'Redis Cmdr',
      col: 3,
      row: 3,
      icon: '📟',
      port: '8082',
      container: 'redis-commander',
      url: 'http://localhost:8082',
      tip: 'Redis live monitor',
      detail:
        'Redis Commander — lightweight alternative to RedisInsight. Auto-connects to Redis. Key feature: live command monitor showing every Redis command in real-time. Useful for watching idempotency key creation, ring buffer LPUSH/LTRIM, and rate limit INCR.',
    },
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
      id: 'prometheus',
      label: 'Prometheus',
      col: 4,
      row: 0,
      icon: '🔥',
      port: '9091',
      container: 'customerservice-prometheus',
      url: 'http://localhost:9091',
      tip: 'Metrics store',
      detail:
        'Prometheus — scrapes /actuator/prometheus every 15s. Stores 180+ time-series metrics: HTTP request counts and latency histograms, JVM heap/threads/GC, HikariCP connection pool, Lettuce Redis ops, Kafka producer/consumer, Spring Security, custom app counters. Queried by Grafana and the Angular UI.',
      image: 'images/tools/prometheus.png',
    },
    {
      id: 'loki',
      label: 'Grafana (otel-lgtm)',
      col: 4,
      row: 1,
      icon: '📦',
      port: '3000',
      container: 'customerservice-lgtm',
      url: 'http://localhost:3000/',
      tip: 'Loki, Grafana, Tempo, Mimir',
      detail:
        'Grafana customisé — image Docker grafana/otel-lgtm (LGTM = Loki, Grafana, Tempo, Mimir). Bundles Loki (logs), Tempo (traces), Mimir (metrics) et Grafana (UI) dans un seul container. Spring Boot envoie traces et logs via OTLP port 4318 → OTel Collector → Tempo / Loki. Ouvrir le dashboard CustomerService Overview pour la corrélation complète.',
      image: 'images/tools/grafana.png',
    },
    // Col 5 — CI/CD
    {
      id: 'gitlab-local',
      label: 'GitLab (local)',
      col: 5,
      row: 0,
      icon: '🦊',
      port: '9081',
      container: 'gitlab',
      url: 'http://localhost:9081',
      tip: 'GitLab CE — instance locale Docker',
      detail:
        'GitLab Community Edition — instance locale via docker-compose.gitlab.yml. Héberge les dépôts et pipelines CI/CD sans consommer de minutes sur gitlab.com. Accès : http://localhost:9081. Premier démarrage : ~2-3 min. Enregistrer le runner local : docker exec -it gitlab-runner gitlab-runner register --url http://host.docker.internal:9081 --token <token>.',
      image: 'images/tools/gitlab.png',
    },
    {
      id: 'gitlab-com',
      label: 'gitlab.com',
      col: 5,
      row: 1,
      icon: '🌍',
      url: 'https://gitlab.com/benoit.besson/customer-service/-/pipelines',
      tip: 'Dépôt distant — pipelines gitlab.com',
      detail:
        "Instance SaaS gitlab.com — dépôt distant du projet customer-service. Les pipelines s'exécutent soit sur les shared runners GitLab (minutes partagées), soit sur le runner local enregistré. URL : https://gitlab.com/benoit.besson/customer-service.",
      image: 'images/tools/gitlab.png',
    },
    {
      id: 'pyroscope',
      label: 'Pyroscope',
      col: 4,
      row: 3,
      icon: '🧬',
      port: '4040',
      container: 'customerservice-pyroscope',
      url: 'http://localhost:4040/explore?profileTypeId=process_cpu:cpu:nanoseconds:cpu:nanoseconds&labelSelector=%7Bservice_name%3D%22customer-service%22%7D',
      tip: 'Continuous profiling',
      detail:
        'Grafana Pyroscope — continuous profiling with CPU (itimer), memory allocation (alloc 512KB threshold), and lock contention (10ms threshold) flamegraphs. The Pyroscope Java agent attaches via -javaagent in app-profiled mode. Uploads profiles every 10s. Identifies hot methods and memory leaks.',
      image: 'images/tools/pyroscope.png',
    },
  ];

  // All edges flow strictly left → right (lower col → higher col)
  readonly topoEdgeList = [
    // Col 0 → 1
    { from: 'client', to: 'api' },
    // Col 1 → 2 (API uses data stores)
    { from: 'api', to: 'pg' },
    { from: 'api', to: 'redis' },
    { from: 'api', to: 'kafka' },
    { from: 'api', to: 'ollama' },
    // Col 2 → 3 (data stores → their tools)
    { from: 'pg', to: 'pgadmin' },
    { from: 'pg', to: 'pgweb' },
    { from: 'redis', to: 'redisinsight' },
    { from: 'redis', to: 'redis-commander' },
    { from: 'kafka', to: 'consumer' },
    { from: 'kafka', to: 'kafka-ui' },
    // Col 1 → 4 (API pushes to obs collectors via OTLP on port 4318)
    { from: 'api', to: 'prometheus' },
    { from: 'api', to: 'loki' }, // OTLP traces + logs → LGTM (Tempo + Loki inside)
    { from: 'api', to: 'pyroscope' },
  ];
  topoStatus = signal<Record<string, 'up' | 'down' | 'unknown'>>({});

  refreshTopology(): void {
    const base = this.env.baseUrl();
    const status: Record<string, 'up' | 'down' | 'unknown'> = { client: 'up' };

    const update = (id: string, s: 'up' | 'down' | 'unknown') => {
      status[id] = s;
      this.topoStatus.set({ ...status });
    };

    // API + db + redis from actuator/health
    this.http
      .get<any>(`${base}/actuator/health`)
      .pipe(catchError(() => of(null)))
      .subscribe((h) => {
        const c = h?.components ?? {};
        const apiUp = h?.status === 'UP' || (h && h.status);
        update('api', apiUp ? 'up' : 'down');
        update('swagger', apiUp ? 'up' : 'down');
        update('actuator', apiUp ? 'up' : 'down');
        update('pg', c['db']?.status === 'UP' ? 'up' : c['db'] ? 'down' : 'unknown');
        update('redis', c['redis']?.status === 'UP' ? 'up' : c['redis'] ? 'down' : 'unknown');
      });

    // Docker containers → derive status for services without health endpoints
    const containers = this.dockerContainers();
    const dockerMap: Record<string, string> = {
      'kafka-demo': 'kafka',
      ollama: 'ollama',
      keycloak: 'keycloak',
      pgweb: 'pgweb',
      'redis-commander': 'redis-commander',
      'customerservice-jaeger': 'jaeger',
      pgadmin: 'pgadmin',
      'kafka-ui': 'kafka-ui',
      redisinsight: 'redisinsight',
      'customerservice-prometheus': 'prometheus',
      'customerservice-zipkin': 'zipkin',
      'customerservice-lgtm': 'loki',
      'customerservice-pyroscope': 'pyroscope',
      gitlab: 'gitlab-local',
    };
    for (const [containerName, nodeId] of Object.entries(dockerMap)) {
      const c = containers.find((x) => x.name === containerName);
      update(nodeId, c ? (c.running ? 'up' : 'down') : 'unknown');
    }
    // Consumer = same as Kafka
    const kafkaC = containers.find((x) => x.name === 'kafka-demo');
    update('consumer', kafkaC?.running ? 'up' : 'unknown');

    // gitlab.com — probe with a no-cors HEAD request (network failure = DOWN, reachable = UP)
    fetch('https://gitlab.com', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
      .then(() => update('gitlab-com', 'up'))
      .catch(() => update('gitlab-com', 'down'));
  }

  topoNodesInCol(col: number) {
    return this.topoNodes.filter((n) => n.col === col).sort((a, b) => a.row - b.row);
  }

  /** Get the list of nodes this node connects to (→) and is connected from (←) */
  topoConnections(nodeId: string): { to: string[]; from: string[] } {
    const nodeMap = new Map(this.topoNodes.map((n) => [n.id, n.label]));
    const to: string[] = [];
    const from: string[] = [];
    for (const e of this.topoEdgeList) {
      if (e.from === nodeId) to.push(nodeMap.get(e.to) ?? e.to);
      if (e.to === nodeId) from.push(nodeMap.get(e.from) ?? e.from);
    }
    return { to, from };
  }

  topoContainer(node: { container?: string }): { running: boolean; name: string } | null {
    if (!node.container) return null;
    return this.dockerContainers().find((c) => c.name === node.container) ?? null;
  }

  topoNodeColor(id: string): string {
    const s = this.topoStatus()[id];
    if (s === 'up') return '#4ade80';
    if (s === 'down') return '#f87171';
    return '#94a3b8';
  }

  /** Tooltip explaining how the UP/DOWN status of each node is probed. */
  private readonly statusProbeDescriptions: Record<string, string> = {
    client: 'Always UP — represents your browser, no probe needed.',
    api: 'GET /actuator/health → HTTP 200 + JSON { status: "UP" }.',
    swagger: 'Derived from API status — UP when the Spring Boot app is running.',
    actuator: 'Derived from API status — UP when the Spring Boot app is running.',
    keycloak: 'Docker container state via Docker Engine API (container running = UP).',
    pg: 'Spring Boot health component "db" inside /actuator/health/components.',
    redis: 'Spring Boot health component "redis" inside /actuator/health/components.',
    kafka: 'Docker container state via Docker Engine API (container running = UP).',
    ollama: 'Docker container state via Docker Engine API (container running = UP).',
    pgadmin: 'Docker container state via Docker Engine API (container running = UP).',
    pgweb: 'Docker container state via Docker Engine API (container running = UP).',
    redisinsight: 'Docker container state via Docker Engine API (container running = UP).',
    'redis-commander': 'Docker container state via Docker Engine API (container running = UP).',
    consumer: 'Inferred from Kafka container state — shown as UP when kafka-demo is running.',
    'kafka-ui': 'Docker container state via Docker Engine API (container running = UP).',
    prometheus: 'Docker container state via Docker Engine API (container running = UP).',
    zipkin: 'Docker container state via Docker Engine API (container running = UP).',
    loki: 'Docker container state via Docker Engine API (container running = UP).',
    grafana: 'Docker container state via Docker Engine API (container running = UP).',
    pyroscope: 'Docker container state via Docker Engine API (container running = UP).',
    jaeger: 'Docker container state via Docker Engine API (container running = UP).',
    'spring-app': 'Docker container state via Docker Engine API (container running = UP).',
    'gitlab-local':
      'Docker container state — "gitlab" container running = UP (docker-compose.gitlab.yml).',
    'gitlab-com':
      'HEAD https://gitlab.com (no-cors) — UP if reachable from the browser, DOWN if network error.',
  };

  topoStatusTooltip(nodeId: string): string {
    const probe =
      this.statusProbeDescriptions[nodeId] ?? 'Docker container state via Docker Engine API.';
    const s = this.topoStatus()[nodeId];
    const stateLabel = s === 'up' ? '✅ UP' : s === 'down' ? '❌ DOWN' : '— unknown';
    return `${stateLabel}\nProbe: ${probe}`;
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  heatmapData = signal<Array<{ hour: number; count: number }>>([]);

  buildHeatmap(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        // Use total request count as a proxy; build 24 simulated cells based on current rate
        const match = text.match(/http_server_requests_seconds_count\b.*?\s+(\d+\.?\d*)/m);
        const total = match ? parseFloat(match[1]) : 0;
        const cells = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: Math.round((total / 24) * (0.5 + Math.random())),
        }));
        this.heatmapData.set(cells);
      },
      error: () => {},
    });
  }

  heatmapColor(count: number): string {
    const max = Math.max(1, ...this.heatmapData().map((c) => c.count));
    const intensity = count / max;
    if (intensity < 0.2) return 'var(--bg-card-hover)';
    if (intensity < 0.4) return '#bbf7d0';
    if (intensity < 0.6) return '#86efac';
    if (intensity < 0.8) return '#4ade80';
    return '#16a34a';
  }

  // ── Snapshot comparator ───────────────────────────────────────────────────
  snapshotA = signal<(ParsedMetrics & { customerCount: number; timestamp: Date }) | null>(null);
  snapshotB = signal<(ParsedMetrics & { customerCount: number; timestamp: Date }) | null>(null);

  takeSnapshot(slot: 'A' | 'B'): void {
    const m = this.metrics();
    const cc = this.customerCount() ?? 0;
    if (!m) {
      this.toast.show('No metrics available — refresh first', 'warn');
      return;
    }
    const snap = { ...m, customerCount: cc, timestamp: new Date() };
    if (slot === 'A') this.snapshotA.set(snap);
    else this.snapshotB.set(snap);
    this.toast.show(`Snapshot ${slot} saved`, 'info');
  }

  snapshotDiff(): Array<{ label: string; a: number; b: number; pct: string }> | null {
    const a = this.snapshotA();
    const b = this.snapshotB();
    if (!a || !b) return null;
    const diff = (label: string, av: number, bv: number) => {
      const pct =
        av === 0
          ? bv > 0
            ? '+100%'
            : '0%'
          : `${bv >= av ? '+' : ''}${(((bv - av) / av) * 100).toFixed(1)}%`;
      return { label, a: av, b: bv, pct };
    };
    return [
      diff('Customers', a.customerCount, b.customerCount),
      diff('Total requests', a.httpRequestsTotal, b.httpRequestsTotal),
      diff('Latency p50', a.httpLatencyP50, b.httpLatencyP50),
      diff('Latency p95', a.httpLatencyP95, b.httpLatencyP95),
      diff('Latency p99', a.httpLatencyP99, b.httpLatencyP99),
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private recordHistory(): void {
    const snap: HealthSnapshot = {
      time: new Date(),
      health: this.extractStatus(this.health()),
      readiness: this.extractStatus(this.readiness()),
      liveness: this.extractStatus(this.liveness()),
    };
    this.healthHistory.update((h) => [...h.slice(-29), snap]);
  }

  private extractStatus(data: unknown): string {
    return (data as { status?: string })?.status ?? '?';
  }

  statusClass(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return 'badge-unknown';
    if (d.status === 'UP') return 'badge-up';
    return 'badge-down';
  }

  statusLabel(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return '...';
    return d.status ?? '?';
  }

  /** Generate SVG path data for the health status sparkline (UP=top, DOWN=bottom) */
  sparklinePath(): string {
    const history = this.healthHistory();
    if (history.length < 2) return '';
    const w = 200;
    const h = 30;
    const step = w / (history.length - 1);
    return history
      .map((s, i) => {
        const y = s.health === 'UP' ? 5 : h - 5;
        return `${i === 0 ? 'M' : 'L'}${i * step},${y}`;
      })
      .join(' ');
  }

  /**
   * Compute evenly-spaced x-axis labels (HH:MM) for the health history sparkline.
   * Returns up to 5 labels with their percentage position along the x-axis so
   * they can be placed with CSS `left: <pct>%`.
   */
  sparklineXLabels(): { pct: number; label: string }[] {
    const history = this.healthHistory();
    if (history.length < 2) return [];
    // Up to 5 labels evenly distributed across the history window
    const count = Math.min(5, history.length);
    const step = (history.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round(i * step);
      const d = history[idx].time;
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      const pct = (idx / (history.length - 1)) * 100;
      return { pct, label: `${hh}:${mm}` };
    });
  }

  /** Area fill path — same as sparklinePath but closed at the bottom */
  sparklineAreaPath(): string {
    const history = this.healthHistory();
    if (history.length < 2) return '';
    const w = 200;
    const h = 30;
    const step = w / (history.length - 1);
    const line = history
      .map((s, i) => {
        const y = s.health === 'UP' ? 5 : h - 5;
        return `${i === 0 ? 'M' : 'L'}${i * step},${y}`;
      })
      .join(' ');
    return `${line} L${w},${h} L0,${h} Z`;
  }
}
