import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { QualityReport } from '../quality.component';
import { coverageColor } from '../quality-helpers';

/**
 * Overview tab — at-a-glance status cards for every quality dimension.
 * Touches 9 sub-trees of the report (tests, coverage, bugs, build, pmd,
 * checkstyle, owasp, pitest, runtime) — simpler to take the whole
 * report as input than 9 individual sub-trees. Uses `@let r = report()`
 * at template top so the extracted body reads identical to the inline
 * version.
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 * Last of 9 tabs completing Phase B-5. Parent template shrinks from
 * 1708 LOC to ~150 LOC (tab-switch glue + page-header shell).
 */
@Component({
  selector: 'app-qt-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  styleUrl: '../quality.component.scss',
  template: `
    @let r = report();
    @if (r) {
      <!-- OVERVIEW TAB — at-a-glance status for all quality dimensions       -->
      <!-- ================================================================== -->

      <!-- Primary cards: tests, coverage, bugs, build -->
      <div class="summary-row">
        <div
          class="summary-card summary-card-link"
          [class.card-pass]="r.tests.status === 'PASSED'"
          [class.card-fail]="r.tests.status === 'FAILED'"
          (click)="tabSelected.emit('tests')"
          title="Go to Tests & Coverage"
        >
          <div class="card-label">Tests</div>
          @if (r.tests.available) {
            <div class="card-value">
              <span
                class="badge"
                [class.badge-pass]="r.tests.status === 'PASSED'"
                [class.badge-fail]="r.tests.status === 'FAILED'"
                >{{ r.tests.status }}</span
              >
            </div>
            <div class="card-sub">{{ r.tests.passed }} / {{ r.tests.total }} passed</div>
            @if (r.tests.skipped && r.tests.skipped > 0) {
              <div class="card-hint">{{ r.tests.skipped }} skipped</div>
            }
          } @else {
            <div class="card-value card-na">N/A</div>
            <div class="card-hint">No test reports found</div>
          }
        </div>

        <div
          class="summary-card summary-card-link"
          (click)="tabSelected.emit('tests')"
          title="Go to Tests & Coverage"
        >
          <div class="card-label">Coverage</div>
          @if (r.coverage.available) {
            <div class="card-value" [class]="'pct-' + covColor(r.coverage.instructions!.pct)">
              {{ r.coverage.instructions!.pct | number: '1.1-1' }}%
            </div>
            <div class="card-sub">instructions</div>
            <div class="coverage-bar-wrap">
              <svg class="coverage-bar" viewBox="0 0 100 6" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="6" fill="#e5e7eb" rx="3" />
                <rect
                  x="0"
                  y="0"
                  [attr.width]="r.coverage.instructions!.pct"
                  height="6"
                  [attr.fill]="
                    r.coverage.instructions!.pct >= 70
                      ? '#22c55e'
                      : r.coverage.instructions!.pct >= 50
                        ? '#f59e0b'
                        : '#ef4444'
                  "
                  rx="3"
                />
              </svg>
            </div>
          } @else {
            <div class="card-value card-na">N/A</div>
            <div class="card-hint">No coverage data</div>
          }
        </div>

        <div
          class="summary-card summary-card-link"
          [class.card-pass]="r.bugs.available && r.bugs.total === 0"
          [class.card-fail]="r.bugs.available && r.bugs.total! > 0"
          (click)="tabSelected.emit('analysis')"
          title="Go to Static Analysis"
        >
          <div class="card-label">SpotBugs</div>
          @if (r.bugs.available) {
            <div
              class="card-value"
              [class.pct-good]="r.bugs.total === 0"
              [class.pct-bad]="r.bugs.total! > 0"
            >
              {{ r.bugs.total }}
            </div>
            <div class="card-sub">{{ r.bugs.total === 0 ? 'No bugs found' : 'bugs found' }}</div>
          } @else {
            <div class="card-value card-na">N/A</div>
            <div class="card-hint">No SpotBugs report</div>
          }
        </div>

        <div
          class="summary-card summary-card-link"
          (click)="tabSelected.emit('build')"
          title="Go to Build"
        >
          <div class="card-label">Build</div>
          @if (r.build.available) {
            <div class="card-value build-version">{{ r.build.version }}</div>
            <div class="card-sub">{{ r.build.artifact }}</div>
            <div class="card-hint">{{ r.build.time }}</div>
          } @else {
            <div class="card-value card-na">N/A</div>
            <div class="card-hint">No build info</div>
          }
        </div>
      </div>

      <!-- Secondary cards: static analysis, security, mutation, runtime (shown when data is available) -->
      @if (
        r.pmd?.available ||
        r.checkstyle?.available ||
        r.owasp?.available ||
        r.pitest?.available ||
        r.runtime?.available
      ) {
        <div class="summary-row summary-row-secondary">
          @if (r.pmd) {
            <div
              class="summary-card summary-card-sm summary-card-link"
              (click)="tabSelected.emit('analysis')"
              title="Go to Analysis"
              [class.card-pass]="r.pmd.available && r.pmd.total === 0"
              [class.card-fail]="r.pmd.available && r.pmd.total! > 0"
            >
              <div class="card-label">PMD</div>
              @if (r.pmd.available) {
                <div
                  class="card-value"
                  [class.pct-good]="r.pmd.total === 0"
                  [class.pct-bad]="r.pmd.total! > 0"
                >
                  {{ r.pmd.total }}
                </div>
                <div class="card-sub">
                  {{ r.pmd.total === 0 ? 'No violations' : 'violations' }}
                </div>
              } @else {
                <div class="card-value card-na">N/A</div>
                <div class="card-hint">Requires Java ≤21</div>
              }
            </div>
          }

          @if (r.checkstyle) {
            <div
              class="summary-card summary-card-sm summary-card-link"
              (click)="tabSelected.emit('analysis')"
              title="Go to Analysis"
              [class.card-pass]="r.checkstyle.available && r.checkstyle.total === 0"
              [class.card-fail]="r.checkstyle.available && r.checkstyle.total! > 0"
            >
              <div class="card-label">Checkstyle</div>
              @if (r.checkstyle.available) {
                <div
                  class="card-value"
                  [class.pct-good]="r.checkstyle.total === 0"
                  [class.pct-bad]="r.checkstyle.total! > 0"
                >
                  {{ r.checkstyle.total }}
                </div>
                <div class="card-sub">
                  {{ r.checkstyle.total === 0 ? 'No violations' : 'violations' }}
                </div>
              } @else {
                <div class="card-value card-na">N/A</div>
                <div class="card-hint">Requires Java ≤21</div>
              }
            </div>
          }

          @if (r.owasp) {
            <div
              class="summary-card summary-card-sm summary-card-link"
              (click)="tabSelected.emit('security')"
              title="Go to Security"
              [class.card-pass]="r.owasp.available && r.owasp.total === 0"
              [class.card-fail]="r.owasp.available && r.owasp.total! > 0"
            >
              <div class="card-label">OWASP CVEs</div>
              @if (r.owasp.available) {
                <div
                  class="card-value"
                  [class.pct-good]="r.owasp.total === 0"
                  [class.pct-bad]="r.owasp.total! > 0"
                >
                  {{ r.owasp.total }}
                </div>
                <div class="card-sub">{{ r.owasp.total === 0 ? 'No CVEs' : 'CVEs found' }}</div>
              } @else {
                <div class="card-value card-na">N/A</div>
                <div class="card-hint">Run ./run.sh security-check</div>
              }
            </div>
          }

          @if (r.pitest) {
            <div
              class="summary-card summary-card-sm summary-card-link"
              (click)="tabSelected.emit('mutation')"
              title="Go to Mutation"
              [class.card-pass]="r.pitest.available && r.pitest.score! >= 70"
              [class.card-fail]="r.pitest.available && r.pitest.score! < 50"
            >
              <div class="card-label">Mutation</div>
              @if (r.pitest.available) {
                <div class="card-value" [class]="'pct-' + covColor(r.pitest.score!)">
                  {{ r.pitest.score | number: '1.1-1' }}%
                </div>
                <div class="card-sub">{{ r.pitest.killed }} / {{ r.pitest.total }} killed</div>
              } @else {
                <div class="card-value card-na">N/A</div>
                <div class="card-hint">{{ r.pitest.note ?? 'Run pitest' }}</div>
              }
            </div>
          }

          @if (r.runtime?.available) {
            <div
              class="summary-card summary-card-sm summary-card-link"
              (click)="tabSelected.emit('runtime')"
              title="Go to Runtime"
            >
              <div class="card-label">Runtime</div>
              <div class="card-value" style="font-size: 0.9rem">
                @for (profile of r.runtime!.activeProfiles; track profile) {
                  <span class="badge badge-profile">{{ profile }}</span>
                }
                @if (!r.runtime!.activeProfiles?.length) {
                  <span class="muted">default</span>
                }
              </div>
              <div class="card-sub">{{ r.runtime!.uptimeHuman }}</div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class QcTabOverviewComponent {
  readonly report = input.required<QualityReport>();
  /**
   * Emitted when a summary card is clicked — parent listens and updates its
   * `selectedTab` signal. Keeps the overview child decoupled from the parent's
   * tab-state signal (inputs/outputs only, no direct signal access).
   */
  readonly tabSelected = output<string>();

  readonly covColor = coverageColor;
}
