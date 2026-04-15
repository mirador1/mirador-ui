/**
 * QualityComponent — Maven quality report page.
 *
 * Displays a comprehensive build quality report sourced from /actuator/quality:
 * - Test results (Surefire) with per-suite breakdown
 * - Code coverage (JaCoCo) with per-package bars
 * - Static analysis (SpotBugs) bug list
 * - Build metadata (artifact, version, timestamps)
 */
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';

/**
 * A slow test entry from the Surefire report.
 * Listed in the "Slowest Tests" section of the Overview tab.
 */
export interface SlowTest {
  /** Fully-qualified test method name (e.g., `'com.example.CustomerServiceTest#testCreate'`). */
  name: string;
  /** Human-readable duration string (e.g., `'2.345 s'`). */
  time: string;
  /** Duration in milliseconds for sorting. */
  timeMs: number;
}

/**
 * Aggregated results for one Surefire test suite (JUnit class).
 * Shown in the per-suite breakdown table in the Tests tab.
 */
export interface TestSuite {
  /** Test class name (short). */
  name: string;
  /** Total number of test methods in this class. */
  tests: number;
  /** Number of tests that threw an `AssertionError`. */
  failures: number;
  /** Number of tests that threw an unexpected exception. */
  errors: number;
  /** Number of tests annotated `@Disabled` or otherwise skipped. */
  skipped: number;
  /** Total elapsed time string for the suite. */
  time: string;
}

/**
 * Overall test results from Maven Surefire, sourced from `/actuator/quality`.
 * The `available` flag is false when the quality endpoint has no test data
 * (e.g., tests have not been run since the last build).
 */
export interface TestsReport {
  /** True when test data is available in the quality endpoint response. */
  available: boolean;
  /** Overall pass/fail status. */
  status?: 'PASSED' | 'FAILED';
  /** Total number of test methods across all suites. */
  total?: number;
  /** Number of passing tests. */
  passed?: number;
  /** Number of failing tests (assertion errors). */
  failures?: number;
  /** Number of errored tests (unexpected exceptions). */
  errors?: number;
  /** Number of skipped tests. */
  skipped?: number;
  /** Total elapsed time string for the full test run. */
  time?: string;
  /** ISO-8601 timestamp of when the tests were run. */
  runAt?: string;
  /** Per-class suite results. */
  suites?: TestSuite[];
  /** Top slowest individual test cases. */
  slowestTests?: SlowTest[];
}

/**
 * A generic coverage counter for one coverage dimension.
 * Used across JaCoCo metrics (instructions, branches, lines, methods).
 */
export interface Counter {
  /** Number of covered items. */
  covered: number;
  /** Total items (covered + uncovered). */
  total: number;
  /** Coverage percentage (0–100). */
  pct: number;
}

/** JaCoCo coverage data for one Java package. */
export interface PackageCoverage {
  /** Package name (e.g., `'com.example.service'`). */
  name: string;
  /** Instruction coverage percentage for this package. */
  instructionPct: number;
  /** Line coverage percentage for this package. */
  linePct: number;
}

/**
 * JaCoCo code coverage report, sourced from `/actuator/quality`.
 * Shown in the Coverage tab with overall counters and per-package bars.
 */
export interface CoverageReport {
  /** True when JaCoCo data is available (tests must have been run). */
  available: boolean;
  /** Byte-code instruction coverage. */
  instructions?: Counter;
  /** Branch coverage (if/switch decisions). */
  branches?: Counter;
  /** Line coverage. */
  lines?: Counter;
  /** Method coverage. */
  methods?: Counter;
  /** Per-package coverage breakdown. */
  packages?: PackageCoverage[];
}

/** A single SpotBugs bug pattern finding. */
export interface BugItem {
  /** SpotBugs bug category (e.g., `'CORRECTNESS'`, `'PERFORMANCE'`). */
  category: string;
  /** SpotBugs priority: `'1'` (highest) to `'5'` (lowest). */
  priority: string;
  /** SpotBugs bug pattern type (e.g., `'NP_NULL_ON_SOME_PATH'`). */
  type: string;
  /** Fully-qualified class name where the bug was found. */
  className: string;
}

