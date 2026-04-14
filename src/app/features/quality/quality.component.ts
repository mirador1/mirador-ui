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
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';

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
    packages?: Array<{ name: string; classes: number; methods: number; lines: number }>;
  };
}

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
})
export class QualityComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  report = signal<QualityReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.auth.isAdmin()) return; // don't load if not admin
    this.loadReport();
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
}
