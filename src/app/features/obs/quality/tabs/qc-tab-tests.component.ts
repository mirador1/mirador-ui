import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { CoverageReport, TestsReport } from '../quality.component';
import { coverageColor } from '../quality-helpers';

/**
 * Tests tab — Surefire test results + JaCoCo per-package coverage.
 * The 2 sections share a theme "how well the code is tested" and always
 * appear together. Takes 2 sub-trees + mavenSite signals as inputs.
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 */
@Component({
  selector: 'app-qt-tests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  styleUrl: '../quality.component.scss',
  template: `
    @let tests = testsReport();
    @let coverage = coverageReport();
    @let siteBase = mavenSiteBase();
    <!-- ================================================================== -->
    <!-- TESTS SECTION -->
    <!-- ================================================================== -->
    @if (mavenSiteAvailable()) {
      <div class="tab-maven-bar">
        <span class="tab-maven-bar-label">Full report:</span>
        <a
          class="tab-maven-link"
          [href]="siteBase + '/surefire.html'"
          target="_blank"
          rel="noopener"
          >Surefire Tests ↗</a
        >
        <a
          class="tab-maven-link"
          [href]="siteBase + '/jacoco/index.html'"
          target="_blank"
          rel="noopener"
          >JaCoCo Coverage ↗</a
        >
      </div>
    }
    @if (tests.available) {
      <section class="quality-section">
        <h3>
          <span class="section-icon">🧪</span>
          Test Results
          <span
            class="section-badge"
            [class.badge-pass]="tests.status === 'PASSED'"
            [class.badge-fail]="tests.status === 'FAILED'"
          >
            {{ tests.status }}
          </span>
        </h3>

        <div class="test-summary-line">
          <span
            ><strong>{{ tests.total }}</strong> tests</span
          >
          <span class="sep">·</span>
          <span class="pct-good"
            ><strong>{{ tests.passed }}</strong> passed</span
          >
          @if (tests.failures! > 0) {
            <span class="sep">·</span>
            <span class="pct-bad"
              ><strong>{{ tests.failures }}</strong> failed</span
            >
          }
          @if (tests.errors! > 0) {
            <span class="sep">·</span>
            <span class="pct-bad"
              ><strong>{{ tests.errors }}</strong> errors</span
            >
          }
          @if (tests.skipped! > 0) {
            <span class="sep">·</span>
            <span
              class="pct-warn"
              title="ArchUnit tests are disabled on Java 25+ (class file v69 not supported by ArchUnit 1.4.x)"
              ><strong>{{ tests.skipped }}</strong> skipped ⓘ</span
            >
          }
          <span class="sep">·</span>
          <span>⏱ {{ tests.time }}</span>
        </div>

        <div class="table-wrap">
          <table class="quality-table">
            <thead>
              <tr>
                <th>Suite</th>
                <th class="num-col">Tests</th>
                <th class="num-col">Passed</th>
                <th class="num-col">Failed</th>
                <th class="num-col">Skipped</th>
                <th class="num-col">Time</th>
              </tr>
            </thead>
            <tbody>
              @for (suite of tests.suites; track suite.name) {
                <tr [class.row-fail]="suite.failures > 0 || suite.errors > 0">
                  <td class="suite-name">{{ suite.name }}</td>
                  <td class="num-col">{{ suite.tests }}</td>
                  <td class="num-col pct-good">
                    {{ suite.tests - suite.failures - suite.errors - suite.skipped }}
                  </td>
                  <td class="num-col" [class.pct-bad]="suite.failures > 0 || suite.errors > 0">
                    {{ suite.failures + suite.errors }}
                  </td>
                  <td class="num-col" [class.pct-warn]="suite.skipped > 0">
                    {{ suite.skipped }}
                  </td>
                  <td class="num-col muted">{{ suite.time }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (tests.slowestTests && tests.slowestTests.length > 0) {
          <h4 style="margin-top: 1rem">🐢 Slowest Tests (top 10)</h4>
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th class="num-col" style="width: 7em">Duration</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tests.slowestTests; track t.name) {
                  <tr>
                    <td class="muted" style="font-size: 0.78rem">{{ t.name }}</td>
                    <td
                      class="num-col"
                      [class.pct-warn]="t.timeMs > 1000"
                      [class.pct-bad]="t.timeMs > 5000"
                    >
                      {{ t.time }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }

    <!-- ================================================================== -->
    <!-- COVERAGE SECTION -->
    <!-- ================================================================== -->
    @if (coverage.available) {
      <section class="quality-section">
        <h3>
          <span class="section-icon">📊</span>
          Code Coverage
        </h3>

        <!-- Global counters row -->
        <div class="coverage-counters">
          @for (
            counter of [
              { label: 'Instructions', data: coverage.instructions! },
              { label: 'Branches', data: coverage.branches! },
              { label: 'Lines', data: coverage.lines! },
              { label: 'Methods', data: coverage.methods! },
            ];
            track counter.label
          ) {
            <div class="counter-card">
              <div class="counter-label">{{ counter.label }}</div>
              <div class="counter-pct" [class]="'pct-' + covColor(counter.data.pct)">
                {{ counter.data.pct | number: '1.1-1' }}%
              </div>
              <div class="counter-abs">{{ counter.data.covered }} / {{ counter.data.total }}</div>
              <svg class="coverage-bar" viewBox="0 0 100 5" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="5" fill="#e5e7eb" rx="2" />
                <rect
                  x="0"
                  y="0"
                  [attr.width]="counter.data.pct"
                  height="5"
                  [attr.fill]="
                    counter.data.pct >= 70
                      ? '#22c55e'
                      : counter.data.pct >= 50
                        ? '#f59e0b'
                        : '#ef4444'
                  "
                  rx="2"
                />
              </svg>
            </div>
          }
        </div>

        <!-- Per-package table -->
        @if (coverage.packages && coverage.packages.length > 0) {
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th class="num-col">Instructions %</th>
                  <th class="pct-col">Line Coverage</th>
                  <th class="num-col">Lines %</th>
                </tr>
              </thead>
              <tbody>
                @for (pkg of coverage.packages; track pkg.name) {
                  <tr class="pkg-row">
                    <td class="pkg-name">{{ pkg.name }}</td>
                    <td class="num-col" [class]="'pct-' + covColor(pkg.instructionPct)">
                      {{ pkg.instructionPct | number: '1.1-1' }}%
                    </td>
                    <td class="pct-col">
                      <svg viewBox="0 0 100 8" class="pkg-bar" preserveAspectRatio="none">
                        <rect x="0" y="0" width="100" height="8" fill="#e5e7eb" rx="3" />
                        <rect
                          x="0"
                          y="0"
                          [attr.width]="pkg.linePct"
                          height="8"
                          [attr.fill]="
                            pkg.linePct >= 70
                              ? '#22c55e'
                              : pkg.linePct >= 50
                                ? '#f59e0b'
                                : '#ef4444'
                          "
                          rx="3"
                        />
                      </svg>
                    </td>
                    <td class="num-col" [class]="'pct-' + covColor(pkg.linePct)">
                      {{ pkg.linePct | number: '1.1-1' }}%
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class QcTabTestsComponent {
  readonly testsReport = input.required<TestsReport>();
  readonly coverageReport = input.required<CoverageReport>();
  readonly mavenSiteAvailable = input<boolean>(false);
  readonly mavenSiteBase = input<string>('');

  readonly covColor = coverageColor;
}
