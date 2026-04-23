/**
 * DashboardQualitySummaryComponent — at-a-glance Maven quality snapshot.
 *
 * Renders 4 cards (Tests / Coverage / SpotBugs / SonarCloud) from the
 * `/actuator/quality` aggregate. Pure presentational : takes the
 * QualitySummary signal as input + a "View full report →" link.
 *
 * Extracted from dashboard.component.html (lines 152-267 pre-extraction)
 * per Phase B-6b widget split, 2026-04-23.
 *
 * Why a standalone widget : separates the build-time quality block from
 * the runtime health block above. The two have different refresh
 * cadences (quality once on init, health every 5s) and very different
 * presentation needs — keeping them in one parent grew the dashboard
 * past 745 LOC. See ~/.claude/CLAUDE.md → "1 widget / 1 panel = 1 file".
 */
import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InfoTipComponent } from '../../../../shared/info-tip/info-tip.component';
import type { QualitySummary } from '../dashboard-types';

@Component({
  selector: 'app-dashboard-quality-summary',
  standalone: true,
  imports: [DecimalPipe, RouterLink, InfoTipComponent],
  styleUrl: '../dashboard.component.scss',
  template: `
    <section class="section">
      <div class="section-header">
        <h3>
          Code Quality
          <app-info-tip
            text="Build quality snapshot from /actuator/quality. Aggregates JaCoCo coverage, SpotBugs static analysis, Surefire tests, and SonarCloud ratings. Data reflects the last mvn verify run — restart the app after a rebuild to refresh."
            [wide]="true"
          />
        </h3>
        <a routerLink="/quality" class="quality-full-link">View full report →</a>
      </div>

      @if (summary() === null) {
        <p class="quality-loading">Loading quality data…</p>
      }
      @if (summary() !== null && !summary()!.available) {
        <p class="quality-unavailable">
          Quality report not available — run <code>mvn verify</code> and restart the app.
        </p>
      }
      @if (summary()?.available) {
        <div class="quality-grid">
          <!-- Tests -->
          <div class="quality-card">
            <span class="quality-icon">🧪</span>
            <div class="quality-value">{{ summary()!.testsTotal ?? '—' }}</div>
            <div class="quality-label">Tests</div>
            @if (summary()!.testsPassed !== null) {
              <span
                class="quality-badge"
                [class.quality-badge-pass]="summary()!.testsPassed!"
                [class.quality-badge-fail]="!summary()!.testsPassed!"
                >{{ summary()!.testsPassed ? 'PASSED' : 'FAILED' }}</span
              >
            }
          </div>

          <!-- Coverage -->
          <div class="quality-card">
            <span class="quality-icon">📊</span>
            <div class="quality-value">
              @if (summary()!.coveragePct !== null) {
                {{ summary()!.coveragePct! | number: '1.0-1' }}%
              } @else {
                —
              }
            </div>
            <div class="quality-label">Coverage</div>
            @if (summary()!.coveragePct !== null) {
              <div class="quality-bar-track">
                <div
                  class="quality-bar-fill"
                  [style.width.%]="summary()!.coveragePct!"
                  [class.quality-bar-low]="summary()!.coveragePct! < 60"
                  [class.quality-bar-mid]="
                    summary()!.coveragePct! >= 60 && summary()!.coveragePct! < 80
                  "
                  [class.quality-bar-high]="summary()!.coveragePct! >= 80"
                ></div>
              </div>
            }
          </div>

          <!-- SpotBugs -->
          <div class="quality-card">
            <span class="quality-icon">🐛</span>
            <div class="quality-value">{{ summary()!.bugsTotal ?? '—' }}</div>
            <div class="quality-label">Bugs (SpotBugs)</div>
            @if (summary()!.bugsTotal !== null) {
              <span
                class="quality-badge"
                [class.quality-badge-pass]="summary()!.bugsTotal === 0"
                [class.quality-badge-warn]="summary()!.bugsTotal! > 0"
                >{{ summary()!.bugsTotal === 0 ? 'Clean' : summary()!.bugsTotal + ' found' }}</span
              >
            }
          </div>

          <!-- SonarCloud -->
          <div class="quality-card">
            <span class="quality-icon">☁️</span>
            <div
              class="quality-value quality-sonar-rating"
              [class.rating-a]="summary()!.sonarRating === 'A'"
              [class.rating-b]="summary()!.sonarRating === 'B'"
              [class.rating-c]="summary()!.sonarRating === 'C'"
              [class.rating-d]="summary()!.sonarRating === 'D'"
              [class.rating-e]="summary()!.sonarRating === 'E'"
            >
              {{ summary()!.sonarRating ?? '—' }}
            </div>
            <div class="quality-label">Sonar Reliability</div>
            @if (summary()!.sonarUrl) {
              <a
                [href]="summary()!.sonarUrl!"
                target="_blank"
                rel="noopener"
                class="quality-sonar-link"
                >sonarcloud.io ↗</a
              >
            } @else {
              <a
                href="https://sonarcloud.io/project/overview?id=mirador1_mirador-service"
                target="_blank"
                rel="noopener"
                class="quality-sonar-link"
                >sonarcloud.io ↗</a
              >
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class DashboardQualitySummaryComponent {
  /**
   * Quality snapshot from /actuator/quality. Null while loading ;
   * `{available:false, ...}` when /actuator/quality returns 404 or empty
   * (mvn verify hasn't run yet on this build) ; populated otherwise.
   */
  readonly summary = input<QualitySummary | null>(null);
}
