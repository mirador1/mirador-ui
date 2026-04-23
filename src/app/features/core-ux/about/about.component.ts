import { Component, signal } from '@angular/core';
import {
  TECHNOLOGIES,
  PORT_MAP,
  PORT_CATEGORIES,
  RUN_COMMANDS,
  QUICK_START,
  type Technology,
  type PortMapEntry,
  type RunCommand,
} from './about-data';

/**
 * AboutComponent — Architecture documentation shell.
 *
 * Phase 2 of the About-page trim (ADR-0008 industrial pass): the template
 * used to inline ~2 900 lines of prose across 14 tabs. All prose now lives
 * in versioned Markdown under `docs/architecture/*.md`, rendered by GitLab.
 * The component keeps what is genuinely interactive:
 *   - 'overview' — hero SVG + tech-badges banner + link to overview.md
 *   - 'infra'    — port map + run.sh quick-start + external services grid
 *   - 'tech'     — sortable list of 207 technologies (driven by `technologies`)
 * Every other tab is a compact "doc pane" that links out to its Markdown
 * counterpart on GitLab. No HTTP calls, no runtime data fetching.
 *
 * Data lives in `./about-data.ts` (Phase B-7-5 Phase 1A — extracted
 * 2026-04-23, parent dropped from 652 → 90 LOC).
 */
@Component({
  selector: 'app-about',
  standalone: true,
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

  // ── Data exposed to the template (re-exports from about-data.ts so the
  //    template doesn't need to change after the Phase 1A extraction). ──
  readonly technologies: Technology[] = TECHNOLOGIES;
  readonly portMap: PortMapEntry[] = PORT_MAP;
  readonly portCategories = PORT_CATEGORIES;
  readonly runCommands: RunCommand[] = RUN_COMMANDS;
  readonly quickStart = QUICK_START;

  /** Filter helper used by the 'infra' tab to group ports per category. */
  portsByCategory(cat: string) {
    return this.portMap.filter((p) => p.category === cat);
  }

  /**
   * Root URL for architecture docs on GitLab. Tabs link here instead of
   * inlining prose — the component is a UI shell around a set of Markdown
   * pages that are rendered natively by GitLab (and versioned in-repo, so
   * deep-links survive refactors unlike the old inline copy).
   */
  readonly docsBase = 'https://gitlab.com/mirador1/mirador-ui/-/blob/main/docs/architecture';
}
