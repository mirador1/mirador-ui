import { Component, signal } from '@angular/core';
import { AboutOverviewTabComponent } from './widgets/about-overview-tab.component';
import { AboutInfraTabComponent } from './widgets/about-infra-tab.component';
import { AboutTechTabComponent } from './widgets/about-tech-tab.component';

/**
 * AboutComponent — Architecture documentation shell.
 *
 * Phase 2 of the About-page trim (ADR-0008 industrial pass): the template
 * used to inline ~2 900 lines of prose across 14 tabs. All prose now lives
 * in versioned Markdown under `docs/architecture/*.md`, rendered by GitLab.
 *
 * Big-tab widgets live in `widgets/` (Phase B-7-5 P1B, 2026-04-24) :
 *   - 'overview' → AboutOverviewTabComponent (hero SVG + tech badges)
 *   - 'infra'    → AboutInfraTabComponent (port map + run.sh + ext services)
 *   - 'tech'     → AboutTechTabComponent (sortable A→Z technologies table)
 *
 * The other 11 tabs are tiny doc-pane shells (~20 LOC each, pure static
 * link-out) kept inline in the template — extracting them as widgets
 * would add file-count friction without behavioural isolation gain.
 *
 * Data lives in `./about-data.ts` (Phase 1A, parent dropped 652 → 36 LOC).
 */
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [AboutOverviewTabComponent, AboutInfraTabComponent, AboutTechTabComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  /** Signal: currently active documentation tab. Defaults to overview. */
  readonly activeTab = signal<
    | 'overview'
    | 'infra'
    | 'deploy'
    | 'deploy-docker'
    | 'deploy-k8s'
    | 'deploy-gcp'
    | 'tech'
    | 'compat'
    | 'obs-arch'
    | 'resilience'
    | 'security-arch'
    | 'messaging'
    | 'data'
    | 'testing'
  >('overview');

  /** Tab definitions rendered as the nav pill row. The `id` must match `activeTab` values. */
  readonly tabs = [
    { id: 'overview', label: '📖 Overview' },
    { id: 'infra', label: '🏗️ Infrastructure' },
    { id: 'deploy', label: '🚀 Deployment' },
    { id: 'deploy-docker', label: '🐳 Docker' },
    { id: 'deploy-k8s', label: '☸️ Kubernetes local' },
    { id: 'deploy-gcp', label: '☁️ Google Cloud' },
    { id: 'tech', label: '📚 Technologies' },
    { id: 'compat', label: '🔀 Compatibility' },
    { id: 'obs-arch', label: '🔭 Observability' },
    { id: 'resilience', label: '🛡️ Resilience' },
    { id: 'security-arch', label: '🔐 Security' },
    { id: 'messaging', label: '📨 Messaging' },
    { id: 'data', label: '🗄️ Data Layer' },
    { id: 'testing', label: '🧪 Testing' },
  ] as const;

  /**
   * Root URL for architecture docs on GitLab. Used by the 11 inline
   * doc-pane tabs + passed to AboutOverviewTabComponent. Tabs link
   * here instead of inlining prose — the component is a UI shell
   * around a set of Markdown pages that are rendered natively by
   * GitLab (and versioned in-repo, so deep-links survive refactors
   * unlike the old inline copy).
   */
  readonly docsBase = 'https://gitlab.com/mirador1/mirador-ui/-/blob/main/docs/architecture';
}
