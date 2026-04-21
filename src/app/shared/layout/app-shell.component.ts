/**
 * AppShellComponent — Main application layout.
 *
 * Provides:
 * - Top navigation bar with app title, theme toggle, logout
 * - Fixed sidebar navigation (always visible, no collapse)
 * - Global search overlay (Ctrl+K) with keyword-based page matching
 * - Toast notification container
 * - Router outlet for feature page content
 */
import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { EnvService, Environment } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { TourService } from '../../core/tour/tour.service';
import { TourOverlayComponent } from '../../core/tour/tour-overlay.component';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule, TourOverlayComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  /** Provides `isAuthenticated` and `isAdmin` for conditional nav rendering and logout. */
  readonly auth = inject(AuthService);

  /** Provides `theme` signal and `toggle()` for the topbar dark-mode button. */
  readonly theme = inject(ThemeService);

  /** Provides `current` environment info for display in the topbar. */
  readonly env = inject(EnvService);

  /** Provides `toasts` signal rendered in the toast container overlay. */
  readonly toast = inject(ToastService);

  /** Drives the onboarding tour (🎓 button + auto-start on first sign-in). */
  readonly tour = inject(TourService);

  private readonly router = inject(Router);

  constructor() {
    // Auto-start the tour the FIRST time a user reaches an authenticated
    // state. The localStorage flag inside TourService makes this a no-op on
    // subsequent visits. Wrapped in effect() so we react to sign-in without
    // needing a separate lifecycle hook on the dashboard component.
    effect(() => {
      if (this.auth.isAuthenticated()) this.tour.maybeAutoStart();
    });
  }

  /** Signal: true when the mobile hamburger menu is open. Used on small viewports only. */
  mobileMenuOpen = signal(false);

  /**
   * Signal: true when the global search overlay (`Ctrl+K`) is visible.
   * Managed locally here (in addition to `KeyboardService.showSearch`) so the
   * shell template can bind directly without injecting an additional service.
   */
  showSearch = signal(false);

  /** Signal: true when the sidebar is collapsed to icon-only mode. */
  sidebarCollapsed = signal(false);

  /**
   * Equality helper for the env `<select>` dropdown. `ngModel` compares by
   * reference by default; localStorage deserialisation creates new object
   * instances, so we compare by `name` to keep the selected option in sync
   * across reloads.
   */
  readonly envCompare = (a: Environment | null, b: Environment | null): boolean =>
    !!a && !!b && a.name === b.name;

  /**
   * Signal: set of nav section IDs that are currently expanded (accordion behavior).
   * Initialized with `dashboard` and `customers` expanded so the most-used pages are
   * immediately visible without any interaction.
   */
  expandedSections = signal<Set<string>>(new Set(['dashboard', 'customers']));

  /**
   * Global keydown handler registered via `@HostListener`.
   * Handles Ctrl+K (open/close search overlay) and Escape (close search).
   * This duplicates some logic from `KeyboardService` intentionally — the shell
   * owns the search overlay state, so it handles the keys directly.
   *
   * @param e The browser keyboard event.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.showSearch.update((v) => !v);
    }
    if (e.key === 'Escape') this.showSearch.set(false);
  }

  readonly navTree = [
    {
      id: 'dashboard',
      icon: '🏠',
      label: 'Dashboard',
      path: '/',
      tip: 'Health probes, architecture map with 22 services, Docker start/stop, code-quality summary, session-local error timeline, Angular bundle treemap. Time-series metrics live in Grafana (ADR-0007).',
      children: [
        {
          label: 'Health Probes',
          tip: 'Composite health, readiness (Kubernetes), liveness — with sparkline history',
        },
        {
          label: 'Architecture & Services',
          tip: '22 services in 6 columns with live UP/DOWN, Open, Stop/Start',
        },
        {
          label: 'Code Quality',
          tip: 'Last mvn verify snapshot — tests, coverage (unit-only jacoco.csv), SpotBugs, Sonar ratings',
        },
        {
          label: 'Error Timeline',
          tip: 'Session-local stacked bar chart — OK vs error responses over 5-probe/3s polls, used alongside chaos actions',
        },
        {
          label: 'Bundle Treemap',
          tip: 'Angular lazy-chunk size breakdown — static approximation of `npm run build` output',
        },
        {
          label: 'Grafana →',
          tip: 'Opens the LGTM-bundled Grafana in a new tab (http://localhost:3001) for JVM / HTTP / Kafka / system metrics',
        },
      ],
    },
    {
      id: 'customers',
      icon: '👤',
      label: 'Customers',
      path: '/customers',
      tip: 'Full CRUD with search, sort, pagination, API versioning (v1/v2), import/export CSV/JSON, batch operations, per-customer tabs (Bio, Todos, Enrich)',
      children: [
        {
          label: 'List, Search, Sort',
          tip: 'Paginated table with 300ms debounced search and column sort',
        },
        {
          label: 'Create / Edit / Delete',
          tip: 'Form with idempotency key, batch selection, bulk delete',
        },
        { label: 'Import / Export', tip: 'Upload JSON/CSV, download current page as JSON or CSV' },
        {
          label: 'Bio, Todos, Enrich',
          tip: 'Per-customer tabs: Ollama LLM bio, JSONPlaceholder todos, Kafka request-reply enrich',
        },
      ],
    },
    // ADR-0008: Observability page retired. The nav entry is now a deep-link
    // into Grafana Explore (external target, opens in a new tab). The
    // session-local Activity timeline moves up to a top-level entry since
    // it has no natural parent anymore.
    {
      id: 'telemetry',
      icon: '🔍',
      label: 'Observability',
      externalHref: (grafanaUrl: string | null) =>
        grafanaUrl
          ? `${grafanaUrl}/explore?left=` +
            encodeURIComponent(
              JSON.stringify({
                datasource: 'tempo',
                queries: [
                  {
                    refId: 'A',
                    queryType: 'traceqlSearch',
                    filters: [
                      {
                        id: 'svc',
                        operator: '=',
                        scope: 'resource',
                        tag: 'service.name',
                        value: 'mirador',
                      },
                    ],
                  },
                ],
                range: { from: 'now-1h', to: 'now' },
              }),
            )
          : null,
      tip: 'Jump straight into Grafana Explore — TraceQL, LogQL, metrics. The in-UI page was retired (ADR-0008).',
      children: [],
    },
    {
      id: 'activity',
      icon: '⏱️',
      label: 'Activity',
      path: '/activity',
      tip: 'Session event timeline — all client-side actions in this browser session.',
      children: [],
    },
    // ADR-0007: Prometheus-fed metric pages retired — moved to Grafana.
    // Only the two session-local widgets (Error Timeline, Bundle treemap)
    // remain, and they live on the dashboard now. The dropdown keeps a
    // direct Grafana link for operators who want time-series charts.
    {
      id: 'database',
      icon: '🐘',
      label: 'Database',
      path: '/database',
      tip: '27 SQL presets in 5 categories: Customer Data, PG Diagnostics, Schema & Flyway, Production Investigation, Performance — via pgweb REST API',
      children: [
        { label: 'SQL Explorer', tip: 'Custom SQL queries via pgweb REST API (read-only)' },
        { label: 'Customer Data (4)', tip: 'All customers, count, recent, duplicates' },
        {
          label: 'Diagnostics (12)',
          tip: 'Active queries, table sizes, indexes, cache ratio, locks, bloat',
        },
        {
          label: 'Prod Investigation (7)',
          tip: 'Long-running queries, blocked processes, idle-in-transaction, temp files',
        },
        {
          label: 'Performance (7)',
          tip: 'PG settings, index efficiency, HOT ratio, autovacuum, EXPLAIN',
        },
        { label: 'Schema & Flyway (4)', tip: 'Flyway history, tables, columns, constraints' },
      ],
    },
    {
      id: 'diagnostic',
      icon: '🧪',
      label: 'Diagnostic',
      path: '/diagnostic',
      tip: '7 interactive scenarios: API versioning, idempotency, rate limiting, Kafka enrich, virtual threads, version diff, stress test + Waterfall and Sankey visualisations',
      children: [
        {
          label: 'API Versioning',
          tip: 'Side-by-side v1 vs v2 response comparison via X-API-Version header',
        },
        {
          label: 'Idempotency',
          tip: 'Same POST twice with Idempotency-Key — verifies cached response',
        },
        {
          label: 'Rate Limiting',
          tip: 'Burst N concurrent requests, observe 429 Too Many Requests',
        },
        {
          label: 'Kafka Enrich',
          tip: 'Request-reply timing, 504 on timeout if consumer not running',
        },
        {
          label: 'Virtual Threads',
          tip: 'Two parallel tasks via Java virtual threads, observe elapsed time',
        },
        { label: 'Version Diff', tip: 'Colored JSON diff between v1 and v2 responses' },
        {
          label: 'Waterfall',
          tip: '6 parallel requests timed like Chrome DevTools Network tab — observe parallelism and latency',
        },
        {
          label: 'Sankey',
          tip: 'Endpoint → HTTP status flow diagram built from Prometheus counters',
        },
        {
          label: 'Stress Test',
          tip: 'Sustained load: configurable duration, concurrency, endpoint',
        },
      ],
    },
    {
      id: 'chaos',
      icon: '💥',
      label: 'Chaos & Traffic',
      path: '/chaos',
      tip: '8 chaos actions (rate limit, Kafka timeout, circuit breaker, payload flood, concurrent writes, traffic gen, faker), impact monitor with live charts',
      children: [
        {
          label: 'Chaos Actions (8)',
          tip: 'Rate limit, Kafka timeout, circuit breaker, payload flood, concurrent writes, traffic gen',
        },
        {
          label: 'Impact Monitor',
          tip: 'Real-time OK vs error chart + Prometheus traffic breakdown',
        },
        {
          label: 'Data Generator',
          tip: 'Create N customers with realistic random names, configurable delay',
        },
        // Phase 3 DEMO1 — guided scenario walkthrough. Sits under Chaos
        // because it reuses the same failure-injection primitives but
        // wraps them in a "click → observe → reveal → fix" narrative
        // aimed at first-time visitors.
        {
          label: '🔎 Find the bug',
          path: '/find-the-bug',
          tip: 'Three scripted puzzles: trigger a failure, watch live metrics, reveal the root cause, apply the fix',
        },
        // Phase 3 DEMO2 — read-only 5-minute scripted incident.
        // Complements Find the bug (interactive) with a no-clicks-needed
        // walkthrough suitable for a quick skim by a reviewer.
        {
          label: '🎬 Incident anatomy',
          path: '/incident-anatomy',
          tip: 'Scripted 5-minute story of a real incident shape — alert, runbook, trace, fix, verify',
        },
      ],
    },
    {
      id: 'api-client',
      icon: '🛠️',
      label: 'API Client',
      path: '/request-builder',
      tip: 'Postman-like HTTP client: method, URL, headers, body, response viewer, 13 presets, last 20 requests history',
      children: [
        { label: 'Request Builder', tip: 'Method, URL, headers, body — with response viewer' },
        {
          label: 'Presets (13)',
          tip: 'Health, CRUD, bio, todos, enrich, aggregate, Prometheus, loggers',
        },
        { label: 'History', tip: 'Last 20 requests with status, timing, click to replay' },
      ],
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: 'Settings',
      path: '/settings',
      tip: 'Actuator endpoint explorer (health, info, env, beans, metrics, loggers, Prometheus), live logger level changes, application info',
      children: [
        {
          label: 'Actuator Explorer',
          tip: 'Call any actuator endpoint: health, info, env, beans, metrics, loggers, Prometheus',
        },
        { label: 'Loggers', tip: 'Browse/filter Spring loggers, change level live via POST' },
        {
          label: 'Application Info',
          tip: 'App name, version, stack, features from /actuator/info',
        },
      ],
    },
    {
      id: 'security',
      icon: '🔐',
      label: 'Security',
      path: '/security',
      tip: 'Interactive OWASP demos (SQL injection, XSS, CORS, IDOR, JWT), security headers, audit trail with 30s auto-refresh',
      children: [
        {
          id: 'security-demo',
          icon: '💉',
          label: 'Security Demo',
          path: '/security',
          tip: 'Interactive OWASP demos: SQL Injection, XSS, CORS, IDOR, JWT, Security Headers',
          children: [],
        },
        {
          label: 'Audit Trail',
          tip: 'Paginated security and data mutation events with action filter and 30s auto-refresh',
        },
      ],
    },
    {
      id: 'quality',
      label: 'Code Report',
      icon: '🎯',
      path: '/quality',
      tip: 'Code quality report — tests, coverage, SonarQube, SpotBugs, OWASP, PMD, Checkstyle, Pitest',
      children: [],
      adminOnly: true,
    },
    {
      id: 'pipelines',
      label: 'Pipelines',
      icon: '🚦',
      path: '/pipelines',
      tip: 'Live GitLab CI/CD pipeline monitor — fetched from the local docker-api.mjs proxy so the Spring Boot backend is not involved',
      children: [
        { label: 'Project switch', tip: 'Toggle between mirador-service and mirador-ui' },
        { label: 'Auto-refresh', tip: 'Off / 10 s / 30 s / 60 s polling' },
        {
          label: 'Job drill-down',
          tip: 'Click a pipeline to see jobs, runner, and duration — highlights macbook-local runner',
        },
      ],
    },
    {
      id: 'about',
      icon: '📖',
      label: 'About',
      path: '/about',
      tip: 'Architecture diagrams, tech stack, deployment targets (Local, GCP), compatibility matrix',
      children: [
        { label: 'Overview', tip: 'Quick start, architecture summary, and run commands' },
        { label: 'Infrastructure', tip: 'All services, ports, and Docker Compose setup' },
        {
          label: 'Deployment',
          tip: 'Architecture diagram + comparison table for all 3 deployment modes',
        },
        { label: 'Docker', tip: 'docker-compose local — 22 containers, all services on localhost' },
        {
          label: 'Kubernetes local',
          tip: 'kind cluster — ./run.sh k8s-local, nip.io DNS, mirrors production layout',
        },
        {
          label: 'Google Cloud',
          tip: 'GKE Autopilot + Terraform + Cloud SQL, Memorystore, Managed Kafka',
        },
        { label: 'Technologies', tip: 'Full tech stack with usage notes' },
        { label: 'Observability', tip: 'Tracing, metrics, logs, profiling architecture' },
        { label: 'Resilience', tip: 'Circuit breaker, retry, bulkhead, rate limit patterns' },
      ],
    },
  ];

  /**
   * Toggle a nav section open/closed using accordion behavior (only one open at a time).
   * If the clicked section is already open, all sections close.
   *
   * @param id The nav section ID (e.g., `'dashboard'`, `'customers'`).
   */
  toggleSection(id: string): void {
    this.expandedSections.update((set) => {
      const next = new Set<string>();
      // Accordion: only one section open at a time
      if (!set.has(id)) next.add(id);
      return next;
    });
  }

  /**
   * Returns true if the given nav section is currently expanded.
   * Used in the template to toggle the chevron icon and child list visibility.
   *
   * @param id Nav section ID.
   */
  isSectionExpanded(id: string): boolean {
    return this.expandedSections().has(id);
  }

  /**
   * Returns true if the given route path matches the current URL.
   * Strips query params and hash before comparison to avoid false negatives.
   * The root path `/` requires an exact match to avoid all paths matching.
   *
   * @param path Route path (e.g., `'/'`, `'/customers'`).
   */
  isActive(path: string | undefined): boolean {
    if (!path) return false;
    const url = this.router.url.split('?')[0].split('#')[0];
    if (path === '/') return url === '/';
    return url.startsWith(path);
  }

  /**
   * Resolves a nav section's external URL at render time. ADR-0008 introduced
   * `externalHref` functions on nav entries so they can deep-link into Grafana
   * Explore (or other env-aware targets) without hard-coding the URL at build
   * time — it's computed from `EnvService.grafanaUrl()` which changes as the
   * user flips between Local / Kind / Prod in the topbar.
   *
   * Returns `null` when the entry has no external href or when Grafana is
   * not configured for the current environment — in that case the template
   * hides the link entirely rather than rendering a broken anchor.
   */
  externalHref(section: {
    externalHref?: (grafanaUrl: string | null) => string | null;
  }): string | null {
    return section.externalHref?.(this.env.grafanaUrl()) ?? null;
  }

  /** Current search query bound to the search overlay input field. */
  searchQuery = '';

  /**
   * Static search index used by the global search overlay.
   * Each item has a display label, target route path, and space-separated keywords
   * used for substring matching. Adding a new page requires a corresponding entry here.
   */
  readonly searchItems = [
    {
      label: '🏠 Dashboard',
      path: '/',
      keywords: 'dashboard home health metrics architecture services',
    },
    {
      label: '🎯 Code Report',
      path: '/quality',
      keywords:
        'quality code report maven sonarqube spotbugs owasp pmd checkstyle pitest coverage tests',
    },
    {
      label: '👤 Customers',
      path: '/customers',
      keywords: 'customers list create manage crud import export',
    },
    {
      label: '🧪 Diagnostic',
      path: '/diagnostic',
      keywords: 'diagnostic test scenarios versioning idempotency rate limit kafka stress',
    },
    // /observability retired in ADR-0008 — search no longer points at an
    // in-UI page. Operators search for "traces" / "logs" and jump straight
    // to Grafana Explore via the sidebar's external nav entry.
    // /visualizations retired in ADR-0007 — session-local widgets live on
    // the dashboard; time-series metrics moved to Grafana.
    // /timeline retired too — redirected to '/' at the router level.
    {
      label: '🛠️ API Client',
      path: '/request-builder',
      keywords: 'api client request builder postman http rest',
    },
    {
      label: '💥 Chaos',
      path: '/chaos',
      keywords: 'chaos traffic faker generate stress load rate limit circuit breaker',
    },
    {
      label: '🔎 Find the bug',
      path: '/find-the-bug',
      keywords:
        'find bug puzzle demo incident scenario rate limit circuit breaker root cause fix trigger observe',
    },
    {
      label: '🎬 Incident anatomy',
      path: '/incident-anatomy',
      keywords:
        'incident anatomy walkthrough outage timeline alert runbook trace fix recovery observability',
    },
    {
      label: '🐘 Database',
      path: '/database',
      keywords: 'database sql postgresql pgweb diagnostics queries schema flyway',
    },
    {
      label: '⚙️ Settings',
      path: '/settings',
      keywords: 'settings config actuator loggers info beans',
    },
    { label: '📋 Activity', path: '/activity', keywords: 'activity timeline events log history' },
    {
      label: '🛡️ Audit Trail',
      path: '/audit',
      keywords: 'audit trail security events login failed blocked customer created',
    },
    {
      label: '🔐 Security Demo',
      path: '/security',
      keywords: 'security sql injection xss cors vulnerability demo',
    },
  ];

  /**
   * Derived list of search items filtered by `searchQuery`.
   * Matches against both the display label and keyword string (case-insensitive).
   * Returns all items when the query is empty.
   */
  get filteredSearchItems() {
    if (!this.searchQuery) return this.searchItems;
    const q = this.searchQuery.toLowerCase();
    return this.searchItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q),
    );
  }

  /**
   * Navigate to a route selected from the search overlay.
   * Closes the overlay and clears the query after navigation.
   *
   * @param path The route path to navigate to.
   */
  navigateFromSearch(path: string): void {
    this.router.navigateByUrl(path);
    this.showSearch.set(false);
    this.searchQuery = '';
  }

  /**
   * Log out the current user: clears tokens from `AuthService` and
   * redirects to the login page.
   */
  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  /** Toggle the mobile hamburger menu open/closed. */
  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  /** Close the mobile menu. Called when a nav link is clicked on mobile. */
  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
