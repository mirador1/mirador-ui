/**
 * DashboardArchitectureMapComponent — service dependency map +
 * Docker controls. The big one of Phase B-6b (3rd slice, 2026-04-23).
 *
 * Renders 5 columns of "node cards" (the topology graph from
 * dashboard-topology-data.ts), each card showing :
 *  - Status badge (UP/DOWN/—) coloured by topoStatus() input
 *  - Connection arrows (← from / → to)
 *  - Open ↗ deep-link to the service's web UI when applicable
 *  - 🐳 DD deep-link to open the container in Docker Desktop
 *  - Stop/Start button when the node maps to a Docker container
 *
 * Data flow :
 *  - Inputs : topoStatus, dockerContainers, dockerLoading, dockerError,
 *    dockerRunningCount, dockerActionLoading — all signal values from
 *    the parent dashboard
 *  - Outputs : refreshRequested (button click), actionRequested
 *    ({name, op:'stop'|'start'}) — parent owns the HttpClient + retry
 *    policy + state mutation
 *  - Internal : topology helpers (topoNodesInCol, topoConnections,
 *    topoNodeColor, topoStatusTooltip, topoContainer, isDockerActionLoading)
 *    were on the parent, moved here since they only serve this widget
 *
 * Why split this out : the parent dashboard.component was a 745-LOC
 * container ; this widget alone owned ~170 LOC of template + 6 helpers
 * that don't appear elsewhere. See ~/.claude/CLAUDE.md → "1 widget /
 * 1 panel = 1 file".
 */
import { Component, inject, input, output } from '@angular/core';
import { DeepLinkService } from '../../../../core/deep-link/deep-link.service';
import { InfoTipComponent } from '../../../../shared/info-tip/info-tip.component';
import {
  DASHBOARD_TOPO_COLUMNS,
  DASHBOARD_TOPO_NODES,
  DASHBOARD_TOPO_EDGES,
} from '../dashboard-topology-data';
import type { EnrichedDockerContainer } from '../dashboard-types';

@Component({
  selector: 'app-dashboard-architecture-map',
  standalone: true,
  imports: [InfoTipComponent],
  styleUrl: '../dashboard.component.scss',
  templateUrl: './dashboard-architecture-map.component.html',
})
export class DashboardArchitectureMapComponent {
  /** Desktop deep-link helpers (docker-desktop://, vscode://, idea://). */
  readonly deepLink = inject(DeepLinkService);

  // ── Inputs (signal values from parent) ──────────────────────────────────────
  /** Map of node-id → live status, populated from parent's probe pipeline. */
  readonly topoStatus = input<Record<string, 'up' | 'down' | 'unknown'>>({});
  /** Enriched Docker container list — name, status, image, running, label, … */
  readonly dockerContainers = input<EnrichedDockerContainer[]>([]);
  /** True while the parent's `loadContainers()` HTTP request is in flight. */
  readonly dockerLoading = input<boolean>(false);
  /** Error message to display when the Docker daemon is unreachable. */
  readonly dockerError = input<string>('');
  /** Pre-computed `dockerContainers().filter(c => c.running).length` from parent. */
  readonly dockerRunningCount = input<number>(0);
  /**
   * Key of the action currently in flight, format `"<name>:<op>"`.
   * Null when no Docker action is running. Used by isDockerActionLoading().
   */
  readonly dockerActionLoading = input<string | null>(null);

  // ── Outputs (events to parent) ──────────────────────────────────────────────
  /** Emitted when the user clicks the ↻ Refresh button. Parent calls loadContainers(). */
  readonly refreshRequested = output<void>();
  /** Emitted when the user clicks Stop/Start on a container card. */
  readonly actionRequested = output<{ name: string; op: 'stop' | 'start' }>();

  // ── Topology helpers (moved here from parent — only used by this widget) ────
  /** The 5 column labels (Browser → Edge → API → Data → External). */
  readonly topoColumns = DASHBOARD_TOPO_COLUMNS;
  private readonly topoNodes = DASHBOARD_TOPO_NODES;
  private readonly topoEdgeList = DASHBOARD_TOPO_EDGES;

  /** Nodes in column `col`, sorted by their declared `row` order. */
  topoNodesInCol(col: number) {
    return this.topoNodes.filter((n) => n.col === col).sort((a, b) => a.row - b.row);
  }

  /**
   * Get the list of nodes this node connects to (→) and is connected from (←).
   * Used to render the friendly arrows below each node card.
   */
  topoConnections(nodeId: string): { to: string[]; from: string[] } {
    const nodeMap = new Map(this.topoNodes.map((n) => [n.id, n.label]));
    const to: string[] = [];
    const from: string[] = [];
    for (const e of this.topoEdgeList) {
      if (e.from === nodeId) to.push(nodeMap.get(e.to) ?? e.to);
      if (e.to === nodeId) from.push(nodeMap.get(e.from) ?? e.from);
    }
    return { to, from };
  }

  /** Find the docker container backing a topology node, or null if no mapping. */
  topoContainer(node: { container?: string }): { running: boolean; name: string } | null {
    if (!node.container) return null;
    return this.dockerContainers().find((c) => c.name === node.container) ?? null;
  }

  /** Map status to badge colour : green = up, red = down, grey = unknown. */
  topoNodeColor(id: string): string {
    const s = this.topoStatus()[id];
    if (s === 'up') return '#4ade80';
    if (s === 'down') return '#f87171';
    return '#94a3b8';
  }

  /** Tooltip explaining how the UP/DOWN status of each node is probed. */
  private readonly statusProbeDescriptions: Record<string, string> = {
    client: 'Always UP — represents your browser, no probe needed.',
    api: 'GET /actuator/health → HTTP 200 + JSON { status: "UP" }.',
    swagger: 'Derived from API status — UP when the Spring Boot app is running.',
    actuator: 'Derived from API status — UP when the Spring Boot app is running.',
    keycloak: 'Docker container state via Docker Engine API (container running = UP).',
    pg: 'Spring Boot health component "db" inside /actuator/health/components.',
    redis: 'Spring Boot health component "redis" inside /actuator/health/components.',
    kafka: 'Docker container state via Docker Engine API (container running = UP).',
    ollama: 'Docker container state via Docker Engine API (container running = UP).',
    cloudbeaver: 'Docker container state via Docker Engine API (container running = UP).',
    redisinsight: 'Docker container state via Docker Engine API (container running = UP).',
    consumer: 'Inferred from Kafka container state — shown as UP when kafka-demo is running.',
    'kafka-ui': 'Docker container state via Docker Engine API (container running = UP).',
    loki: 'Docker container state via Docker Engine API (container running = UP).',
    'spring-app': 'Docker container state via Docker Engine API (container running = UP).',
    'gitlab-com':
      'HEAD https://gitlab.com (no-cors) — UP if reachable from the browser, DOWN if network error.',
  };

  topoStatusTooltip(nodeId: string): string {
    const probe =
      this.statusProbeDescriptions[nodeId] ?? 'Docker container state via Docker Engine API.';
    const s = this.topoStatus()[nodeId];
    const stateLabel = s === 'up' ? '✅ UP' : s === 'down' ? '❌ DOWN' : '— unknown';
    return `${stateLabel}\nProbe: ${probe}`;
  }

  /**
   * True when the given (name, op) pair matches the parent's current
   * `dockerActionLoading()` key. Used to show a spinner on the active button.
   */
  isDockerActionLoading(name: string, op: string): boolean {
    return this.dockerActionLoading() === `${name}:${op}`;
  }
}
