import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BuildReport, CheckstyleReport, PmdReport } from '../quality.component';
import { entriesOf, severityColor } from '../quality-helpers';

/**
 * Build tab — combines 3 section blocks that all describe the build
 * artifact: build info (artifact/version/time), PMD static analysis,
 * Checkstyle style report.
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 * Takes the 3 relevant sub-trees as inputs + the 2 maven-site signals.
 */
@Component({
  selector: 'app-qt-build',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../quality.component.scss',
  template: `
    @let build = buildReport();
    @let pmd = pmdReport();
    @let cs = checkstyleReport();
    @let siteBase = mavenSiteBase();
    @if (mavenSiteAvailable() && siteBase) {
      <div class="tab-maven-bar">
        <span class="tab-maven-bar-label">Full report:</span>
        <a class="tab-maven-link" [href]="siteBase + '/index.html'" target="_blank" rel="noopener"
          >Project Summary ↗</a
        >
        <a
          class="tab-maven-link"
          [href]="siteBase + '/apidocs/index.html'"
          target="_blank"
          rel="noopener"
          >Javadoc ↗</a
        >
      </div>
    }
    <section class="quality-section">
      <h3>
        <span class="section-icon">🔨</span>
        Build Information
      </h3>

      @if (!build.available) {
        <div class="info-card">
          <span
            >ℹ No build info available. Run <code>mvn package</code> with spring-boot-maven-plugin
            build-info goal.</span
          >
        </div>
      } @else {
        <div class="build-grid">
          <div class="build-item">
            <span class="build-key">Artifact</span>
            <span class="build-val">{{ build.artifact }}</span>
          </div>
          <div class="build-item">
            <span class="build-key">Version</span>
            <span class="build-val">{{ build.version }}</span>
          </div>
          <div class="build-item">
            <span class="build-key">Build time</span>
            <span class="build-val">{{ build.time }}</span>
          </div>
          <div class="build-item">
            <span class="build-key">Java version</span>
            <span class="build-val">{{ build.javaVersion }}</span>
          </div>
          <div class="build-item">
            <span class="build-key">Spring Boot</span>
            <span class="build-val">{{ build.springBootVersion }}</span>
          </div>
        </div>
      }
    </section>

    @if (pmd) {
      <section class="quality-section">
        <h3>
          <span class="section-icon">🔍</span>
          PMD Analysis
          @if (pmd.available) {
            <span class="section-count">{{ pmd.total }} violations</span>
            <span
              class="section-badge"
              [class.badge-pass]="pmd.total === 0"
              [class.badge-fail]="pmd.total! > 0"
            >
              {{ pmd.total === 0 ? 'CLEAN' : 'ISSUES' }}
            </span>
          }
        </h3>

        @if (!pmd.available) {
          <div class="info-card">
            ℹ PMD requires Java ≤21. Run:
            <code>mvn verify -Preport,report-static -Dcompat -DskipITs -Djacoco.skip=true</code>
          </div>
        } @else if (pmd.total === 0) {
          <div class="success-card">✅ No PMD violations found.</div>
        } @else {
          <div class="violation-summary">
            @for (entry of entries(pmd.byPriority); track entry[0]) {
              <span
                class="badge"
                [class.badge-fail]="entry[0] === 'High'"
                [class.badge-warn]="entry[0] === 'Medium'"
              >
                {{ entry[0] }}: {{ entry[1] }}
              </span>
            }
          </div>
          <div class="ruleset-row">
            @for (entry of entries(pmd.byRuleset); track entry[0]) {
              <div class="ruleset-chip">
                <span class="ruleset-name">{{ entry[0] }}</span>
                <span class="ruleset-count">{{ entry[1] }}</span>
              </div>
            }
          </div>
          @if (pmd.topRules && pmd.topRules.length > 0) {
            <div class="table-wrap" style="margin-top: 0.75rem">
              <table class="quality-table">
                <thead>
                  <tr>
                    <th>Top Violated Rules</th>
                    <th class="num-col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  @for (rule of pmd.topRules; track rule.rule) {
                    <tr>
                      <td>{{ rule.rule }}</td>
                      <td class="num-col">{{ rule.count }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </section>
    }

    @if (cs) {
      <section class="quality-section">
        <h3>
          <span class="section-icon">✏️</span>
          Checkstyle
          @if (cs.available) {
            <span class="section-count">{{ cs.total }} violations</span>
            <span
              class="section-badge"
              [class.badge-pass]="cs.total === 0"
              [class.badge-fail]="cs.total! > 0"
            >
              {{ cs.total === 0 ? 'CLEAN' : 'ISSUES' }}
            </span>
          }
        </h3>

        @if (!cs.available) {
          <div class="info-card">
            ℹ Checkstyle requires Java ≤21. Run:
            <code>mvn verify -Preport,report-static -Dcompat -DskipITs -Djacoco.skip=true</code>
          </div>
        } @else if (cs.total === 0) {
          <div class="success-card">✅ No Checkstyle violations found.</div>
        } @else {
          <div class="violation-summary">
            @for (entry of entries(cs.bySeverity); track entry[0]) {
              <span class="badge" [class]="'badge-' + sevColor(entry[0])"
                >{{ entry[0] }}: {{ entry[1] }}</span
              >
            }
          </div>
          @if (cs.topCheckers && cs.topCheckers.length > 0) {
            <div class="table-wrap" style="margin-top: 0.75rem">
              <table class="quality-table">
                <thead>
                  <tr>
                    <th>Top Checks Failed</th>
                    <th class="num-col">Count</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cs.topCheckers; track c.checker) {
                    <tr>
                      <td>{{ c.checker }}</td>
                      <td class="num-col">{{ c.count }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </section>
    }
  `,
})
export class QcTabBuildComponent {
  readonly buildReport = input.required<BuildReport>();
  readonly pmdReport = input<PmdReport | undefined>();
  readonly checkstyleReport = input<CheckstyleReport | undefined>();
  readonly mavenSiteAvailable = input<boolean>(false);
  readonly mavenSiteBase = input<string>('');

  readonly entries = entriesOf;
  readonly sevColor = severityColor;
}
