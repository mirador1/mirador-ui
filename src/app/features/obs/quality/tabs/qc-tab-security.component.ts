import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { OwaspReport } from '../quality.component';
import { entriesOf, nvdUrl, severityColor } from '../quality-helpers';

/**
 * Security tab — OWASP Dependency Check CVE list.
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 */
@Component({
  selector: 'app-qt-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  styleUrl: '../quality.component.scss',
  template: `
    @let owasp = owaspReport();
    @let siteBase = mavenSiteBase();
    @if (mavenSiteAvailable() && siteBase) {
      <div class="tab-maven-bar">
        <span class="tab-maven-bar-label">Full report:</span>
        <a
          class="tab-maven-link"
          [href]="siteBase + '/dependency-check-report.html'"
          target="_blank"
          rel="noopener"
          >CVE Scan ↗</a
        >
      </div>
    }
    @if (owasp) {
      <section class="quality-section">
        <h3>
          <span class="section-icon">🛡️</span>
          OWASP Dependency Check
          @if (owasp.available) {
            <span class="section-count">{{ owasp.total }} CVEs</span>
            <span
              class="section-badge"
              [class.badge-pass]="owasp.total === 0"
              [class.badge-fail]="owasp.total! > 0"
            >
              {{ owasp.total === 0 ? 'CLEAN' : 'VULNERABLE' }}
            </span>
          }
        </h3>

        @if (!owasp.available) {
          <div class="info-card">
            ℹ Run <code>./run.sh security-check</code> to generate the CVE report.
          </div>
        } @else if (owasp.total === 0) {
          <div class="success-card">✅ No known vulnerabilities found in dependencies.</div>
        } @else {
          <div class="violation-summary">
            @for (entry of entries(owasp.bySeverity); track entry[0]) {
              <span class="badge" [class]="'badge-' + sevColor(entry[0])"
                >{{ entry[0] }}: {{ entry[1] }}</span
              >
            }
          </div>
          <div class="table-wrap" style="margin-top: 0.75rem">
            <table class="quality-table">
              <thead>
                <tr>
                  <th style="width: 13em; white-space: nowrap">CVE</th>
                  <th style="width: 6em">Severity</th>
                  <th style="width: 4em">Score</th>
                  <th>Dependency</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                @for (v of owasp.vulnerabilities; track v.cve) {
                  <tr>
                    <td>
                      <a
                        [href]="cveUrl(v.cve)"
                        target="_blank"
                        rel="noopener"
                        class="hash cve-link"
                        >{{ v.cve }}</a
                      >
                    </td>
                    <td [class]="'pct-' + sevColor(v.severity)">
                      <strong>{{ v.severity }}</strong>
                    </td>
                    <td
                      class="num-col"
                      [class.pct-bad]="v.score >= 7"
                      [class.pct-warn]="v.score >= 4 && v.score < 7"
                    >
                      {{ v.score | number: '1.1-1' }}
                    </td>
                    <td class="muted" style="font-size: 0.78rem">{{ v.dependency }}</td>
                    <td
                      style="
                        font-size: 0.78rem;
                        max-width: 400px;
                        overflow-wrap: break-word;
                        word-break: break-word;
                      "
                    >
                      {{ v.description }}
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
export class QcTabSecurityComponent {
  readonly owaspReport = input<OwaspReport | undefined>();
  readonly mavenSiteAvailable = input<boolean>(false);
  readonly mavenSiteBase = input<string>('');

  // Expose helpers to the template — Angular doesn't auto-bind free functions.
  readonly entries = entriesOf;
  readonly sevColor = severityColor;
  readonly cveUrl = nvdUrl;
}
