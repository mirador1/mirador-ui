/**
 * DashboardComponent — Home page with backend health overview.
 *
 * Kept deliberately lean (ADR-0008 "industrial" pass): only shows signals
 * Grafana cannot express natively.
 *
 * - Health probes: /actuator/health, /readiness, /liveness current status
 *   with UP/DOWN badges + toasts on transitions
 * - Auto-refresh: configurable polling interval (1s / 5s / 10s / 30s)
 * - Docker service control: list/start/stop/restart via Docker Engine API proxy
 * - Dependency graph: SVG graph of backend services with health-colour nodes
 * - Code-quality summary strip sourced from /actuator/quality
 *
 * Removed in this pass: error-timeline stacked bars, Angular bundle treemap,
 * customer-count stat card, UP/DOWN history sparkline — they either live in
 * Grafana (rate/error gauges via Golden Signals) or are build-time artefacts
 * (`ng build --stats-json`). Prometheus-fed RPS/latency charts and JVM/CPU
 * cards were already retired in ADR-0006.
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { JsonPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { EnvService } from '../../../core/env/env.service';
import { ToastService } from '../../../core/toast/toast.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { DeepLinkService } from '../../../core/deep-link/deep-link.service';
import { InfoTipComponent } from '../../../shared/info-tip/info-tip.component';

/**
 * Service port/URL registry — single source of truth for all local service addresses.
 * Referenced by both `knownContainers` (services panel) and `topoNodes` (topology graph)
 * so changing a port only requires editing this one object.
 * Only services with port duplication across multiple data structures are listed here.
 */
const SVC = {
  sonarqube: { port: '9000', url: 'http://localhost:9000' },
  'maven-site': { port: '8084', url: 'http://localhost:8084' },
  compodoc: { port: '8086', url: 'http://localhost:8086' },
  gitlab: { port: '9081', url: 'http://localhost:9081' },
  cloudbeaver: { port: '8978', url: 'http://localhost:8978' },
  'kafka-ui': { port: '9080', url: 'http://localhost:9080' },
  redisinsight: { port: '5540', url: 'http://localhost:5540' },
  keycloak: { port: '9090', url: 'http://localhost:9090/admin' },
  lgtm: { port: '3000', url: 'http://localhost:3000/' },
  api: { port: '8080', url: 'http://localhost:8080' },
} as const;

/**
 * Minimal shape of the Spring Boot `/actuator/health` JSON response.
 * Only the fields used in the component are typed — the full response may contain more.
 */
interface ActuatorHealth {
  /** Overall aggregate status: `'UP'`, `'DOWN'`, `'OUT_OF_SERVICE'`. */
  status?: string;
  /** Per-component health details keyed by component name (e.g., `db`, `redis`, `diskSpace`). */
  components?: Record<string, { status?: string }>;
}

/**
 * Fields from a Docker Engine API container list item that the dashboard uses.
 * The full Docker API response contains many more fields that are ignored here.
 */
interface DockerContainer {
  /** Array of container name strings, each prefixed with `/` (e.g., `['/postgres-demo']`). */
  Names?: string[];
  /** Human-readable status string (e.g., `'Up 3 hours'`, `'Exited (0) 2 hours ago'`). */
  Status?: string;
  /** Docker image name used to start the container. */
  Image?: string;
  /** Low-level container state: `'running'`, `'exited'`, `'paused'`, etc. */
  State?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe, DatePipe, DecimalPipe, FormsModule, InfoTipComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  /** Desktop deep-link helpers (docker-desktop://, vscode://, idea://). */
  readonly deepLink = inject(DeepLinkService);

  /** Signal: raw JSON from `/actuator/health`. Null until first poll. Shape: `{status, components}`. */
  health = signal<unknown>(null);

  /** Signal: raw JSON from `/actuator/health/readiness`. Null until first poll. */
  readiness = signal<unknown>(null);

  /** Signal: raw JSON from `/actuator/health/liveness`. Null until first poll. */
  liveness = signal<unknown>(null);

  /** Signal: error message when the backend is unreachable. Cleared on each successful poll. */
  error = signal('');

  /** Signal: timestamp of the last successful refresh cycle. Displayed in the topbar. */
  lastRefresh = signal<Date | null>(null);

  // ── Code Quality Summary ────────────────────────────────────────────────────

  /**
   * Minimal quality snapshot fetched once on init from /actuator/quality.
   * Shows tests/coverage/bugs/sonar at a glance — links to the full /quality page.
   * Not refreshed on every auto-refresh cycle (quality data only changes after a rebuild).
   */
  qualitySummary = signal<{
    testsTotal: number | null;
    testsPassed: boolean | null;
    coveragePct: number | null;
    bugsTotal: number | null;
    sonarRating: string | null;
    sonarUrl: string | null;
    available: boolean;
  } | null>(null);

