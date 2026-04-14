/**
 * AppShellComponent — Main application layout.
 *
 * Provides:
 * - Top navigation bar with app title, nav links, env selector, theme toggle, logout
 * - Responsive sidebar menu (mobile hamburger toggle)
 * - Global search overlay (Ctrl+K) with keyword-based page matching
 * - Toast notification container
 * - Router outlet for feature page content
 */
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly env = inject(EnvService);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  mobileMenuOpen = signal(false);
  showSearch = signal(false);
  sidebarCollapsed = signal(false);
  expandedSections = signal<Set<string>>(new Set(['dashboard', 'customers']));

  readonly navTree = [
    {
      id: 'dashboard',
      icon: '🏠',
      label: 'Dashboard',
      path: '/',
      tip: 'Stats cards, live throughput chart, before/after comparator, health probes, architecture map with 22 services, start/stop Docker containers',
      children: [
        {
          label: 'Stats & Comparator',
          tip: 'Customer count, HTTP requests, latency p50/p95/p99, before/after snapshot diff',
        },
        {
          label: 'Health Probes',
          tip: 'Composite health, readiness (Kubernetes), liveness — with sparkline history',
        },
        {
          label: 'Architecture & Services',
          tip: '22 services in 6 columns with live UP/DOWN, Open, Stop/Start',
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
    {
      id: 'telemetry',
      icon: '🔍',
      label: 'Observability',
      path: '/observability',
      tip: 'Traces (Zipkin/Tempo/Jaeger), Logs (Loki/LogQL), Latency histogram, Live SSE feed — all with traffic generation buttons',
      children: [
        {
          label: 'Traces (Zipkin)',
          tip: 'Search traces by service, expand span waterfall, flame graph view',
        },
        { label: 'Logs (Loki)', tip: 'LogQL queries, color-coded by level, live polling every 5s' },
        {
          label: 'Latency Histogram',
          tip: 'HTTP response time distribution in 12 human-readable buckets',
        },
        {
          label: 'Activity',
          path: '/activity',
          tip: 'Session event timeline — all client-side actions in this browser session',
        },
        {
          label: 'Live Feeds',
          tip: 'SSE customer creation events (real-time push) + HTTP endpoint activity (Prometheus polling)',
        },
      ],
    },
    {
      id: 'metrics',
      icon: '📊',
      label: 'Metrics',
      path: '/visualizations',
      tip: '78 configurable Prometheus metric cards (Golden Signals), 55 JVM gauges, Sankey flow, Waterfall, Error timeline, Kafka lag, Slow queries, Bundle analysis',
      children: [
        {
          label: 'Golden Signals (78)',
          tip: '78 configurable cards: HTTP, JVM, GC, DB, Redis, Kafka, Security, System',
        },
        {
          label: 'JVM Gauges (55)',
          tip: '55 circular gauges: memory, CPU, threads, HikariCP, disk, with categories',
        },
        { label: 'Error Timeline', tip: 'Live stacked bar chart OK vs errors, polls every 3s' },
        {
          label: 'Kafka Lag',
          tip: 'Consumer lag line chart, polls every 5s, with traffic generator',
        },
        { label: 'Slow Queries', tip: 'Spring Data repository invocation times from Prometheus' },
        { label: 'Bundle', tip: 'Angular lazy chunk sizes as treemap' },
      ],
    },
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
  ];

  toggleSection(id: string): void {
    this.expandedSections.update((set) => {
      const next = new Set<string>();
      // Accordion: only one section open at a time
      if (!set.has(id)) next.add(id);
      return next;
    });
  }

  isSectionExpanded(id: string): boolean {
    return this.expandedSections().has(id);
  }

  isActive(path: string): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    if (path === '/') return url === '/';
    return url.startsWith(path);
  }

  /** Global search index — each item has a label, route path, and search keywords */
  searchQuery = '';
  readonly searchItems = [
    {
      label: '🏠 Dashboard',
      path: '/',
      keywords: 'dashboard home health metrics architecture services',
    },
    {
      label: '👤 Customers',
      path: '/customers',
      keywords: 'customers list create manage crud import export',
    },
    {
      label: '📡 Live Feeds',
      path: '/timeline',
      keywords: 'live feed timeline sse stream customers realtime prometheus polling activity',
    },
    {
      label: '🧪 Diagnostic',
      path: '/diagnostic',
      keywords: 'diagnostic test scenarios versioning idempotency rate limit kafka stress',
    },
    {
      label: '🔍 Observability',
      path: '/observability',
      keywords: 'telemetry observability traces logs latency zipkin loki tempo flame histogram',
    },
    {
      label: '📊 Metrics',
      path: '/visualizations',
      keywords: 'metrics visualizations golden signals gauges waterfall sankey kafka lag jvm',
    },
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

  get filteredSearchItems() {
    if (!this.searchQuery) return this.searchItems;
    const q = this.searchQuery.toLowerCase();
    return this.searchItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q),
    );
  }

  navigateFromSearch(path: string): void {
    this.router.navigateByUrl(path);
    this.showSearch.set(false);
    this.searchQuery = '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
