# Mirador UI — Persistent Task Backlog

<!--
  This file is the source of truth for pending work across sessions.
  Claude must READ this file at the start of every session.
  Claude must UPDATE this file whenever a task is added, started, or completed.
  Format: - [ ] pending   - [~] in progress   - [x] done (keep last 10 done for context)
-->

## Pending

- [ ] **TypeDoc** — add `typedoc` to `package.json` and a `typedoc.json` config.
      Generate TypeScript API docs from JSDoc comments in Angular services (ApiService,
      AuthService, MetricsService, etc.). The CI `generate-reports` job in the backend
      repo will eventually call this and publish the output alongside the Maven site.
      Config: `--entryPointStrategy expand src/app --out ../target/site/typedoc`
- [ ] **Maven Site tab** — the current Maven Site tab in the quality component uses an
      iframe pointing to `/maven-site/`. Consider an alternative route `/quality/site`
      that fills the full viewport (no tab chrome) for better usability of large reports.
- [ ] **Pipeline history widget** — call GitLab API (`GET /projects/:id/pipelines`) and
      display the last 10 pipelines (status + duration) in the quality page or a new
      tab. Requires `GITLAB_TOKEN` to be passed as a config value (env var or actuator).
- [ ] **Active branches widget** — display git branches with last-commit date in the
      About page or quality page. Data from the backend: add a `/actuator/git-info` or
      `/actuator/quality` sub-section that calls `git branch -r --sort=-committerdate`.

## Recently Completed

- [x] SonarQube node added to dashboard topology (port 9000); SonarQube link in quality page
      raw reports section; dashboard labels clarified: "Maven Site (API)" / "Compodoc (UI)"
- [x] Runtime tab in quality page: active profiles, uptime, JAR layers
- [x] Maven Site tab in quality page: iframe + navigation links (guarded by availability check)
- [x] Backend Report menu item: label updated in app-shell nav
- [x] Zero `any` types across all components (typed interfaces: OtlpTrace, LokiQueryResult, ActuatorHealth, DockerContainer, SqlQueryResult, MaintenanceResult, ActuatorBeans, etc.)
- [x] Angular SCSS budget raised to 24 kB warning / 32 kB error (dashboard + observability legitimately large)
- [x] All NG8113 unused-import warnings eliminated — 0 warnings in production build
- [x] README: simplified quick start to minimum commands, fixed mirador-service repo reference
- [x] Activity component: silent `catch {}` replaced with ActivityService log
- [x] app-shell: merged duplicate `@angular/router` imports
