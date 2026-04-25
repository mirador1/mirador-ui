# TASKS — mirador-ui (Angular 21)

Source of truth for UI-only pending work across Claude sessions.
Read at session start. Update on every task change. Commit immediately.

**Per `~/.claude/CLAUDE.md` rule "One TASKS.md per project"** :
this file contains ONLY tasks that touch the UI repo. SVC tasks
live in `../workspace-modern/mirador-service/TASKS.md` ; Python tasks
in `../workspace-modern/mirador-service-python/TASKS.md`.

**Last refresh** : 2026-04-25 14:48 — split out from svc TASKS.md per
new "one TASKS.md per project" rule.

---

## ✅ Recently shipped (UI-only tags, last 10)

| Tag | Theme |
|---|---|
| [stable-v1.0.54](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.54) | **UI CI debt closed** (3/4 shields removed or scoped-out + custom sonar-scanner image multi-platform amd64+arm64 + e2e tour-seen seed + ADR-0011) |
| [stable-v1.0.53](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.53) | (rolled forward by !128/!129/!130) |
| [stable-v1.0.50](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.50) | **B-7-7b database split** : 522 → 128 LOC via 2 sibling data files (HEALTH_CHECKS + SQL_PRESET_CATEGORIES) |
| [stable-v1.0.49](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.49) | **D1 finale** : ListStateService + `eslint.config` → `config/` (root 16 → 15) |
| [stable-v1.0.48](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.48) | D1 customers Selection + Crud services (838 → 573 LOC) |
| [stable-v1.0.47](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.47) | B-7-6 diagnostic widget + B-7-7 database HealthTab + B-7-2c step 1 customers ImportExport |
| [stable-v1.0.46](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.46) | `run.sh` → `bin/run.sh` + SONAR doc + CLAUDE.md "Réduire vagues CI" rule |
| [stable-v1.0.45](https://gitlab.com/mirador1/mirador-ui/-/releases/stable-v1.0.45) | About 3-widget extraction B-7-5 P1B (about.html 613 → 251 LOC) |

---

## 🔴 Active shield — e2e:kind (TODO 2026-05-25)

`e2e:kind` job in [`.gitlab-ci/test.yml` line 82](file:///Users/benoitbesson/dev/js/mirador-ui/.gitlab-ci/test.yml)
keeps `allow_failure: true` with a 30-day exit ticket. Docker plumbing
fixed (waves 1-7 + wave 11 SPA serving via `npx serve -s` instead of
`http-server -s`), but 3 `@golden` Playwright specs still RED on main :

- `e2e/login.spec.ts:19:7` — `Login @golden › admin / admin signs in and reaches the dashboard`
- `e2e/customer-crud.spec.ts:21:7` — `Customer CRUD @golden › creates a customer, sees it in the list, deletes it`
- `e2e/health.spec.ts:21:7` — `Health @golden › dashboard reports all-green within 15s`

Failure mode = race conditions between :
- backend boot + Flyway migration completion
- Keycloak readiness for the admin/admin login flow
- dashboard's first health-poll arriving before the backend's actuator
  endpoint has all its components UP

**Latest BG agent run (2026-04-25 14:33)** : commits
[`a1eb0a8`](https://gitlab.com/mirador1/mirador-ui/-/commit/a1eb0a8)
(npx serve `-s` + tour-seen seed via `addInitScript`) +
sibling [Java MR !199](https://gitlab.com/mirador1/mirador-service/-/merge_requests/199)
CORS allowlist for `traceparent`/`tracestate`/`baggage` headers.
Progress : login.spec ✓ + health.spec ✓ + customer-crud.spec ✗
(NEW failure — POST /customers hangs server-side, status -1).
2/3 @golden green. Plan continues per ADR-0033 "10 green runs"
exit criterion.

**3-step plan** (per refreshed inline TODO + audit at
[docs/audit/ui-ci-debt-status.md](file:///Users/benoitbesson/dev/js/mirador-ui/docs/audit/ui-ci-debt-status.md)) :
1. Enrich `test-results` upload — capture `/actuator/health` JSON +
   backend container logs at failure time (only screenshots ship today).
2. Add `await page.waitForResponse(/health/)` in spec helpers so the
   dashboard's first interaction waits for backend readiness.
3. If still flaky after (1)+(2), scope-out via `rules: when: never`
   on main + leave the job manually triggerable per ADR-0033.

---

## 👤 Actions user (1-click each, manual)

- **GitHub mirror push (UI)** — `git push github main` from
  `mirador-ui`. Auto-pushed 2026-04-25 14:34 (was 158 commits behind,
  now 0). Re-run as needed when CI ships new main commits.
- **SonarCloud security_hotspots_reviewed = 0 %** — manual UI step on
  https://sonarcloud.io/project/security_hotspots?id=<ui-project>.
  Mark hotspots as "safe" with justification. Cannot be automated.

---

## 🟢 Nice-to-have (slow-day backlog — UI only)

- **Régénérer la GIF demo du README** (~30 min, needs `ffmpeg` + the
  local stack up). Visual content has drifted since 2026-04-21
  enregistrement (B-7 wave + Phase 4.1 SSE + tour-overlay tweaks).
  Run via `bin/record-demo.sh` after `bin/healthcheck-all.sh` returns
  all-green.

- **GitLab Observability** activée 2026-04-23 (ADR-0054) — usage data
  surfaces in https://gitlab.com/groups/mirador1/-/observability after
  a few `./run.sh obs` runs. Verify ingestion + dashboard surfaces.

---

## ✅ Phase B-7 splits — DONE per 1 000 LOC floor (raised 2026-04-25)

All previously-tracked components are now below the new 1 000 LOC
file-length hygiene floor (raised 500 → 1 000 per user directive).
Per "< 1 000 LOC → DO NOT split" rule, no further extraction warranted.

| File | Final LOC | Status |
|---|---|---|
| `dashboard.component.ts` | 670 | ✅ B-6b done |
| `customers.component.ts` | 457 | ✅ B-7-2c done (838 → 457 LOC -46 %) |
| `security.component.ts` | 430 | ✅ B-7-4 done (8 widgets extracted) |
| `database.component.ts` | 128 | ✅ B-7-7b done (data → HEALTH_CHECKS + SQL_PRESET_CATEGORIES) |
| `about.component.ts` | 77 | ✅ B-7-5 done (3 widgets + about-data.ts) |
| `chaos.component.ts` | 625 | ⏭ B-7-8 skipped — already DRY via `@for actions` |
| `diagnostic.component.ts` | 628 | ⏭ — under 1 000 LOC threshold |

---

## ✅ UI CI debt — net status 2026-04-25 14:30

Started 2026-04-24 with 4 `allow_failure=true` jobs failing on UI main.
After 11 waves of fixes :

- **grype:scan** : ✅ CONFIRMED CLOSED via [!120](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/120) — `/grype` absolute path, shield removed.
- **dockle** : ✅ CONFIRMED CLOSED via [!121](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/121) — svc tarball pattern (`docker:28` + `docker pull --platform` + `docker save` + `dockle --input`).
- **sonarcloud** : 🟢 SCOPED-OUT 2026-04-25 13:24 via [`fefb950`](https://gitlab.com/mirador1/mirador-ui/-/commit/fefb950) + [ADR-0011](file:///Users/benoitbesson/dev/js/mirador-ui/docs/adr/0011-sonarcloud-js-bridge-flaky.md) (`when: manual` canonical scope-out, JS bridge crash root cause).
- **e2e:kind** : 🔴 SHIELD REFRESHED 2026-04-25 with new dated TODO 2026-05-25 (30 d). See "🔴 Active shield" section above.

Full audit + verification commands :
[docs/audit/ui-ci-debt-status.md](file:///Users/benoitbesson/dev/js/mirador-ui/docs/audit/ui-ci-debt-status.md).
