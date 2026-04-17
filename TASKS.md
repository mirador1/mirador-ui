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


## Pending — Industry-standard upgrades (from the "indus" shortlist)

- [ ] **GitOps via Argo CD (or Flux).** Currently deploys are push-based
      from `.gitlab-ci.yml`. Industry pattern: CI pushes image, Argo CD
      pulls manifests from `main`. Rollback = `git revert`. Kustomize
      overlay is already in place; Argo just needs an `Application` CR
      pointing at `deploy/kubernetes/overlays/gke`.

- [ ] **External Secrets Operator + Google Secret Manager.** Replace
      CI-injected `kubectl create secret` with ExternalSecret CRDs.
      Eliminates secrets in CI variable storage.

- [ ] **Grafana-as-Code** with grizzly or jsonnet. Backend already emits
      OTLP to Grafana Cloud; dashboards are currently hand-clicked +
      not versioned. Add `deploy/grafana/` with JSON exports + grizzly
      apply step in CI.


## Pending — Deferred majors

- [ ] `@auth0/auth0-angular` 2.8 → 3 — major release; Angular 18+
      compat touches the provider shape.
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
