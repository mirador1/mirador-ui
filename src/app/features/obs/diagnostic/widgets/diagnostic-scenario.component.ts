/**
 * DiagnosticScenarioComponent — generic shell for the 5 uniform-output
 * scenarios on the diagnostic page (API Versioning / Idempotency / Rate /
 * Kafka Enrich / Aggregate). Each shows : badge + description + action
 * row + log-output.
 *
 * Used via content projection for the action row (parent supplies the
 * specific input fields if any) ; the badge / title / description are
 * inputs ; logs + running come from the parent's signals.
 *
 * Five other scenarios (Diff, Stress, Sched, Waterfall, Sankey) have
 * custom output shapes (colored diff lines, SVG charts, tables) and
 * stay inline in the parent template — extracting them as widgets
 * would require complex content-projection slots without behavioural
 * isolation gain.
 *
 * Extracted from diagnostic.component.html per Phase B-7-6, 2026-04-24.
 */
import { Component, input, output } from '@angular/core';
import type { LogLine } from '../diagnostic-types';

@Component({
  selector: 'app-diagnostic-scenario',
  standalone: true,
  styleUrl: '../diagnostic.component.scss',
  template: `
    <div class="scenario-row">
      <div class="scenario-meta">
        <span class="scenario-badge {{ badgeClass() }}">{{ badge() }}</span>
        <div class="scenario-desc">
          <strong>{{ title() }}</strong>
          <ng-content select="[scenario-desc]"></ng-content>
        </div>
      </div>
      <div class="scenario-action">
        <ng-content select="[scenario-action]"></ng-content>
        <button class="run-btn" [disabled]="running()" (click)="runRequested.emit()">
          {{ running() ? '...' : '▶ Run' }}
        </button>
      </div>
      @if (logs().length) {
        <div class="scenario-output">
          @for (line of logs(); track $index) {
            <span class="log-line log-{{ line.kind }}">{{ line.text }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class DiagnosticScenarioComponent {
  /** Emoji + short label rendered in the colored badge (e.g. "🔁 Idem"). */
  readonly badge = input.required<string>();
  /** CSS class suffix applied to `scenario-badge {{ badgeClass }}`. */
  readonly badgeClass = input.required<string>();
  /** Bold scenario title ("Idempotency — same key twice"). */
  readonly title = input.required<string>();
  /** Live run state — disables the button + replaces label with "...". */
  readonly running = input.required<boolean>();
  /** Scenario log lines (color-coded). Empty array = no log block rendered. */
  readonly logs = input.required<LogLine[]>();

  readonly runRequested = output<void>();
}
