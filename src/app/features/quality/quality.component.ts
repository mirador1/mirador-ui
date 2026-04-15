/**
 * QualityComponent — Maven quality report page.
 *
 * Displays a comprehensive build quality report sourced from /actuator/quality:
 * - Test results (Surefire) with per-suite breakdown
 * - Code coverage (JaCoCo) with per-package bars
 * - Static analysis (SpotBugs) bug list
 * - Build metadata (artifact, version, timestamps)
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [DecimalPipe],
  // DomSanitizer is not imported as a module — it is injected directly as a service.
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
})
export class QualityComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(AuthService);

  report = signal<QualityReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedTab = signal<string>('overview');
  mavenSiteAvailable = signal(false);

  // Resolved base URL for the Maven site — prefers the dedicated nginx server (port 8083)
  // over the backend's /maven-site/ fallback. The dedicated server has an independent
  // lifecycle (regenerated daily by CI) and avoids serving reports through the app server.
  // SafeResourceUrl is required by Angular to allow iframes pointing to external origins.
  get mavenSiteIframeSrc(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${this.mavenSiteBase}/index.html`);
  }

  /** Base URL of the Maven site: dedicated nginx server if configured, backend fallback. */
  get mavenSiteBase(): string {
    return this.env.mavenSiteUrl() ?? `${this.env.baseUrl()}/maven-site`;
  }

  ngOnInit(): void {
    if (!this.auth.isAdmin()) return; // don't load if not admin
    this.loadReport();
    this.checkMavenSite();
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

  checkMavenSite(): void {
    // Probe the Maven site server (dedicated nginx at mavenSiteUrl, or backend fallback).
    this.http
      .get(`${this.mavenSiteBase}/index.html`, {
        responseType: 'text',
        observe: 'response',
      })
      .subscribe({
        next: () => this.mavenSiteAvailable.set(true),
        error: () => this.mavenSiteAvailable.set(false),
      });
  }
}
