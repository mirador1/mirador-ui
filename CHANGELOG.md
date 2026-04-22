# Changelog

All notable changes to Mirador UI — Angular 21 frontend.

Format: hand-rolled summary per `stable-vX.Y.Z` tag. Same pattern as
the [svc repo CHANGELOG.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/CHANGELOG.md).

[release-please](https://github.com/googleapis/release-please) is
configured (`config/release-please-config.json`) but dormant pending
`$RELEASE_PLEASE_TOKEN` CI variable provisioning — see the shared
activation runbook at
[mirador-service/docs/how-to/activate-release-please.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/how-to/activate-release-please.md).
Once activated on this repo too, release-please appends new entries
above this historical block.

## [stable-v1.0.11] — 2026-04-22

**Aligned with svc stable-v1.0.11** for cross-repo snapshot clarity.

### Changed

- [`efcffb6`](https://gitlab.com/mirador1/mirador-ui/-/commit/efcffb6)
  — `fix(ci): dedupe path filter + add .prettierrc`. Cleanup of the
  dual-insertion side-effect from `b9734ea` (eslint.config.mjs +
  .gitleaks.toml added twice per rule block). Also extends the
  workflow path filter with `.prettierrc` (gates `lint:format` job).

## [stable-v1.0.10] — 2026-04-22

**Phase A quality enforcement — UI side.**

### Added

- ESLint size + complexity rules at WARN level
  ([`b126205`](https://gitlab.com/mirador1/mirador-ui/-/commit/b126205)):
  `max-lines` 400, `max-lines-per-function` 80, `complexity` 10,
  `max-params` 5, `max-depth` 4, `max-nested-callbacks` 4. All warnings
  today; Phase C (post-Phase-B refactors) flips to errors.
- `eslint.config.mjs` + `.gitleaks.toml` added to `.gitlab-ci.yml`
  workflow path filter ([`b9734ea`](https://gitlab.com/mirador1/mirador-ui/-/commit/b9734ea))
  — closes the silent-merge gap that let MR !68 land without lint
  re-validation.

## [stable-v1.0.9] — 2026-04-21

**Phase 2 + Phase 3 UI wave.**

### Phase 2 (3 UI items)

- **2.3 D1**: OpenAPI → TypeScript types auto-gen
  ([`2c6179a`](https://gitlab.com/mirador1/mirador-ui/-/commit/2c6179a))
  — new `npm run gen:openapi-snapshot` / `gen:api-types` /
  `verify:api-types` scripts + `docs/api/openapi.json` snapshot +
  CI `openapi:types-drift` gate.
- **2.4 T1**: axe-core Playwright a11y smoke tests
  ([`5abc0cc`](https://gitlab.com/mirador1/mirador-ui/-/commit/5abc0cc))
  — login/root/chaos pages, fails on critical+serious WCAG violations.
- **2.7 DEMO3**: guided onboarding tour with signals overlay
  ([`cd021b9`](https://gitlab.com/mirador1/mirador-ui/-/commit/cd021b9))
  — `TourService` + `TourOverlayComponent`, 6 steps, `🎓` topbar replay
  button, auto-show on first sign-in, localStorage flag, 0 JS library.

### Phase 3 (2 UI items)

- **3.3 DEMO1**: `/find-the-bug` interactive scenario walkthrough
  ([`cae69a2`](https://gitlab.com/mirador1/mirador-ui/-/commit/cae69a2))
  — 3 puzzles (rate-limit, circuit-break, aggregate-storm), live
  metric sparkline, root-cause reveal after N seconds.
- **3.4 DEMO2**: `/incident-anatomy` scripted 5-min incident story
  ([`136f2da`](https://gitlab.com/mirador1/mirador-ui/-/commit/136f2da))
  — 6-step timeline (alert → runbook → trace → fix → verify).

### Auth0 work

- Auth0-aware interceptor fixes race condition on first dashboard
  load ([`19f5131`](https://gitlab.com/mirador1/mirador-ui/-/commit/19f5131)).
- Retry errors propagate cleanly without infinite logout loop
  ([`470c14a`](https://gitlab.com/mirador1/mirador-ui/-/commit/470c14a)).
- `AuthService.isAdmin` reads 3 claim shapes (built-in, Keycloak,
  Auth0 namespaced) ([`5a0d553`](https://gitlab.com/mirador1/mirador-ui/-/commit/5a0d553)).

### Chaos feature UI

- Buttons that trigger real Chaos Mesh infrastructure experiments
  (pod-kill / network-delay / cpu-stress) via the backend
  `/chaos/{experiment}` endpoint ([`a596a90`](https://gitlab.com/mirador1/mirador-ui/-/commit/a596a90)).

### Dev experience

- ESLint 9 + angular-eslint + SARIF → SonarCloud wiring
  ([`5619800`](https://gitlab.com/mirador1/mirador-ui/-/commit/5619800)).
- Devcontainer for Angular 21 + Node 22 zero-install
  ([`70eee99`](https://gitlab.com/mirador1/mirador-ui/-/commit/70eee99)).
- `@compodoc/compodoc` `@angular-devkit` override → 5 CVEs closed
  without bumping compodoc itself
  ([`5571f18`](https://gitlab.com/mirador1/mirador-ui/-/commit/5571f18)).

## [stable-v1.0.6] — [stable-v1.0.5] — 2026-04-21

**CI hygiene wave.**

- Tag-on-green rule mirrored to CLAUDE.md.
- Lighthouse absolute thresholds on a11y/bp/seo.
- Root-file hygiene pass (see `~/.claude/CLAUDE.md`).

## [stable-v1.0.4] and earlier

**Initial stability series.** Base Angular 21 + signals + zoneless
scaffold, 15 feature components across 4 groups
(core-ux / customer / infra-ops / obs).

For detail: `git log --oneline stable-v1.0.4`.

---

## Unreleased

For pending UI work (Phase B-4 CI modularisation, B-5
quality.component split, B-6 dashboard.component split), see the
[svc repo TASKS.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/TASKS.md)
— UI backlog lives there for cross-repo planning.

---

[stable-v1.0.11]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.11
[stable-v1.0.10]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.10
[stable-v1.0.9]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.9
[stable-v1.0.6]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.6
[stable-v1.0.5]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.5
[stable-v1.0.4]: https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.4
