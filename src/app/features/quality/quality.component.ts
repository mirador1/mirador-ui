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
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';

export interface SlowTest {
  name: string;
  time: string;
  timeMs: number;
}

export interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: string;
}

export interface TestsReport {
  available: boolean;
  status?: 'PASSED' | 'FAILED';
  total?: number;
  passed?: number;
  failures?: number;
  errors?: number;
  skipped?: number;
  time?: string;
  runAt?: string;
  suites?: TestSuite[];
  slowestTests?: SlowTest[];
}

export interface Counter {
  covered: number;
  total: number;
  pct: number;
}

export interface PackageCoverage {
  name: string;
  instructionPct: number;
  linePct: number;
}

export interface CoverageReport {
  available: boolean;
  instructions?: Counter;
  branches?: Counter;
  lines?: Counter;
  methods?: Counter;
  packages?: PackageCoverage[];
}

export interface BugItem {
  category: string;
  priority: string;
  type: string;
  className: string;
}

export interface BugsReport {
  available: boolean;
  total?: number;
  byCategory?: Record<string, number>;
  byPriority?: Record<string, number>;
  items?: BugItem[];
}

export interface BuildReport {
  available: boolean;
  artifact?: string;
  version?: string;
  time?: string;
  javaVersion?: string;
  springBootVersion?: string;
}

export interface PmdViolation {
  file: string;
  rule: string;
  ruleset: string;
  priority: string;
  message: string;
}
export interface PmdReport {
  available: boolean;
  total?: number;
  byRuleset?: Record<string, number>;
  byPriority?: Record<string, number>;
  topRules?: Array<{ rule: string; count: number }>;
  violations?: PmdViolation[];
}

export interface CheckstyleViolation {
  file: string;
  line: string;
  severity: string;
  checker: string;
  message: string;
}
export interface CheckstyleReport {
  available: boolean;
  total?: number;
  bySeverity?: Record<string, number>;
  topCheckers?: Array<{ checker: string; count: number }>;
  violations?: CheckstyleViolation[];
}

export interface OwaspVuln {
  cve: string;
  severity: string;
  score: number;
  dependency: string;
  description: string;
}
export interface OwaspReport {
  available: boolean;
  total?: number;
  bySeverity?: Record<string, number>;
  vulnerabilities?: OwaspVuln[];
}

export interface JarLayer {
  name: string;
  entries: number;
}

export interface RuntimeReport {
  available: boolean;
  activeProfiles?: string[];
  uptimeSeconds?: number;
  uptimeHuman?: string;
  startedAt?: string;
  jarLayers?: JarLayer[];
}

export interface PitestMutation {
  class: string;
  method: string;
  mutator: string;
  description: string;
}
export interface PitestReport {
  available: boolean;
  note?: string;
  total?: number;
  killed?: number;
  survived?: number;
  noCoverage?: number;
  score?: number;
  byStatus?: Record<string, number>;
  byMutator?: Record<string, number>;
  survivingMutations?: PitestMutation[];
}

export interface QualityReport {
  generatedAt: string;
  tests: TestsReport;
  coverage: CoverageReport;
  bugs: BugsReport;
  build: BuildReport;
  git?: {
    available: boolean;
    remoteUrl?: string;
    commits?: Array<{ hash: string; author: string; date: string; message: string }>;
  };
  api?: {
    available: boolean;
    total?: number;
    endpoints?: Array<{ path: string; methods: string[]; handler: string }>;
  };
  dependencies?: {
    available: boolean;
    total?: number;
    dependencies?: Array<{ groupId: string; artifactId: string; version: string; scope: string }>;
  };
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
  pmd?: PmdReport;
  checkstyle?: CheckstyleReport;
  owasp?: OwaspReport;
  pitest?: PitestReport;
  runtime?: RuntimeReport;
}

// Each entry in the Maven Site raw-reports section of the Overview tab.
export interface MavenSiteReport {
  label: string;
  file: string;
  icon: string;
}

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
})
export class QualityComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  report = signal<QualityReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedTab = signal<string>('overview');
  mavenSiteAvailable = signal(false);
  compodocAvailable = signal(false);

  // Polls every 10s until the nginx server responds — cleared once available or on destroy.
  private _mavenSiteRetryTimer: ReturnType<typeof setInterval> | null = null;
  private _compodocRetryTimer: ReturnType<typeof setInterval> | null = null;

  // Raw reports available in the Maven Site (static HTML generated by mvn site).
  // Shown at the bottom of the Overview tab with a "Detail ↗" link per report.
  readonly mavenSiteReports: MavenSiteReport[] = [
    { label: 'Project Summary', file: 'index.html', icon: '📋' },
    { label: 'Surefire Tests', file: 'surefire.html', icon: '🧪' },
    { label: 'JaCoCo Coverage', file: 'jacoco/index.html', icon: '📊' },
    { label: 'SpotBugs', file: 'spotbugs.html', icon: '🐛' },
    { label: 'Mutation Testing', file: 'pit-reports/index.html', icon: '🧬' },
    { label: 'CVE Scan', file: 'dependency-check-report.html', icon: '🛡️' },
    { label: 'Javadoc', file: 'apidocs/index.html', icon: '📚' },
  ];

  /** Base URL of the Maven site: dedicated nginx server if configured, backend fallback. */
  get mavenSiteBase(): string {
    return this.env.mavenSiteUrl() ?? `${this.env.baseUrl()}/maven-site`;
  }

  ngOnInit(): void {
    if (!this.auth.isAdmin()) return; // don't load if not admin
    this.loadReport();
    this.checkMavenSite();
    this.checkCompodoc();
  }

  ngOnDestroy(): void {
    this.clearMavenSiteRetry();
    this.clearCompodocRetry();
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

  severityColor(severity: string): string {
    const s = severity.toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH' || s === '1') return 'bad';
    if (s === 'MEDIUM' || s === 'WARNING' || s === '2') return 'warn';
    return 'ok';
  }

  priorityLabel(p: string): string {
    return p === '1' ? 'High' : p === '2' ? 'Medium' : 'Low';
  }

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
}
