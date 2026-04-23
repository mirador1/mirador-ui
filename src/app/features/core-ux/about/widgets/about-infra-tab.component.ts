/**
 * AboutInfraTabComponent — port map + run.sh quick-start + external-services
 * grid + quick-start code block.
 *
 * Imports its data directly from `about-data.ts` (sibling module) — no
 * parent prop drilling. Owns the per-category port filter helper.
 *
 * Extracted from about.component.html per Phase B-7-5 P1B, 2026-04-24.
 */
import { Component } from '@angular/core';
import { PORT_MAP, PORT_CATEGORIES, RUN_COMMANDS, QUICK_START } from '../about-data';

@Component({
  selector: 'app-about-infra-tab',
  standalone: true,
  styleUrl: '../about.component.scss',
  template: `
    <article class="card">
      <h3>Port Map</h3>
      <p class="card-desc">All services and their host ports. Everything runs on localhost.</p>
      @for (cat of portCategories; track cat) {
        <div class="port-group">
          <strong class="port-cat-label">
            @switch (cat) {
              @case ('App') {
                Application
              }
              @case ('Data') {
                Data Stores
              }
              @case ('Admin') {
                Admin Tools
              }
              @case ('Obs') {
                Observability
              }
              @case ('Infra') {
                Infrastructure
              }
            }
          </strong>
          <div class="port-table">
            @for (p of portsByCategory(cat); track p.name) {
              <div class="port-row">
                @if (p.url) {
                  <a [href]="p.url" target="_blank" rel="noopener" class="port-link">
                    <code class="port-num">{{ p.port ? ':' + p.port : '—' }}</code>
                    <strong class="port-name">{{ p.name }}</strong>
                  </a>
                } @else {
                  <code class="port-num">{{ p.port ? ':' + p.port : '—' }}</code>
                  <strong class="port-name">{{ p.name }}</strong>
                }
                <span class="port-note">{{ p.note }}</span>
              </div>
            }
          </div>
        </div>
      }
      <p class="card-desc port-auth">
        Default credentials: <code>admin / admin</code> for the Angular UI, Spring API, Keycloak,
        and Grafana. pgAdmin: <code>admin&#64;demo.com / admin</code>.
      </p>
    </article>

    <article class="card">
      <h3>run.sh Commands</h3>
      <p class="card-desc">All commands run from the <code>customer-service/</code> directory.</p>
      <div class="run-table">
        @for (r of runCommands; track r.cmd) {
          <div class="run-row">
            <code class="run-cmd">{{ r.cmd }}</code>
            <span class="run-desc">{{ r.desc }}</span>
          </div>
        }
      </div>
      <p class="card-desc" style="margin-top: 0.75rem">
        Pre-push hook (lefthook) runs unit tests automatically before every <code>git push</code>.
      </p>
    </article>

    <article class="card">
      <h3>Quick Start</h3>
      <pre class="quickstart-code">{{ quickStart }}</pre>
    </article>

    <!-- External services: cloud + SaaS dependencies used by the project -->
    <article class="card">
      <h3>External Services</h3>
      <p class="card-desc">
        Cloud and SaaS services used by Mirador (require an account or subscription).
      </p>
      <div class="ext-services-grid">
        <a
          href="https://gitlab.com/mirador1"
          target="_blank"
          rel="noopener"
          class="ext-service-card"
        >
          <span class="ext-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path
                d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
              />
            </svg>
          </span>
          <span class="ext-name">GitLab</span>
          <span class="ext-desc">Source code, CI/CD pipelines, MR auto-merge</span>
        </a>
        <a
          href="https://sonarcloud.io/project/overview?id=mirador1_mirador-service"
          target="_blank"
          rel="noopener"
          class="ext-service-card"
        >
          <span class="ext-icon ext-sonar">☁️</span>
          <span class="ext-name">SonarCloud</span>
          <span class="ext-desc">Static analysis, code coverage, security hotspots</span>
        </a>
        <a href="https://manage.auth0.com/" target="_blank" rel="noopener" class="ext-service-card">
          <span class="ext-icon ext-auth0">🔐</span>
          <span class="ext-name">Auth0</span>
          <span class="ext-desc">JWT / OIDC identity provider (alternative to Keycloak)</span>
        </a>
        <a href="https://www.duckdns.org/" target="_blank" rel="noopener" class="ext-service-card">
          <span class="ext-icon ext-dns">🦆</span>
          <span class="ext-name">DuckDNS</span>
          <span class="ext-desc">Free dynamic DNS for GKE public endpoint</span>
        </a>
        <a
          href="https://console.cloud.google.com/"
          target="_blank"
          rel="noopener"
          class="ext-service-card"
        >
          <span class="ext-icon ext-gcp">☁️</span>
          <span class="ext-name">Google Cloud</span>
          <span class="ext-desc">GKE Autopilot, Cloud SQL, Artifact Registry, Cloud Run</span>
        </a>
      </div>
    </article>
  `,
})
export class AboutInfraTabComponent {
  // Data imported directly from sibling about-data.ts — no parent prop drill.
  readonly portCategories = PORT_CATEGORIES;
  readonly portMap = PORT_MAP;
  readonly runCommands = RUN_COMMANDS;
  readonly quickStart = QUICK_START;

  /** Filter helper used by the port-map iteration to group ports per category. */
  portsByCategory(cat: string) {
    return this.portMap.filter((p) => p.category === cat);
  }
}
