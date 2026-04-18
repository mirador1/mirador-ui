# Mirador UI — Persistent Task Backlog

<!--
  This file is the source of truth for pending work across Claude sessions.
  Claude must READ this file at the start of every session.
  Claude must UPDATE this file whenever a task is added, started, or completed.
  Format: - [ ] pending   - [~] in progress   - [x] done (keep last 10 done for context)
  When all tasks are done, delete this file and commit the deletion.
-->

## Pending — Documentation extraction

- [~] **Extract `about.component.html` prose to `docs/architecture/*.md`.**
      Phase 1 (done): 14 tab prose extracted to `docs/architecture/*.md`
      (762 lines across 15 files including the README index). SVGs stay
      in the component.
      Phase 2 (todo): shrink `about.component.html` itself — load the
      Markdown files at runtime (via an `<iframe>` or a lightweight
      markdown-it renderer) and keep only the SVG diagrams + tab nav
      in the component. This needs a new runtime dep (markdown renderer)
      or build-time inlining; deferred because it's a user-visible
      refactor and the About page already works.


<!-- GitOps / ESO / Grafana-as-Code entries removed — per ADR-0025 in
     mirador-service the UI is no longer deployed to Kubernetes, so
     UI-side Argo CD / ESO / dashboards-as-code tasks don't apply.
     The backend holds the GitOps + ESO + dashboards machinery. -->

## Pending — Post-ADR-0025 follow-up

- [ ] **Phase 2b — strip the SQL Explorer from `database.component`.**
      The pgweb REST API the explorer called is gone (mirador-service MR 77)
      and a SQL proxy BFF is explicitly rejected (security smell — we don't
      want to re-invent pgweb's attack surface in Spring). Drop the SQL
      execution path + health checks that depend on it; keep the VACUUM
      button (goes through Spring Boot `/actuator/maintenance`, not arbitrary
      SQL) and keep the preset queries as copy-paste templates for CloudBeaver.
      ~600 LOC to delete.

- [ ] **Phase 2c — migrate remaining hardcoded `localhost:<port>` URLs
      to EnvService signals** across the Observability component
      (localhost:3000 Grafana iframes + Tempo datasource proxy). Tempo
      queries should go through the backend BFF that already exists
      (mirador-service `/obs/tempo/traces/{id}` — ADR-0024). Loki
      similarly. Deep-link buttons use `env.grafanaUrl()`.

- [ ] **Desktop deep-link buttons** from mirador-service
      `docs/getting-started/dev-tooling.md`. Add `<a href="vscode://…">` /
      `idea://…` / `docker-desktop://…` buttons on the Architecture,
      Database, and Quality pages where relevant. Fails silently if the
      target app isn't installed (the browser just does nothing — no
      feature-detection needed).

- [ ] **Move the UI image pipeline to a `test-image` stage**. The image
      is still built + pushed (useful for CI integration tests +
      prod-like local run without `npm install`) but is no longer a
      deploy artefact (ADR-0025). Tag `:main-<sha>` only, no `:latest`.


## Pending — Deferred majors

- [ ] `@auth0/auth0-angular` — no 3.x published yet (latest is 2.8.1).
      Revisit once a 3.x line appears on npm.
- [ ] `typescript` 5 → 6 — hold until Angular 21 officially supports
      it. Renovate will flag when safe.

## Recently completed (keep last 10 for context)

- [x] ADR-0007 executed: retired every Prometheus-fed UI visualisation.
      `/visualizations` feature deleted (930 LOC); Error Timeline and
      Bundle treemap moved onto the dashboard; observability lost its
      Latency Histogram + Live Feeds tabs; `MetricsService` deleted; nav
      refreshed (stale "Golden Signals (78)" / "JVM Gauges (55)" labels
      gone); `EnvService.grafanaUrl` added for in-UI deep-links.
      ~2 600 LOC removed; observability chunk 52.89 kB → 36.17 kB,
      visualizations chunk gone. Commits `1fb787e`…`259faa3`.
- [x] Word-cloud banners (`public/banner.svg` + matching
      `docs/assets/banner.svg` on mirador-service) with watchtower
      silhouette + trending-axes word cloud (platform · languages ·
      observability · data · supply chain · AI-assisted integration).
- [x] README reframed around *Mirador = watchtower* + AI-assisted
      integration on both repos.
- [x] GitLab project: `infrastructure_access_level=disabled` on
      mirador-ui so the legacy `/-/google_cloud/configuration` page no
      longer shows up — the UI repo has no Terraform / GCP resources to
      manage (only mirador-service does).
- [x] Pipeline monitor feature at `/pipelines` — lists the last 20
      pipelines with project switch + auto-refresh + job drill-down
      (● badge on `macbook-local` runner jobs). Reads through
      `scripts/docker-api.mjs` `/gitlab/*` proxy so the Spring Boot
      backend is not involved.
- [x] "Add random customer" button on the Customers page.
- [x] k6 post-deploy smoke test for the UI — `scripts/load-test/smoke.js`
      + CI `smoke-test` job running after `deploy:gke` on main. Hits
      both SPA shell paths and `/api/*` proxy paths so a broken ingress
      rewrite is caught. p95 < 500 ms + <1 % errors or the job fails.
- [x] UI → Grafana migration audit published at
      [`docs/architecture/ui-grafana-audit.md`](docs/architecture/ui-grafana-audit.md).
      Verdict: 14 stay / 0 migrate wholesale / 3 partial.
- [x] Extracted tab prose from `about.component.html` to
      `docs/architecture/*.md` (15 files, 762 lines) — phase 1 of the
      About-page docs split. SVGs and interactive bits kept in the
      component; phase 2 (collapsing the component to a markdown
      renderer) still pending.
- [x] Icons + official URLs on every entry in
      `docs/reference/technologies.md` (207 entries).
- [x] ADR-0006 records the UI-vs-Grafana duplication criterion; resolves
      both ADR-TBD references in `docs/reference/technologies.md` and
      prunes two unused browser-API entries (ResizeObserver, clipboard)
      that did not match the codebase.
- [x] `.mise.toml` pins Node, npm, and Angular CLI at the repo root
      (commit `3c758e3`).
- [x] Reorganised root: `Dockerfile` → `build/`, `nginx.conf` → `deploy/`,
      `proxy.conf.json` / `typedoc.json` / `.compodocrc.json` → `config/`.
- [x] Added READMEs in `build/`, `src/`, `src/app/`, `src/app/features/`.
- [x] Mirrored service hardening: Renovate, gitleaks, commitlint,
      release-please, Docker image security (SBOM, Grype, dockle, cosign).
- [x] 5 ADRs under `docs/adr/` — zoneless, raw SVG, Vitest, standalone.
- [x] Split monolithic README (557 lines) into docs/*.md per topic.
- [x] 1200-line technology glossary in `docs/reference/technologies.md`.
- [x] Bumped Angular patches, Vitest, Prettier, jsdom 28 → 29.
- [x] Replaced archived `sonar-scanner` with `@sonar/scan`.