/**
 * SpotBugs static analysis report, sourced from `/actuator/quality`.
 */
export interface BugsReport {
  /** True when SpotBugs data is available. */
  available: boolean;
  /** Total number of bugs found. */
  total?: number;
  /** Bug counts grouped by category. */
  byCategory?: Record<string, number>;
  /** Bug counts grouped by priority. */
  byPriority?: Record<string, number>;
  /** Full list of individual bug items. */
  items?: BugItem[];
}

/**
 * Maven build metadata, sourced from `/actuator/quality`.
 * Shown in the Build section of the Overview tab.
 */
export interface BuildReport {
  /** True when build metadata is available. */
  available: boolean;
  /** Maven `artifactId`. */
  artifact?: string;
  /** Maven project version. */
  version?: string;
  /** Build timestamp. */
  time?: string;
  /** Java version used to compile the project (e.g., `'25'`). */
  javaVersion?: string;
  /** Spring Boot version (e.g., `'4.0.0'`). */
  springBootVersion?: string;
}

/** A single PMD (Java static analysis) rule violation. */
export interface PmdViolation {
  /** Source file path (relative to project root). */
  file: string;
  /** PMD rule name that was violated (e.g., `'UnusedImports'`). */
  rule: string;
  /** PMD ruleset the rule belongs to (e.g., `'Best Practices'`). */
  ruleset: string;
  /** Priority level string: `'1'` (highest) to `'5'` (lowest). */
  priority: string;
  /** Human-readable violation message. */
  message: string;
}

/**
 * PMD static analysis report, sourced from `/actuator/quality`.
 */
export interface PmdReport {
  /** True when PMD data is available. */
  available: boolean;
  /** Total violation count. */
  total?: number;
  /** Violations grouped by ruleset. */
  byRuleset?: Record<string, number>;
  /** Violations grouped by priority. */
  byPriority?: Record<string, number>;
  /** Most frequently violated rules. */
  topRules?: Array<{ rule: string; count: number }>;
  /** Full violation list. */
  violations?: PmdViolation[];
}

/** A single Checkstyle style violation. */
export interface CheckstyleViolation {
  /** Source file path. */
  file: string;
  /** Line number where the violation occurs. */
  line: string;
  /** Severity level (e.g., `'error'`, `'warning'`). */
  severity: string;
  /** Checkstyle checker class name (e.g., `'LineLength'`). */
  checker: string;
  /** Human-readable violation message. */
  message: string;
}

/**
 * Checkstyle code style report, sourced from `/actuator/quality`.
 */
export interface CheckstyleReport {
  /** True when Checkstyle data is available. */
  available: boolean;
  /** Total violation count. */
  total?: number;
  /** Violations grouped by severity. */
  bySeverity?: Record<string, number>;
  /** Most frequent checker violations. */
  topCheckers?: Array<{ checker: string; count: number }>;
  /** Full violation list. */
  violations?: CheckstyleViolation[];
}

/** A single CVE found by the OWASP Dependency-Check scan. */
export interface OwaspVuln {
  /** CVE identifier (e.g., `'CVE-2023-12345'`). */
  cve: string;
  /** CVSS severity string: `'CRITICAL'`, `'HIGH'`, `'MEDIUM'`, `'LOW'`. */
  severity: string;
  /** CVSS base score (0.0–10.0). */
  score: number;
  /** Maven `groupId:artifactId:version` of the affected dependency. */
  dependency: string;
  /** CVE description text. */
  description: string;
}

/**
 * OWASP Dependency-Check CVE scan report, sourced from `/actuator/quality`.
 */
export interface OwaspReport {
  /** True when OWASP scan data is available. */
  available: boolean;
  /** Total CVE count. */
  total?: number;
  /** CVEs grouped by severity. */
  bySeverity?: Record<string, number>;
  /** Full list of vulnerabilities. */
  vulnerabilities?: OwaspVuln[];
}

/** One layer in the Spring Boot executable JAR structure. */
export interface JarLayer {
  /** Layer name (e.g., `'application'`, `'dependencies'`, `'spring-boot-loader'`). */
  name: string;
  /** Number of entries (files) in this layer. */
  entries: number;
}

