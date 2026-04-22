import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BranchesReport } from '../quality.component';

/**
 * Branches tab — renders the `branches` section of the quality report
 * (remote git branches sorted by committerdate desc, via `git for-each-ref`
 * on the backend — see svc `QualityReportEndpoint.buildBranchesSection`).
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 * Takes the `branches` sub-tree as an input rather than the whole
 * report — smaller surface, easier to test.
 */
@Component({
  selector: 'app-qt-branches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../quality.component.scss',
  template: `
    @let b = branches();
    <section class="quality-section">
      <h3><span class="section-icon">🌿</span> Active Branches</h3>

      @if (!b?.available) {
        <p class="muted">{{ b?.reason ?? 'Branch data not available.' }}</p>
      } @else {
        <p class="muted" style="margin-bottom: 0.75rem">
          {{ b!.total }} remote branches — sorted by most recently updated.
        </p>
        <div class="table-wrap">
          <table class="quality-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th style="width: 14em">Last Commit</th>
                <th style="width: 12em">Author</th>
              </tr>
            </thead>
            <tbody>
              @for (branch of b!.branches; track branch.name) {
                <tr>
                  <td>
                    <span class="branch-name">{{ branch.name }}</span>
                  </td>
                  <td class="muted">{{ branch.lastCommit.substring(0, 19) }}</td>
                  <td class="muted">{{ branch.author }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class QcTabBranchesComponent {
  readonly branches = input<BranchesReport | undefined>();
}
