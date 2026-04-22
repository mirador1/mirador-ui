import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pipeline tab — ADR-0052 Phase Q-1 removed the backend pipeline section.
 * This tab is now a single external-link card pointing to GitLab's own
 * CI/CD page. No dynamic data, no `input()` needed — the parent just
 * renders <qc-tab-pipeline /> when selectedTab() === 'pipeline'.
 *
 * Extracted 2026-04-22 from quality.component.html under Phase B-5
 * (1 panel = 1 file, see CLAUDE.md → "File length hygiene" rule #6).
 */
@Component({
  selector: 'app-qt-pipeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tab-section">
      <h2 class="section-title">🚀 Pipeline History</h2>
      <div class="external-link-card">
        <p>
          Pipeline history is served by GitLab's own CI/CD page — Mirador no longer proxies it (see
          <a
            href="https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/adr/0052-backend-not-coupled-to-build-tools.md"
            target="_blank"
            rel="noopener"
            >ADR-0052</a
          >).
        </p>
        <a
          class="btn-sonar"
          href="https://gitlab.com/mirador1/mirador-service/-/pipelines"
          target="_blank"
          rel="noopener"
        >
          View pipelines on GitLab ↗
        </a>
      </div>
    </section>
  `,
})
export class QcTabPipelineComponent {}