/**
 * Runtime metadata about the currently running Spring Boot application.
 * Sourced from `/actuator/quality` — useful for correlating report data with the live instance.
 */
export interface RuntimeReport {
  /** True when runtime data is available. */
  available: boolean;
  /** Active Spring profiles (e.g., `['default']`, `['docker', 'metrics']`). */
  activeProfiles?: string[];
  /** Application uptime in seconds. */
  uptimeSeconds?: number;
  /** Human-readable uptime string (e.g., `'2h 35m'`). */
  uptimeHuman?: string;
  /** ISO-8601 timestamp when the application started. */
  startedAt?: string;
  /** JAR layer breakdown (from Spring Boot layered JAR tooling). */
  jarLayers?: JarLayer[];
}

/** A single PIT mutation testing mutation result. */
export interface PitestMutation {
  /** Fully-qualified class name where the mutation was applied. */
  class: string;
  /** Method name that was mutated. */
  method: string;
  /** PIT mutator name (e.g., `'CONDITIONALS_BOUNDARY'`). */
  mutator: string;
  /** Human-readable description of the mutation applied. */
  description: string;
}

/**
 * PIT mutation testing report, sourced from `/actuator/quality`.
 * The mutation score measures test suite effectiveness — 100% means all mutations were killed.
 */
export interface PitestReport {
  /** True when PIT data is available. */
  available: boolean;
  /** Optional note (e.g., if PIT was not run). */
  note?: string;
  /** Total number of mutations generated. */
  total?: number;
  /** Number of mutations detected (killed) by the test suite. */
  killed?: number;
  /** Number of mutations not detected (survived) — test gaps to investigate. */
  survived?: number;
  /** Number of mutations in code with no test coverage at all. */
  noCoverage?: number;
  /** Mutation score as a percentage (killed / total × 100). */
  score?: number;
  /** Mutation counts grouped by status. */
  byStatus?: Record<string, number>;
  /** Mutation counts grouped by mutator type. */
  byMutator?: Record<string, number>;
  /** Surviving mutations that tests failed to detect. */
  survivingMutations?: PitestMutation[];
}

/**
 * Root type returned by `GET /actuator/quality`.
 * Aggregates all quality report sections into a single response.
 * Each sub-report has an `available` flag — sections are omitted or marked unavailable
 * if the corresponding tool was not run during the last Maven build.
 */
export interface QualityReport {
  /** ISO-8601 timestamp when the report was generated. */
  generatedAt: string;
  /** Surefire test results. */
  tests: TestsReport;
  /** JaCoCo code coverage results. */
  coverage: CoverageReport;
  /** SpotBugs static analysis results. */
  bugs: BugsReport;
  /** Maven build metadata. */
  build: BuildReport;
  /** Git commit history and remote URL. */
  git?: {
    available: boolean;
    remoteUrl?: string;
    commits?: Array<{ hash: string; author: string; date: string; message: string }>;
  };
  /** REST API endpoint inventory from SpringDoc. */
  api?: {
    available: boolean;
    total?: number;
    endpoints?: Array<{ path: string; methods: string[]; handler: string }>;
  };
  /** Maven dependency list from the POM. */
  dependencies?: {
    available: boolean;
    total?: number;
    dependencies?: Array<{ groupId: string; artifactId: string; version: string; scope: string }>;
  };
  /** Source code metrics (class/method/line counts and complexity). */
  metrics?: {
    available: boolean;
    totalClasses?: number;
    totalMethods?: number;
    totalLines?: number;
    totalComplexity?: number;
    packages?: Array<{
      name: string;
      classes: number;
      methods: number;
      lines: number;
      complexity?: number;
    }>;
  };
  /** PMD static analysis results. */
  pmd?: PmdReport;
  /** Checkstyle code style results. */
  checkstyle?: CheckstyleReport;
  /** OWASP CVE scan results. */
  owasp?: OwaspReport;
  /** PIT mutation testing results. */
  pitest?: PitestReport;
  /** SonarQube analysis results fetched live from the local SonarQube instance. */
  sonar?: SonarReport;
  /** Live runtime metadata. */
  runtime?: RuntimeReport;
  /** GitLab CI/CD pipeline history (last 10 runs). */
  pipeline?: PipelineReport;
  /** Remote git branches with last-commit date (up to 20, sorted by recency). */
  branches?: BranchesReport;
}

