# Mirador UI — Persistent Task Backlog

<!--
  This file is the source of truth for pending work across sessions.
  Claude must READ this file at the start of every session.
  Claude must UPDATE this file whenever a task is added, started, or completed.
  Format: - [ ] pending   - [~] in progress   - [x] done (keep last 10 done for context)
-->

## Pending

- [x] **TypeDoc** — typedoc@0.28 installed, typedoc.json config at repo root.
      npm run typedoc generates docs/typedoc/ (0 errors, ~44 warnings about internal types).
      CI: typedoc quality job publishes docs/typedoc/ as a 30-day pipeline artifact.
      docs/typedoc/ added to .gitignore (generated content). backend generate-reports
      job can also invoke npm run typedoc to publish alongside Maven site.
- [ ] **Maven Site tab** — the current Maven Site tab in the quality component uses an
      iframe pointing to `/maven-site/`. Consider an alternative route `/quality/site`
      that fills the full viewport (no tab chrome) for better usability of large reports.
- [x] **Pipeline history widget** — 🚀 Pipelines tab added to quality page. Backend: /actuator/quality
      now includes pipeline section (buildPipelineSection() calls GitLab API, returns last 10 pipelines).
      Angular: PipelineReport interface, colored status badges, date via .substring(0,10), link to GitLab.
      K8s: GITLAB_API_TOKEN in secrets, GITLAB_PROJECT_ID + GITLAB_HOST_URL in ConfigMap.
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
