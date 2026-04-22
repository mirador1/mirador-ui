import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { QualityReport } from '../quality.component';
import { commitUrl, coverageColor, entriesOf, severityColor } from '../quality-helpers';

/**
 * Mutation tab — groups 6 sub-sections under a historical "mutation" key:
 * PITEST mutation testing, git log, API endpoints, pom dependencies,
 * licenses, per-package metrics. The grouping predates Phase B-5; the
 * selectedTab key stays `'mutation'` to preserve deep-link URLs.
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 * The tab spans too many sub-trees to pass them individually cleanly,
 * so it takes the whole report via `@let r = report()` at template top.
 */
@Component({
  selector: 'app-qt-mutation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  styleUrl: '../quality.component.scss',
  template: `
    @let r = report();
    @if (r) {
      <!-- ================================================================== -->
      <!-- PITEST MUTATION TESTING SECTION -->
      <!-- ================================================================== -->
      @if (mavenSiteAvailable()) {
        <div class="tab-maven-bar">
          <span class="tab-maven-bar-label">Full report:</span>
          <a
            class="tab-maven-link"
            [href]="mavenSiteBase() + '/pit-reports/index.html'"
            target="_blank"
            rel="noopener"
            >Mutation Testing (PIT) ↗</a
          >
        </div>
      }
      @if (r.pitest) {
        <section class="quality-section">
          <h3>
            <span class="section-icon">🧬</span>
            Mutation Testing (PIT)
            @if (r.pitest.available) {
              <span class="section-count">{{ r.pitest.score }}% mutation score</span>
              <span
                class="section-badge"
                [class.badge-pass]="r.pitest.score! >= 70"
                [class.badge-warn]="r.pitest.score! >= 50 && r.pitest.score! < 70"
                [class.badge-fail]="r.pitest.score! < 50"
              >
                {{ r.pitest.score! >= 70 ? 'GOOD' : r.pitest.score! >= 50 ? 'WEAK' : 'POOR' }}
              </span>
            }
          </h3>

          @if (!r.pitest.available) {
            <div class="info-card">
              ℹ {{ r.pitest.note ?? 'Run: mvn test-compile pitest:mutationCoverage' }}
            </div>
          } @else {
            <!-- Score bar -->
            <div class="coverage-counters" style="margin-bottom: 1rem">
              <div class="counter-card">
                <div class="counter-label">Mutation Score</div>
                <div class="counter-pct" [class]="'pct-' + covColor(r.pitest.score!)">
                  {{ r.pitest.score | number: '1.1-1' }}%
                </div>
                <div class="counter-abs">{{ r.pitest.killed }} / {{ r.pitest.total }} killed</div>
                <svg class="coverage-bar" viewBox="0 0 100 5" preserveAspectRatio="none">
                  <rect x="0" y="0" width="100" height="5" fill="#e5e7eb" rx="2" />
                  <rect
                    x="0"
                    y="0"
                    [attr.width]="r.pitest.score"
                    height="5"
                    [attr.fill]="
                      r.pitest.score! >= 70
                        ? '#22c55e'
                        : r.pitest.score! >= 50
                          ? '#f59e0b'
                          : '#ef4444'
                    "
                    rx="2"
                  />
                </svg>
              </div>
              <div class="counter-card">
                <div class="counter-label">Survived</div>
                <div class="counter-pct" [class.pct-bad]="r.pitest.survived! > 0">
                  {{ r.pitest.survived }}
                </div>
                <div class="counter-abs">need more tests</div>
              </div>
              <div class="counter-card">
                <div class="counter-label">No Coverage</div>
                <div class="counter-pct pct-warn">{{ r.pitest.noCoverage }}</div>
                <div class="counter-abs">uncovered code</div>
              </div>
            </div>

            @if (r.pitest.survivingMutations && r.pitest.survivingMutations.length > 0) {
              <h4>Surviving Mutations (write tests to kill these)</h4>
              <div class="table-wrap">
                <table class="quality-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Method</th>
                      <th>Mutator</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of r.pitest.survivingMutations; track $index) {
                      <tr>
                        <td>{{ m.class }}</td>
                        <td class="muted">{{ m.method }}</td>
                        <td>
                          <span class="badge badge-warn">{{ m.mutator }}</span>
                        </td>
                        <td style="font-size: 0.78rem">{{ m.description }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </section>
      }

      <!-- ================================================================== -->
      <!-- GIT SECTION -->
      <!-- ================================================================== -->
      @if (r.git?.available) {
        <section class="quality-section">
          <h3>
            <span class="section-icon">🔀</span> Git History
            <span class="section-count">{{ r.git!.commits?.length }} commits</span>
          </h3>
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th style="width: 6em">Hash</th>
                  <th style="width: 10em">Date</th>
                  <th style="width: 10em">Author</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                @for (commit of r.git!.commits; track commit.hash) {
                  <tr>
                    <td>
                      @if (r.git!.remoteUrl) {
                        <a
                          [href]="commitUrl(r.git!.remoteUrl!, commit.hash)"
                          target="_blank"
                          rel="noopener"
                          class="hash-link"
                          ><code class="hash">{{ commit.hash }}</code></a
                        >
                      } @else {
                        <code class="hash">{{ commit.hash }}</code>
                      }
                    </td>
                    <td class="muted">{{ commit.date }}</td>
                    <td>{{ commit.author }}</td>
                    <td>{{ commit.message }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- ================================================================== -->
      <!-- API SECTION -->
      <!-- ================================================================== -->
      @if (r.api?.available) {
        <section class="quality-section">
          <h3>
            <span class="section-icon">🌐</span> API Surface
            <span class="section-count">{{ r.api!.total }} endpoints</span>
          </h3>
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th style="width: 8em">Methods</th>
                  <th>Handler</th>
                </tr>
              </thead>
              <tbody>
                @for (ep of r.api!.endpoints; track ep.path) {
                  <tr>
                    <td class="ep-path">{{ ep.path }}</td>
                    <td>
                      @for (m of ep.methods; track m) {
                        <span class="method-badge method-{{ m.toLowerCase() }}">{{ m }}</span>
                      }
                    </td>
                    <td class="muted">{{ ep.handler }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <!-- ================================================================== -->
      <!-- DEPENDENCIES SECTION -->
      <!-- ================================================================== -->
      @if (r.dependencies?.available) {
        <section class="quality-section">
          <h3>
            <span class="section-icon">📦</span> Dependencies
            <span class="section-count">{{ r.dependencies!.total }} direct</span>
            @if (r.dependencies!.outdatedCount) {
              <span class="badge badge-warn">{{ r.dependencies!.outdatedCount }} outdated</span>
            }
          </h3>
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Artifact</th>
                  <th>Version</th>
                  <th>Latest</th>
                  <th style="width: 7em">Scope</th>
                </tr>
              </thead>
              <tbody>
                @for (dep of r.dependencies!.dependencies; track dep.artifactId) {
                  <tr [class.row-outdated]="dep.outdated">
                    <td class="muted">{{ dep.groupId }}</td>
                    <td>
                      <strong>{{ dep.artifactId }}</strong>
                    </td>
                    <td>
                      {{ dep.version }}
                      @if (dep.outdated) {
                        <span class="badge badge-warn" title="Newer version available">⬆</span>
                      }
                    </td>
                    <td class="muted">
                      @if (dep.latestVersion && dep.outdated) {
                        <span class="latest-version">{{ dep.latestVersion }}</span>
                      } @else if (dep.latestVersion) {
                        <span class="muted">✓</span>
                      }
                    </td>
                    <td>
                      <span class="scope-badge scope-{{ dep.scope }}">{{ dep.scope }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (r.dependencies!.dependencyTree?.available) {
            <h4>
              Dependency Tree
              @if (r.dependencies!.dependencyTree!.totalTransitive) {
                <span class="section-count"
                  >{{ r.dependencies!.dependencyTree!.totalTransitive }} transitive</span
                >
              }
            </h4>
            <pre class="dep-tree">{{ r.dependencies!.dependencyTree!.tree }}</pre>
          }

          @if (r.dependencies!.dependencyAnalysis?.available) {
            <h4>
              Dependency Analysis
              @if (r.dependencies!.dependencyAnalysis!.usedUndeclaredCount) {
                <span class="badge badge-warn"
                  >{{
                    r.dependencies!.dependencyAnalysis!.usedUndeclaredCount
                  }}
                  used-undeclared</span
                >
              }
              @if (r.dependencies!.dependencyAnalysis!.unusedDeclaredCount) {
                <span class="badge badge-info"
                  >{{
                    r.dependencies!.dependencyAnalysis!.unusedDeclaredCount
                  }}
                  unused-declared</span
                >
              }
            </h4>
            @if (r.dependencies!.dependencyAnalysis!.usedUndeclaredCount) {
              <p class="analyze-label warn">
                ⚠ Used but not declared — these are pulled in transitively and may break if the
                providing dependency is removed:
              </p>
              <ul class="dep-analyze-list">
                @for (dep of r.dependencies!.dependencyAnalysis!.usedUndeclared; track dep) {
                  <li class="dep-coord warn">{{ dep }}</li>
                }
              </ul>
            }
            @if (r.dependencies!.dependencyAnalysis!.unusedDeclaredCount) {
              <p class="analyze-label info">
                ℹ Declared but not used — candidates for removal from pom.xml:
              </p>
              <ul class="dep-analyze-list">
                @for (dep of r.dependencies!.dependencyAnalysis!.unusedDeclared; track dep) {
                  <li class="dep-coord info">{{ dep }}</li>
                }
              </ul>
            }
            @if (
              !r.dependencies!.dependencyAnalysis!.usedUndeclaredCount &&
              !r.dependencies!.dependencyAnalysis!.unusedDeclaredCount
            ) {
              <p class="analyze-clean">✅ No dependency issues detected.</p>
            }
          }
        </section>
      }

      <!-- ================================================================== -->
      <!-- LICENSES SECTION -->
      <!-- ================================================================== -->
      @if (r.licenses?.available) {
        <section class="quality-section">
          <h3>
            <span class="section-icon">⚖️</span> License Compliance
            @if (r.licenses!.total) {
              <span class="section-count">{{ r.licenses!.total }} deps</span>
            }
            @if (r.licenses!.incompatibleCount) {
              <span class="badge badge-error"
                >{{ r.licenses!.incompatibleCount }} incompatible</span
              >
            }
          </h3>

          @if (r.licenses!.licenses?.length) {
            <h4>License Distribution</h4>
            <div class="license-grid">
              @for (lic of r.licenses!.licenses; track lic.license) {
                <div class="license-card" [class.license-incompatible]="lic.incompatible">
                  <div class="license-name">{{ lic.license }}</div>
                  <div class="license-count">{{ lic.count }}</div>
                </div>
              }
            </div>
          }

          @if (r.licenses!.incompatibleCount) {
            <h4>⚠ Potentially Incompatible Dependencies</h4>
            <p class="analyze-label warn">
              These licenses (GPL, AGPL, LGPL, CDDL, EPL) may require open-sourcing your code or be
              incompatible with commercial distribution. Review with your legal team.
            </p>
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Artifact</th>
                  <th>Version</th>
                  <th>License</th>
                </tr>
              </thead>
              <tbody>
                @for (dep of r.licenses!.dependencies; track dep.artifact) {
                  @if (dep.incompatible) {
                    <tr class="row-outdated">
                      <td class="class-name">{{ dep.group }}</td>
                      <td class="class-name">{{ dep.artifact }}</td>
                      <td>{{ dep.version }}</td>
                      <td>
                        <span class="latest-version">{{ dep.license }}</span>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          }
        </section>
      }

      <!-- ================================================================== -->
      <!-- METRICS SECTION -->
      <!-- ================================================================== -->
      @if (r.metrics?.available) {
        <section class="quality-section">
          <h3><span class="section-icon">📏</span> Code Metrics</h3>
          <div class="metrics-summary">
            <div class="metric-card">
              <div class="metric-val">{{ r.metrics!.totalClasses }}</div>
              <div class="metric-lbl">Classes</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">{{ r.metrics!.totalMethods }}</div>
              <div class="metric-lbl">Methods</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">{{ r.metrics!.totalLines }}</div>
              <div class="metric-lbl">Lines (source)</div>
            </div>
            @if (r.metrics!.totalComplexity) {
              <div class="metric-card">
                <div class="metric-val">{{ r.metrics!.totalComplexity }}</div>
                <div class="metric-lbl">Cyclomatic complexity</div>
              </div>
            }
          </div>
          <div class="table-wrap">
            <table class="quality-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th class="num-col">Classes</th>
                  <th class="num-col">Methods</th>
                  <th class="num-col">Lines</th>
                  <th class="num-col">Complexity</th>
                </tr>
              </thead>
              <tbody>
                @for (pkg of r.metrics!.packages; track pkg.name) {
                  <tr>
                    <td>{{ pkg.name }}</td>
                    <td class="num-col">{{ pkg.classes }}</td>
                    <td class="num-col">{{ pkg.methods }}</td>
                    <td class="num-col">{{ pkg.lines }}</td>
                    <td
                      class="num-col"
                      [class.pct-warn]="pkg.complexity! > 50"
                      [class.pct-bad]="pkg.complexity! > 100"
                    >
                      {{ pkg.complexity ?? '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (r.metrics!.topComplexClasses && r.metrics!.topComplexClasses!.length > 0) {
            <h4>Top 10 Most Complex Classes</h4>
            <div class="table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th class="num-col">Cyclomatic Complexity</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cls of r.metrics!.topComplexClasses; track cls.class) {
                    <tr>
                      <td class="class-name">{{ cls.class }}</td>
                      <td
                        class="num-col"
                        [class.pct-warn]="cls.complexity > 15"
                        [class.pct-bad]="cls.complexity > 30"
                      >
                        {{ cls.complexity }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (r.metrics!.untestedClasses && r.metrics!.untestedClasses!.length > 0) {
            <h4>
              Classes with 0% Coverage
              <span class="section-count">{{ r.metrics!.untestedCount }}</span>
            </h4>
            <div class="table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Class</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cls of r.metrics!.untestedClasses; track cls) {
                    <tr>
                      <td class="class-name">{{ cls }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    }
  `,
})
export class QcTabMutationComponent {
  readonly report = input.required<QualityReport>();
  readonly mavenSiteAvailable = input<boolean>(false);
  readonly mavenSiteBase = input<string>('');

  readonly entries = entriesOf;
  readonly sevColor = severityColor;
  readonly covColor = coverageColor;
  readonly commitUrl = commitUrl;
}