/** Remote git branches with last-commit date, from `git for-each-ref refs/remotes`. */
export interface BranchesReport {
  available: boolean;
  reason?: string;
  total?: number;
  branches?: Array<{
    name: string;
    lastCommit: string;
    author: string;
  }>;
}

/** GitLab CI/CD pipeline history fetched from the GitLab REST API. */
export interface PipelineReport {
  available: boolean;
  reason?: string;
  projectId?: string;
  host?: string;
  pipelines?: Array<{
    id: number;
    ref: string;
    status: string;
    createdAt: string;
    durationSeconds?: number;
    webUrl: string;
  }>;
}

/**
 * SonarQube analysis metrics returned by `/actuator/quality` sonar section.
 * Populated by the backend calling the SonarQube REST API — returns `available: false`
 * if SonarQube is unreachable, has no token, or the project key has no analysis yet.
 */
export interface SonarReport {
  /** True when a SonarQube instance was reachable and returned data for this project. */
  available: boolean;
  /** SonarQube project key (e.g., `'mirador'`). */
  projectKey?: string;
  /** Direct URL to the SonarQube project dashboard (used for "Open ↗" links). */
  url?: string;
  /** Number of bugs detected. */
  bugs?: number;
  /** Number of security vulnerabilities. */
  vulnerabilities?: number;
  /** Number of code smells (maintainability issues). */
  codeSmells?: number;
  /** Test coverage percentage as reported by SonarQube (from JaCoCo XML). */
  coverage?: number;
  /** Code duplication percentage. */
  duplications?: number;
  /** Total non-commented lines of code. */
  linesOfCode?: number;
  /** Reliability rating: A (0 bugs) through E (≥1 blocker). */
  reliabilityRating?: string;
  /** Security rating: A (0 vulnerabilities) through E (≥1 blocker). */
  securityRating?: string;
  /** Maintainability (technical debt) rating: A through E. */
  maintainabilityRating?: string;
}

/**
 * Descriptor for one raw Maven Site HTML report shown at the bottom of the Overview tab.
 * Each entry links to a static HTML file served by the nginx Maven site server (port 8084).
 */
