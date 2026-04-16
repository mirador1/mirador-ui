# Mirador UI — Persistent Task Backlog

<!--
  This file is the source of truth for pending work across Claude sessions.
  Claude must READ this file at the start of every session.
  Claude must UPDATE this file whenever a task is added, started, or completed.
  Format: - [ ] pending   - [~] in progress   - [x] done (keep last 10 done for context)
  When all tasks are done, delete this file and commit the deletion.
-->

## Pending — Documentation extraction

- [ ] **Extract `about.component.html` prose to `docs/architecture/*.md`.**
      `src/app/features/about/about.component.html` is 2895 lines; roughly
      2400 are pure documentation (tab content: Overview, Infrastructure,
      Deployment, Technologies, Compatibility, Observability, Resilience,
      Security, Messaging, Data, Testing, Docker). Split each tab into its
      own `docs/architecture/<tab>.md`. The component should shrink to nav
      + SVG diagrams + an iframe / markdown renderer pulling from `docs/`.
      Keep the SVGs in the component — markdown doesn't express them well.
      Agent inventory in earlier session mapped each section to target
      file (see conversation log).


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

- [ ] **k6 smoke test post-deploy.** After `deploy:gke`, run 30 s of
      k6 traffic against `https://mirador1.duckdns.org`, validate
      p95 < 500 ms, rollback the deploy if KO.

## Pending — UI → Grafana migration audit

- [ ] **Audit every UI view that duplicates a Grafana dashboard** and
      move those to Grafana-as-Code. The `visualizations/` + parts of
      `dashboard/` + `observability/` overlap with native Grafana
      panels. Keep the UI's chaos/diagnostic/customers/request-builder
      (actually interactive) features; move pure observability reads
      to Grafana so we have one source of truth. Split criterion is
      already recorded in [ADR-0006](docs/adr/0006-grafana-duplication.md) —
      this task is the actual migration work.

## Pending — Deferred majors

- [ ] `@auth0/auth0-angular` 2.8 → 3 — major release; Angular 18+
      compat touches the provider shape.
- [ ] `typescript` 5 → 6 — hold until Angular 21 officially supports
      it. Renovate will flag when safe.

## Recently completed (keep last 10 for context)

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
