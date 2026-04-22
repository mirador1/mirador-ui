import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BugsReport } from '../quality.component';
import { entriesOf } from '../quality-helpers';

/**
 * Analysis tab — SpotBugs bytecode static analysis summary.
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 *
 * Note: the original template's trailing comment says "end mutation tab"
 * by mistake — this IS the analysis/SpotBugs block. Comment fixed here.
 */
@Component({
  selector: 'qc-tab-analysis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let bugs = bugsReport();
    @let siteBase = mavenSiteBase();
    @if (mavenSiteAvailable() && siteBase) {
      <div class="tab-maven-bar">
        <span class="tab-maven-bar-label">Full report:</span>
        <a
          class="tab-maven-link"
          [href]="siteBase + '/spotbugs.html'"
          target="_blank"
          rel="noopener"
          >SpotBugs ↗</a
        >
      </div>
    }
    <section class="quality-section">
      <h3>
        <span class="section-icon">🐛</span>
        SpotBugs Analysis
      </h3>

      @if (!bugs.available) {
        <div class="info-card">
          <span>ℹ No SpotBugs report available. Run <code>mvn verify</code> to generate one.</span>
        </div>
      } @else if (bugs.total === 0) {
        <div class="success-card">
          <span>✅ No bugs found — SpotBugs analysis passed cleanly.</span>
        </div>
      } @else {
        <div class="bug-summary">
          <strong>{{ bugs.total }}</strong> bug{{ bugs.total! > 1 ? 's' : '' }} found

          @if (entries(bugs.byPriority).length > 0) {
            <span class="sep">—</span>
            @for (entry of entries(bugs.byPriority); track entry[0]) {
              <span class="badge badge-warn">{{ entry[0] }}: {{ entry[1] }}</span>
            }
          }
        </div>

        <div class="table-wrap">
          <table class="quality-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Priority</th>
                <th>Type</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              @for (bug of bugs.items; track $index) {
                <tr>
                  <td>
                    <span class="badge badge-warn">{{ bug.category }}</span>
                  </td>
                  <td
                    [class.pct-bad]="bug.priority === '1'"
                    [class.pct-warn]="bug.priority === '2'"
                  >
                    {{ bug.priority === '1' ? 'High' : bug.priority === '2' ? 'Normal' : 'Low' }}
                  </td>
                  <td class="bug-type">{{ bug.type }}</td>
                  <td class="muted">{{ bug.className }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class QcTabAnalysisComponent {
  readonly bugsReport = input.required<BugsReport>();
  readonly mavenSiteAvailable = input<boolean>(false);
  readonly mavenSiteBase = input<string>('');
  readonly entries = entriesOf;
}
