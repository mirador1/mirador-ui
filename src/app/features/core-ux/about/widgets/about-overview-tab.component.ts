/**
 * AboutOverviewTabComponent — hero SVG + tagline + tech-badge banner +
 * link-out card to the full overview Markdown on GitLab.
 *
 * Pure presentational widget. Receives the docs base URL from parent so
 * the deep-link survives a future docs-host change without editing 14 files.
 *
 * Extracted from about.component.html per Phase B-7-5 P1B, 2026-04-24.
 */
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-about-overview-tab',
  standalone: true,
  styleUrl: '../about.component.scss',
  template: `
    <article class="card intro-card hero-card">
      <div class="hero-illustration">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="hero-svg">
          <!-- Sky gradient background -->
          <defs>
            <radialGradient id="sky" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stop-color="#1e3a5f" stop-opacity="0.15" />
              <stop offset="100%" stop-color="#1e3a5f" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r="55"
            fill="url(#sky)"
            stroke="var(--color-accent)"
            stroke-width="0.5"
            opacity="0.3"
          />
          <!-- Tower body -->
          <rect
            x="50"
            y="65"
            width="20"
            height="38"
            rx="2"
            fill="var(--color-accent)"
            opacity="0.8"
          />
          <!-- Tower platform / observation deck -->
          <rect x="44" y="58" width="32" height="7" rx="2" fill="var(--color-accent)" />
          <!-- Battlements -->
          <rect x="44" y="53" width="6" height="5" rx="1" fill="var(--color-accent)" />
          <rect x="53" y="53" width="6" height="5" rx="1" fill="var(--color-accent)" />
          <rect x="62" y="53" width="6" height="5" rx="1" fill="var(--color-accent)" />
          <rect x="71" y="53" width="5" height="5" rx="1" fill="var(--color-accent)" />
          <!-- Tower window (eye/lens) -->
          <ellipse
            cx="60"
            cy="75"
            rx="5"
            ry="4"
            fill="var(--bg-main)"
            stroke="var(--color-accent)"
            stroke-width="1"
          />
          <circle cx="60" cy="75" r="2" fill="#60a5fa" opacity="0.8" />
          <!-- Binoculars on platform -->
          <circle cx="55" cy="61" r="2.5" fill="none" stroke="#93c5fd" stroke-width="1.2" />
          <circle cx="65" cy="61" r="2.5" fill="none" stroke="#93c5fd" stroke-width="1.2" />
          <rect x="57" y="60.5" width="6" height="1" fill="#93c5fd" />
          <!-- Radar sweep arcs (right) -->
          <path
            d="M 82 45 A 12 12 0 0 1 94 57"
            stroke="#34d399"
            stroke-width="1.2"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 82 38 A 19 19 0 0 1 101 57"
            stroke="#34d399"
            stroke-width="1"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M 82 31 A 26 26 0 0 1 108 57"
            stroke="#34d399"
            stroke-width="0.8"
            fill="none"
            opacity="0.3"
          />
          <!-- Signal dot -->
          <circle cx="86" cy="48" r="2" fill="#34d399" opacity="0.9" />
          <!-- Stars / metrics dots -->
          <circle cx="25" cy="30" r="1" fill="#60a5fa" opacity="0.7" />
          <circle cx="35" cy="22" r="1.5" fill="#60a5fa" opacity="0.5" />
          <circle cx="15" cy="45" r="1" fill="#34d399" opacity="0.6" />
          <circle cx="95" cy="25" r="1" fill="#60a5fa" opacity="0.5" />
          <circle cx="30" cy="90" r="1" fill="#34d399" opacity="0.4" />
          <!-- Ground base -->
          <rect
            x="30"
            y="103"
            width="60"
            height="3"
            rx="1.5"
            fill="var(--color-accent)"
            opacity="0.3"
          />
          <rect
            x="40"
            y="106"
            width="40"
            height="2"
            rx="1"
            fill="var(--color-accent)"
            opacity="0.15"
          />
        </svg>
      </div>
      <div class="hero-text">
        <h3>What is Mirador?</h3>
        <p>
          A full-stack <strong>observability and management platform</strong> built with Angular 21
          and Spring Boot 4. It demonstrates production-grade patterns for distributed tracing,
          structured logging, metrics collection, continuous profiling, chaos testing, and
          resilience — all visible and controllable from the browser.
        </p>
        <p class="hero-tagline">
          <em>Mirador</em> — Spanish for <em>watchtower</em> or <em>viewpoint</em>. A place to
          watch, understand, and act.
        </p>
        <div class="hero-links">
          <a href="https://gitlab.com/mirador1" target="_blank" rel="noopener" class="hero-link">
            🦊 gitlab.com/mirador1
          </a>
          <a
            href="https://mirador1.gitlab.io/mirador-service/"
            target="_blank"
            rel="noopener"
            class="hero-link"
          >
            🚀 Live demo (static landing page)
          </a>
        </div>
      </div>
    </article>

    <!-- Tech stack badge banner -->
    <div class="tech-badges">
      <img
        src="https://img.shields.io/badge/Java-25-ED8B00?logo=openjdk&logoColor=white"
        alt="Java 25"
      />
      <img
        src="https://img.shields.io/badge/Spring_Boot-4-6DB33F?logo=springboot&logoColor=white"
        alt="Spring Boot 4"
      />
      <img
        src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white"
        alt="PostgreSQL 17"
      />
      <img
        src="https://img.shields.io/badge/Apache_Kafka-3.8-231F20?logo=apachekafka&logoColor=white"
        alt="Apache Kafka"
      />
      <img
        src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white"
        alt="Redis 7"
      />
      <img
        src="https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white"
        alt="Angular 21"
      />
      <img
        src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"
        alt="Docker"
      />
      <img
        src="https://img.shields.io/badge/GitLab_CI-CD-FC6D26?logo=gitlab&logoColor=white"
        alt="GitLab CI"
      />
      <img
        src="https://img.shields.io/badge/OpenTelemetry-traces%20·%20logs%20·%20metrics-7F52FF?logo=opentelemetry&logoColor=white"
        alt="OpenTelemetry"
      />
      <img
        src="https://img.shields.io/badge/Ollama-LLM-000000?logo=ollama&logoColor=white"
        alt="Ollama"
      />
      <img
        src="https://img.shields.io/badge/Keycloak-OAuth2-4D9B46?logo=keycloak&logoColor=white"
        alt="Keycloak"
      />
    </div>

    <article class="card doc-pane">
      <h3>Architecture overview</h3>
      <p class="doc-pane-summary">
        Eight-layer diagram — Client → Application → Data stores → Admin tools → Collectors →
        Dashboards — with a per-layer responsibility table and the full request-response flow
        through Kafka request-reply. Full prose was extracted to the versioned Markdown docs
        (ADR-0008 About trim).
      </p>
      <a
        [href]="docsBase() + '/overview.md'"
        target="_blank"
        rel="noopener noreferrer"
        class="doc-pane-link"
      >
        📖 Read the full overview on GitLab ↗
      </a>
    </article>
  `,
})
export class AboutOverviewTabComponent {
  /** Root URL for architecture docs on GitLab — passed by parent. */
  readonly docsBase = input.required<string>();
}
