# UI CI debt — closure status

**Snapshot date** : 2026-04-25 13:15

**Source backlog** : sibling `mirador-service/TASKS.md` → "🟡 UI CI debt
— 2026-04-24 evening + 04:49 night work" section, opened with 4 jobs
running with `allow_failure: true` shields on main and failing
consistently.

## Original 4-job set + current state

| Job | Original shield | Current shield | Status | Evidence |
|---|---|---|---|---|
| `grype:scan` | `allow_failure: true` | **REMOVED** (2026-04-24, !120) | ✅ CLOSED | 5/5 green on main pipelines #2478807674, #2478827101, #2478860588, #2479025472, #2479164348 |
| `dockle` | `allow_failure: true` | **REMOVED** (2026-04-24, !121) | ✅ CLOSED | 5/5 green since !121 (svc tarball pattern, `docker:28` + `docker save` + `dockle --input`) |
| `sonarcloud` | `allow_failure: true` | **RE-ADDED** (2026-04-25 13:21, fresh TODO 2026-05-15) | 🔴 CANNOT CLOSE | Shield was REMOVED in wave 11 commit [3e80d81](https://gitlab.com/mirador1/mirador-ui/-/commit/3e80d81), but pipeline [#463](https://gitlab.com/mirador1/mirador-ui/-/pipelines/2479217597) (post-fix verification on main) failed sonarcloud with the SAME `WebSocket connection closed abnormally` pattern that waves 7-11 were supposed to fix. Shield re-added with new 20d dated TODO + new failure-mode hypothesis (JS bridge OOM by runner per-container cap, not tree-sitter perms anymore). |
| `e2e:kind` | `allow_failure: true` | **STILL IN PLACE** ([test.yml line 82](file:///Users/benoitbesson/dev/js/mirador-ui/.gitlab-ci/test.yml)) | 🔴 CANNOT CLOSE | 5/5 RED on recent main pipelines despite wave 7 (`/proc/self/cgroup` container ID fix in !125) + wave 11 (`serve -s` SPA fallback in 3e80d81). Failure mode now in Playwright specs, not docker plumbing. New dated TODO 2026-05-25. |

## Why each remaining shield can't close yet

### `e2e:kind` — 30d exit ticket (2026-05-25)

3 `@golden` Playwright specs failing consistently on main :
- `e2e/login.spec.ts:19:7` — `Login @golden › admin / admin signs in and reaches the dashboard`
- `e2e/customer-crud.spec.ts:21:7` — `Customer CRUD @golden › creates a customer, sees it in the list, deletes it`
- `e2e/health.spec.ts:21:7` — `Health @golden › dashboard reports all-green within 15s`

The docker-network plumbing (waves 1-7) and SPA serving (wave 11) are
fixed. The remaining failures are race conditions between :
- backend boot + Flyway migration completion
- Keycloak readiness for the admin/admin login flow
- dashboard's first health-poll arriving before the backend's actuator
  endpoint has all its components UP

**Plan** (per refreshed TODO in [test.yml line 82](file:///Users/benoitbesson/dev/js/mirador-ui/.gitlab-ci/test.yml)) :
1. Enrich `test-results` upload — capture `/actuator/health` JSON +
   backend container logs at failure time (only screenshots ship today).
2. Add `await page.waitForResponse(/health/)` in the spec helpers so
   the dashboard's first interaction waits for backend readiness.
3. If still flaky after (1)+(2), scope-out via `rules: when: never`
   on main (CLAUDE.md "scope-out, not shield" pattern) — keep e2e:kind
   on MR pipelines + scheduled runs only until the flake rate is
   under 10 %.

ADR-0033 "10 green runs before flip" remains the exit criterion.

### `sonarcloud` — shield re-added 2026-04-25 13:21, 20d exit ticket (2026-05-15)

The shield was removed in commit
[3e80d81](https://gitlab.com/mirador1/mirador-ui/-/commit/3e80d81) (wave 11)
relying on cumulative wave 7-11 fixes :
- HOME=$CI_PROJECT_DIR/.sonar (writable scratch dir)
- workerCount=2, maxspace=8192 (heap headroom)
- Custom `sonar-scanner:11.5.0.2154` image with
  `chown -R scanner-cli /home/scanner-cli` at build time (wave 10
  in [build/sonar-scanner.Dockerfile](file:///Users/benoitbesson/dev/js/mirador-ui/build/sonar-scanner.Dockerfile))
- Multi-platform image build (amd64 + arm64) so the macbook-local
  arm64 runner can pull it (commit
  [46acc46](https://gitlab.com/mirador1/mirador-ui/-/commit/46acc46))

**Pipeline [#463](https://gitlab.com/mirador1/mirador-ui/-/pipelines/2479217597)
(post-fix verification on main) FAILED** at 2026-04-25 13:20:50 with the SAME
`java.lang.IllegalStateException: WebSocket connection closed abnormally`
pattern, after 14 min wall-clock and processing all 157 files :

```
Hit the cache for 0 out of 157
Miss the cache for 157 out of 157: ANALYSIS_MODE_INELIGIBLE
ERROR Error during SonarScanner Engine execution
java.lang.IllegalStateException: Analysis of JS/TS files failed
Caused by: java.lang.IllegalStateException: WebSocket connection closed abnormally
```

Shield re-added 2026-04-25 13:21 with new dated TODO 2026-05-15 (20d) and
a new failure-mode hypothesis — the tree-sitter perms fix (wave 10) is
holding (no more "Failed to create directory" error), but the JS bridge
node subprocess is dying mid-analysis. Likely root cause :

- JS bridge child process is OOM-killed by the runner's per-container
  memory cap. JVM heap (8GB) + tree-sitter AST cache + ESLint SARIF
  ingest + node child heap (8GB max via maxspace) overwhelms the
  Docker VM allocation.

**Next iteration plan** (in order) :
1. Try `workerCount=1` (was 2) to halve concurrent subprocess heap.
2. Add `-Dsonar.scanner.javaOpts="-Xmx4g"` to cap JVM heap so node has
   more room.
3. If still flaky, downgrade to a known-good sonar-scanner-cli base
   version (last good was 5.x with the legacy non-WebSocket bridge).
4. Last resort : split analysis into client-only vs spec-only passes
   (different `sonar.exclusions`) to halve files-per-run.

## Out-of-scope shields (not part of this debt)

These `allow_failure: true` declarations exist in `.gitlab-ci/` and
are NOT debt — they're intentional :

| Job | Reason | TODO date |
|---|---|---|
| `trivy:scan` | Decorative shield, `--exit-code 0` always passes; coordinated flip needs `--exit-code 1` + shield-removal in same commit. | 2026-07-20 (90d) |
| `cosign:sign` | Pre-condition unfulfilled : UI lacks a `cosign:verify` companion job (svc has one). Plan : add verify, then flip both shields. | 2026-07-20 (90d) |
| `sonar-scanner:image` | Manual-trigger job (`when: manual`) — `allow_failure: true` here means the pipeline doesn't block when nobody clicks the button. Canonical GitLab pattern. | n/a |
| `deploy.yml` × 5 | All manual deploys (k3s, fly, cloud-run, aks, eks) use the same canonical "manual + allow_failure" pattern. | n/a |

## Verification commands

```bash
# Confirm grype + dockle stay green on the next main pipeline
glab ci get -R mirador1/mirador-ui --pipeline-id <id> | grep -E "(grype|dockle):"

# Watch e2e:kind failure mode
glab ci trace -R mirador1/mirador-ui <e2e:kind-job-id> | tail -100

# Confirm sonarcloud post-shield removal
glab api "projects/mirador1%2Fmirador-ui/pipelines/<id>/jobs?per_page=50" \
  | python3 -c "import json,sys; [print(f\"{j['name']:20s} {j['status']:10s} allow_failure={j.get('allow_failure')}\") for j in json.load(sys.stdin) if j['name']=='sonarcloud']"
```
