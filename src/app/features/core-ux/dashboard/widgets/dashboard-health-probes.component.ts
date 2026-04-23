/**
 * DashboardHealthProbesComponent — 3 cards showing the current state of
 * Spring Boot Actuator's health/readiness/liveness probes.
 *
 * Pure presentational widget : takes the 3 raw probe signals as inputs,
 * renders the cards. No HTTP, no signals, no state. Status colour and
 * label derive from the JSON `status` field.
 *
 * Extracted from `dashboard.component.html` (lines 269-334) + the two
 * `statusClass` / `statusLabel` helpers (was at the bottom of
 * dashboard.component.ts) per Phase B-6b widget split, 2026-04-23.
 *
 * Why a standalone widget : the parent dashboard exceeded the 745 LOC
 * "container of independent things" threshold. One widget per file makes
 * the dashboard the visible table of contents (~one component per concept)
 * and lets each widget evolve independently. See ~/.claude/CLAUDE.md →
 * "1 widget / 1 panel = 1 file".
 */
import { Component, input } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { InfoTipComponent } from '../../../../shared/info-tip/info-tip.component';

@Component({
  selector: 'app-dashboard-health-probes',
  standalone: true,
  imports: [JsonPipe, InfoTipComponent],
  styleUrl: '../dashboard.component.scss',
  template: `
    <h3>
      Health Probes
      <app-info-tip
        text="Spring Boot Actuator exposes 3 probes: health (overall status), readiness (ready for traffic), liveness (process alive). Used by Kubernetes for health checks."
        command="GET /actuator/health/readiness"
        source="/actuator/health/*"
      />
    </h3>

    <!-- ADR-0008 aftermath : the UP/DOWN sparkline was client-side-only and
         duplicated (weakly) the "up" Micrometer metric that Grafana plots in
         the Golden Signals dashboard. The three probe cards below show the
         current status — history lives in Grafana. -->
    <div class="probes-grid">
      <article class="card">
        <div class="card-title">
          <span class="badge" [class]="statusClass(health())">{{ statusLabel(health()) }}</span>
          <span class="probe-icon">💚</span>
          <strong>Health</strong>
          <small>/actuator/health</small>
          <app-info-tip
            title="Health (composite)"
            text="Overall backend health. Aggregates all components: database (PostgreSQL), Redis, disk space, ping. Returns UP only if ALL components are UP. HTTP 200 when UP, 503 when DOWN. Stop a service in Service Control to see it change."
            command="curl http://localhost:8080/actuator/health"
            source="/actuator/health"
            [wide]="true"
          />
        </div>
        <pre>{{ health() | json }}</pre>
      </article>

      <article class="card">
        <div class="card-title">
          <span class="badge" [class]="statusClass(readiness())">{{
            statusLabel(readiness())
          }}</span>
          <span class="probe-icon">🚦</span>
          <strong>Readiness</strong>
          <small>/actuator/health/readiness</small>
          <app-info-tip
            title="Readiness probe"
            text="Indicates whether the app is ready to accept traffic. Used by Kubernetes to decide if a pod should receive requests. Includes database connectivity and other critical dependencies. When NOT ready, the load balancer stops sending traffic."
            command="curl http://localhost:8080/actuator/health/readiness"
            source="/actuator/health/readiness"
            [wide]="true"
          />
        </div>
        <pre>{{ readiness() | json }}</pre>
      </article>

      <article class="card">
        <div class="card-title">
          <span class="badge" [class]="statusClass(liveness())">{{ statusLabel(liveness()) }}</span>
          <span class="probe-icon">🫀</span>
          <strong>Liveness</strong>
          <small>/actuator/health/liveness</small>
          <app-info-tip
            title="Liveness probe"
            text="Indicates whether the app process is alive and not deadlocked. Used by Kubernetes to decide if a pod should be restarted. Unlike readiness, liveness does NOT check external dependencies — a DB outage should not cause a restart. If this is DOWN, the JVM itself is broken."
            command="curl http://localhost:8080/actuator/health/liveness"
            source="/actuator/health/liveness"
            [wide]="true"
          />
        </div>
        <pre>{{ liveness() | json }}</pre>
      </article>
    </div>
  `,
})
export class DashboardHealthProbesComponent {
  /** /actuator/health raw JSON. Parent passes the signal value. */
  readonly health = input<unknown>(null);
  /** /actuator/health/readiness raw JSON. */
  readonly readiness = input<unknown>(null);
  /** /actuator/health/liveness raw JSON. */
  readonly liveness = input<unknown>(null);

  /**
   * Maps probe payload to a CSS class on the badge :
   *  - `badge-up`      : status === 'UP'
   *  - `badge-down`    : status defined but ≠ 'UP'
   *  - `badge-unknown` : null payload (probe not yet polled)
   */
  statusClass(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return 'badge-unknown';
    if (d.status === 'UP') return 'badge-up';
    return 'badge-down';
  }

  /**
   * Maps probe payload to a human label :
   *  - `'...'`  : null payload (still loading)
   *  - `'?'`    : payload defined but missing `status` field
   *  - else     : the literal `status` value (UP / DOWN / OUT_OF_SERVICE)
   */
  statusLabel(data: unknown): string {
    const d = data as { status?: string } | null;
    if (!d) return '...';
    return d.status ?? '?';
  }
}