export interface MavenSiteReport {
  /** Display label for the report link (e.g., `'JaCoCo Coverage'`). */
  label: string;
  /** Relative file path within the Maven site root (e.g., `'jacoco/index.html'`). */
  file: string;
  /** Emoji icon displayed beside the label. */
  icon: string;
}

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
})
export class QualityComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  /** Signal: the full quality report loaded from `/actuator/quality`. Null until first load. */
  report = signal<QualityReport | null>(null);

  /** Signal: true while the quality report HTTP request is in flight. */
  loading = signal(false);

  /** Signal: error message if the quality report could not be loaded. */
  error = signal<string | null>(null);

  /** Signal: currently active tab in the Quality page. */
  selectedTab = signal<string>('overview');

  /**
   * Signal: true when the Maven site nginx server (port 8084) responds.
   * Used to show "Detail ↗" links pointing to the full HTML reports.
   * Probed with a HEAD request every 10s until available or the page is destroyed.
   */
  mavenSiteAvailable = signal(false);

  /**
   * Signal: true when the Compodoc nginx server (port 8085) responds.
   * Used to show a "View Compodoc ↗" link in the Overview tab.
   */
  compodocAvailable = signal(false);

  /**
   * Signal: true when the SonarQube instance (port 9000) responds to a HEAD probe.
   * Used to determine whether to show the SonarQube dashboard link as active.
   * SonarQube can take ~2 min to start on first run (Elasticsearch initialization).
   */
  sonarAvailable = signal(false);

  // Polls every 10s until the nginx server responds — cleared once available or on destroy.
  private _mavenSiteRetryTimer: ReturnType<typeof setInterval> | null = null;
  private _compodocRetryTimer: ReturnType<typeof setInterval> | null = null;
  private _sonarRetryTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * List of Maven Site report HTML files shown as "Detail ↗" links in the Overview tab.
   * These are static HTML files generated by `mvn site` and served by nginx on port 8084.
   * The `file` path is appended to `mavenSiteBase` to form the full URL.
   */
  readonly mavenSiteReports: MavenSiteReport[] = [
    { label: 'Project Summary', file: 'index.html', icon: '📋' },
    { label: 'Surefire Tests', file: 'surefire.html', icon: '🧪' },
    { label: 'JaCoCo Coverage', file: 'jacoco/index.html', icon: '📊' },
    { label: 'SpotBugs', file: 'spotbugs.html', icon: '🐛' },
    { label: 'Mutation Testing', file: 'pit-reports/index.html', icon: '🧬' },
    { label: 'CVE Scan', file: 'dependency-check-report.html', icon: '🛡️' },
    { label: 'Javadoc', file: 'apidocs/index.html', icon: '📚' },
  ];

  /**
   * SonarQube projects list URL — shows both mirador (Java) and mirador-ui (Angular).
   * /projects lists all projects; /dashboard?id=X is single-project and would hide mirador-ui.
   */
  get sonarUrl(): string {
    return `${this.env.sonarUrl() ?? 'http://localhost:9000'}/projects`;
  }

  /** Direct SonarQube URL for the backend (Java) project. */
  get sonarBackendUrl(): string {
    return `${this.env.sonarUrl() ?? 'http://localhost:9000'}/dashboard?id=mirador`;
  }

  /** Direct SonarQube URL for the frontend (Angular) project. */
  get sonarFrontendUrl(): string {
    return `${this.env.sonarUrl() ?? 'http://localhost:9000'}/dashboard?id=mirador-ui`;
  }

  /** Base URL of the Maven site: dedicated nginx server if configured, backend fallback. */
  get mavenSiteBase(): string {
    return this.env.mavenSiteUrl() ?? `${this.env.baseUrl()}/maven-site`;
  }

  ngOnInit(): void {
    if (!this.auth.isAdmin()) return; // don't load if not admin
    this.loadReport();
    this.checkMavenSite();
    this.checkCompodoc();
    this.checkSonar();
  }

  ngOnDestroy(): void {
    this.clearMavenSiteRetry();
    this.clearCompodocRetry();
    this.clearSonarRetry();
  }

  loadReport(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<QualityReport>(`${this.env.baseUrl()}/actuator/quality`).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load quality report');
        this.loading.set(false);
      },
    });
  }

  /** Returns a CSS color class based on coverage percentage. */
  coverageColor(pct: number): string {
    if (pct >= 70) return 'good';
    if (pct >= 50) return 'warn';
    return 'bad';
  }

  /** Returns object entries from a Record for iteration in templates. */
  entries(obj: Record<string, number> | undefined): [string, number][] {
    if (!obj) return [];
    return Object.entries(obj);
  }

  /**
   * Map a severity string to a CSS color class for badge styling.
   * Accepts both CVSS severity names (CRITICAL/HIGH/MEDIUM) and numeric PMD priorities (1/2/3).
   *
   * @param severity Severity string or priority number.
   * @returns CSS class: `'bad'`=red, `'warn'`=orange, `'ok'`=green/gray.
   */
  severityColor(severity: string): string {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH' || s === '1') return 'bad';
    if (s === 'MEDIUM' || s === 'WARNING' || s === '2') return 'warn';
    return 'ok';
  }

  /**
   * Convert a numeric SpotBugs/PMD priority to a human-readable label.
   *
   * @param p Priority string: `'1'`, `'2'`, or other.
   * @returns `'High'`, `'Medium'`, or `'Low'`.
   */
  priorityLabel(p: string): string {
    return p === '1' ? 'High' : p === '2' ? 'Medium' : 'Low';
  }

  /**
   * Build the NVD (National Vulnerability Database) detail URL for a CVE ID.
   *
   * @param cve CVE identifier string (e.g., `'CVE-2023-12345'`).
   * @returns Full NVD URL for the CVE.
   */
  nvdUrl(cve: string): string {
    return `https://nvd.nist.gov/vuln/detail/${cve}`;
  }

  /**
   * Converts a git remote URL (SSH or HTTPS) to a browseable web URL.
   * e.g. git@gitlab.com:foo/bar.git  → https://gitlab.com/foo/bar
   *      https://gitlab.com/foo/bar  → https://gitlab.com/foo/bar
   */
  gitWebUrl(remoteUrl: string): string {
    // SSH format: git@host:path.git
    const ssh = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
    // HTTPS format: https://host/path.git
    return remoteUrl.replace(/\.git$/, '');
  }

  /** Returns the commit URL for a given hash on the git remote. */
  commitUrl(remoteUrl: string, hash: string): string {
    const base = this.gitWebUrl(remoteUrl);
    // GitLab and GitHub both use /-/commit/<hash>... but GitHub uses /commit/<hash>
    if (base.includes('gitlab')) return `${base}/-/commit/${hash}`;
    return `${base}/commit/${hash}`;
  }

  checkMavenSite(): void {
    // Probe the Maven site server (dedicated nginx at mavenSiteUrl, or backend fallback).
    // On failure, starts a 10s retry loop so the tab auto-updates once the server starts
    // (e.g. after running `./run.sh site`) without requiring a full page reload.
    this.clearMavenSiteRetry();
    this.http
      .get(`${this.mavenSiteBase}/index.html`, {
        responseType: 'text',
        observe: 'response',
      })
      .subscribe({
        next: () => {
          this.mavenSiteAvailable.set(true);
          this.clearMavenSiteRetry(); // stop polling once the server is reachable
        },
        error: () => {
          this.mavenSiteAvailable.set(false);
          // Retry every 10s — mirrors the Docker API retry in DashboardComponent.
          if (!this._mavenSiteRetryTimer) {
            this._mavenSiteRetryTimer = setInterval(() => this.checkMavenSite(), 10_000);
          }
        },
      });
  }

  private clearMavenSiteRetry(): void {
    if (this._mavenSiteRetryTimer !== null) {
      clearInterval(this._mavenSiteRetryTimer);
      this._mavenSiteRetryTimer = null;
    }
  }

  /** Probes the Compodoc nginx server with 10s retry (same pattern as checkMavenSite). */
  checkCompodoc(): void {
    const url = this.env.compodocUrl();
    if (!url) return;
    this.clearCompodocRetry();
    this.http.get(`${url}/index.html`, { responseType: 'text', observe: 'response' }).subscribe({
      next: () => {
        this.compodocAvailable.set(true);
        this.clearCompodocRetry();
      },
      error: () => {
        this.compodocAvailable.set(false);
        if (!this._compodocRetryTimer) {
          this._compodocRetryTimer = setInterval(() => this.checkCompodoc(), 10_000);
        }
      },
    });
  }

  private clearCompodocRetry(): void {
    if (this._compodocRetryTimer !== null) {
      clearInterval(this._compodocRetryTimer);
      this._compodocRetryTimer = null;
    }
  }

  /**
   * Probes the SonarQube instance with a HEAD request.
   * SonarQube takes ~2 min to start on first run (Elasticsearch init);
   * this retries every 10s so the UI recovers automatically.
   */
  checkSonar(): void {
    const url = this.env.sonarUrl();
    if (!url) return;
    this.clearSonarRetry();
    // Probe /api/system/status — returns 200 JSON regardless of auth
    this.http.get(`${url}/api/system/status`, { observe: 'response' }).subscribe({
      next: () => {
        this.sonarAvailable.set(true);
        this.clearSonarRetry();
      },
      error: () => {
        this.sonarAvailable.set(false);
        if (!this._sonarRetryTimer) {
          this._sonarRetryTimer = setInterval(() => this.checkSonar(), 10_000);
        }
      },
    });
  }

  private clearSonarRetry(): void {
    if (this._sonarRetryTimer !== null) {
      clearInterval(this._sonarRetryTimer);
      this._sonarRetryTimer = null;
    }
  }
}
