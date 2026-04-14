# Mirador UI — Persistent Task Backlog

<!--
  This file is the source of truth for pending work across sessions.
  Claude must READ this file at the start of every session.
  Claude must UPDATE this file whenever a task is added, started, or completed.
  Format: - [ ] pending   - [~] in progress   - [x] done (keep last 10 done for context)
-->

## Pending

- [ ] Nothing explicitly pending at time of writing — add tasks here as they are requested

## Recently Completed

- [x] Zero `any` types across all components (typed interfaces: OtlpTrace, LokiQueryResult, ActuatorHealth, DockerContainer, SqlQueryResult, MaintenanceResult, ActuatorBeans, etc.)
- [x] Angular SCSS budget raised to 24 kB warning / 32 kB error (dashboard + observability legitimately large)
- [x] All NG8113 unused-import warnings eliminated — 0 warnings in production build
- [x] README: simplified quick start to minimum commands, fixed mirador-service repo reference
- [x] Activity component: silent `catch {}` replaced with ActivityService log
- [x] app-shell: merged duplicate `@angular/router` imports