  // ── Auto-refresh ──────────────────────────────────────────────────────────

  /**
   * Signal: currently selected auto-refresh interval in seconds.
   * 0 means auto-refresh is off. Default is 5s.
   */
  autoRefreshInterval = signal<number>(5);

  /** Available interval choices shown in the refresh interval dropdown. */
  readonly intervalOptions = [
    { label: 'Off', value: 0 },
    { label: '1s', value: 1 },
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
  ];

  /** Handle for the auto-refresh `setInterval` timer. Null when refresh is off. */
  private _timer: ReturnType<typeof setInterval> | null = null;

  /** Tracks previous health status to detect UP/DOWN transitions and trigger toasts. */
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
    this.loadQualitySummary();
    window.addEventListener('app:refresh', this._onRefresh);
  }

  /**
   * Fetch the quality summary from /actuator/quality and populate qualitySummary.
   * Called once on init — quality data only changes after mvn verify + restart.
   * Gracefully handles unavailable endpoint (backend running without reports).
   */
  loadQualitySummary(): void {
    this.http
      .get<Record<string, unknown>>(`${this.env.baseUrl()}/actuator/quality`)
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        if (!data) {
          this.qualitySummary.set({
            available: false,
            testsTotal: null,
            testsPassed: null,
            coveragePct: null,
            bugsTotal: null,
            sonarRating: null,
            sonarUrl: null,
          });
          return;
        }
        const tests = data['tests'] as Record<string, unknown> | undefined;
        const cov = data['coverage'] as Record<string, unknown> | undefined;
        const bugs = data['bugs'] as Record<string, unknown> | undefined;
        const sonar = data['sonar'] as Record<string, unknown> | undefined;
        const instr = cov?.['instructions'] as Record<string, unknown> | undefined;
        this.qualitySummary.set({
          available: true,
          testsTotal: (tests?.['total'] as number) ?? null,
          testsPassed: tests?.['status'] === 'PASSED',
          coveragePct: (instr?.['pct'] as number) ?? null,
          bugsTotal: (bugs?.['total'] as number) ?? null,
          sonarRating: (sonar?.['reliabilityRating'] as string) ?? null,
          sonarUrl: (sonar?.['url'] as string) ?? null,
        });
      });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this._dockerRetryTimer) {
      clearInterval(this._dockerRetryTimer);
      this._dockerRetryTimer = null;
    }
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
      },
      error: () => {
        if (this._previousHealthStatus && this._previousHealthStatus !== 'UNREACHABLE') {
          this.toast.show('Backend is unreachable!', 'error', 6000);
          this.activity.log('health-change', 'Backend unreachable');
        }
        this._previousHealthStatus = 'UNREACHABLE';
        this.health.set({ status: 'UNREACHABLE' });
        this.error.set(`Backend not reachable at ${this.env.baseUrl()}`);
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

  // Prometheus-fed charts and JVM/CPU/heap gauges that used to live here
  // were retired per ADR-0006: they duplicated Grafana panels fed by the
  // same metrics, without any UI interaction Grafana couldn't express.
  // Health probes + Docker service control + code-quality summary remain
  // because they're either /actuator/health polls or action-triggering
  // buttons — neither is a pure Prometheus read.

  // ── Docker service control ─────────────────────────────────────────────────
  // Calls the Docker Engine API via the CORS proxy (localhost:2375)
  // backed by docker-socket-proxy (tecnativa/docker-socket-proxy) in docker-compose.
  private readonly dockerApiUrl = 'http://localhost:2375';

  /**
   * Known project containers — only these are shown in the UI.
   * Keyed by Docker container name (without the leading slash).
   * Containers not in this map are silently ignored even if they exist locally.
   */
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
    // pgweb + pgAdmin retired together in mirador-service MR 77. CloudBeaver
    // replaces both — one SQL client, same DBeaver UI as the desktop app.
    cloudbeaver: {
      icon: '🐘',
      label: 'CloudBeaver',
      description: 'Web SQL browser',
      detail:
        'CloudBeaver — web edition of DBeaver. On first visit set an admin password, then register a Postgres connection (host db, db customer-service, user demo, password demo). Replaces pgAdmin + pgweb from the pre-MR-77 stack.',
      image: 'images/tools/pgadmin.png', // reusing until a cloudbeaver.png asset lands
      port: '8978',
      url: 'http://localhost:8978',
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
    // Redis Commander removed with mirador-service MR 77 — RedisInsight is
    // the single Redis UI now.
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
    sonarqube: {
      icon: '🔍',
      label: 'SonarQube',
      description: 'Static analysis — Java + TypeScript',
      detail:
        'SonarQube Community Edition — free self-hosted static analysis. Bugs, code smells, vulnerabilities, duplications and coverage trends in one dashboard. First startup: run `./run.sh sonar-setup` to disable force-auth, then generate a token and set SONAR_TOKEN in .env.',
      ...SVC.sonarqube,
    },
    'maven-site': {
      icon: '📊',
      label: 'Maven Site (API)',
      description: 'Backend quality reports (static)',
      detail:
        'Nginx serving the Maven-generated quality report site for the Spring Boot backend (Surefire, JaCoCo, SpotBugs, Javadoc, OWASP CVE scan, Mutation Testing). Generate: `./run.sh site`. Regenerated daily by the CI REPORT_PIPELINE schedule.',
      ...SVC['maven-site'],
    },
    compodoc: {
      icon: '📐',
      label: 'Compodoc (UI)',
      description: 'Angular API docs (static)',
      detail:
        'Nginx serving Compodoc-generated documentation for the Angular frontend — components, services, interfaces, routes with JSDoc comments. The frontend equivalent of Javadoc. Generate: `cd mirador-ui && npm run compodoc`.',
      ...SVC.compodoc,
    },
  };

  /**
   * Signal: list of known project containers enriched with metadata.
   * Populated by `loadContainers()` after filtering the Docker API response.
   * Sorted: running containers first, then alphabetically.
   */
  dockerContainers = signal<
    {
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
    }[]
  >([]);

  /** Signal: true while the Docker container list request is in flight. */
  dockerLoading = signal(false);

  /**
   * Signal: key of the container action currently in progress (e.g., `"kafka-demo:stop"`).
   * Null when no action is running. Used to show a spinner on the active button.
   */
  dockerActionLoading = signal<string | null>(null);

  /** Signal: error message when the Docker API proxy is unreachable. */
  dockerError = signal('');
  // Retry timer: when the Docker API is unreachable, probe again every 10 s so the
  // services panel recovers automatically once the docker-socket-proxy starts up,
  // without requiring a manual page reload.
  private _dockerRetryTimer: ReturnType<typeof setInterval> | null = null;

  loadContainers(): void {
    this.dockerLoading.set(true);
    this.dockerError.set('');
    this.http
      .get<DockerContainer[]>(`${this.dockerApiUrl}/containers/json?all=true`)
      .pipe(catchError(() => of(null)))
      .subscribe((containers) => {
        this.dockerLoading.set(false);
        if (!containers) {
          this.dockerError.set(
            'Cannot reach Docker API (localhost:2375). Run: docker compose -f docker-compose.observability.yml up -d',
          );
          // Retry every 10 s — recovers automatically when the proxy starts up.
          if (!this._dockerRetryTimer) {
            this._dockerRetryTimer = setInterval(() => this.loadContainers(), 10_000);
          }
          return;
        }
        // Docker API is reachable — cancel any pending retry timer.
        if (this._dockerRetryTimer) {
          clearInterval(this._dockerRetryTimer);
          this._dockerRetryTimer = null;
        }
        // Filter to known project containers only, enrich with description
        const mapped = containers
          .map((c: DockerContainer) => {
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
      .post<void>(`${this.dockerApiUrl}/containers/${name}/${action}`, null)
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
  //  Browser  →    API        →   PostgreSQL  →   pgAdmin          Mimir (in lgtm) → Grafana
  //                Swagger        Redis       →   pgweb            Tempo (in lgtm) → Grafana
  //                Actuator       Kafka       →   RedisInsight     Loki  (in lgtm, + Pyroscope)
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

  readonly topoNodes: {
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
  }[] = [
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
  readonly topoEdgeList = [
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
      .get<ActuatorHealth>(`${base}/actuator/health`)
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
      cloudbeaver: 'cloudbeaver',
      'kafka-ui': 'kafka-ui',
      redisinsight: 'redisinsight',
      'customerservice-lgtm': 'loki',
      sonarqube: 'sonarqube',
      'maven-site': 'maven-site',
      compodoc: 'compodoc',
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
    cloudbeaver: 'Docker container state via Docker Engine API (container running = UP).',
    redisinsight: 'Docker container state via Docker Engine API (container running = UP).',
    consumer: 'Inferred from Kafka container state — shown as UP when kafka-demo is running.',
    'kafka-ui': 'Docker container state via Docker Engine API (container running = UP).',
    loki: 'Docker container state via Docker Engine API (container running = UP).',
    'spring-app': 'Docker container state via Docker Engine API (container running = UP).',
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
  heatmapData = signal<{ hour: number; count: number }[]>([]);

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
      // /actuator/prometheus may be 503 if the backend is down or the
      // actuator endpoint isn't enabled. Set an empty heatmap so the
      // template renders a "no data" panel instead of a stale slice
      // and log to the activity timeline so a developer can correlate.
      error: () => {
        this.heatmapData.set([]);
        this.activity.log(
          'health-change',
          'Heatmap fetch failed (Prometheus endpoint unreachable)',
        );
      },
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

  // ── Helpers ───────────────────────────────────────────────────────────────

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
}
