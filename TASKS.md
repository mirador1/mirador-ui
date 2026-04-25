# TASKS — mirador-ui (Angular 21)

Open work only. Per `~/.claude/CLAUDE.md` rules : UI-only items here ;
done items removed (use `git tag -l` for history).

---

## 🟡 Verification window — e2e:kind 3-step plan SHIPPED

`e2e:kind` job in [`.gitlab-ci/test.yml`](file:///Users/benoitbesson/dev/js/mirador-ui/.gitlab-ci/test.yml)
keeps `allow_failure: true` until the verification window confirms green.

- ✅ **Step 1 SHIPPED 2026-04-25 15:05** (commit
  [`2fbdb17`](https://gitlab.com/mirador1/mirador-ui/-/commit/2fbdb17))
  — `e2e-debug/` artifact bundle (actuator JSON + backend log + compose
  container states + per-container `docker logs --tail=200`).
- ✅ **Step 2 SHIPPED 2026-04-25 15:05** (same commit) —
  `e2e/helpers/wait-for-backend.ts` polls composite `/actuator/health` 25s
  with fallback to `/actuator/health/liveness` 30s ; called in
  `beforeEach` of all 3 @golden specs.
- ✅ **Step 3 SHIPPED 2026-04-25 22:05** (this wave) — bumped
  `customer-crud.spec.ts` line 87 assertion timeout 10s → 25s. Root cause
  was the svc backend's
  [`KafkaCustomerEventPublisher`](file:///Users/benoitbesson/dev/workspace-modern/mirador-service/src/main/java/com/mirador/messaging/KafkaCustomerEventPublisher.java)
  blocking `kafkaTemplate.send(...).get(5s)` × 3 retries × 200/400ms backoff
  ≈ 15.6 s worst case when Kafka is in rebootstrap loop (KRaft single-node,
  documented in `.gitlab-ci/test.yml` lines 281-285). 10s timeout was
  structurally doomed under documented CI Kafka conditions ; 25s gives 9s
  of headroom.
- ☐ **Exit criterion** : wait for the next 5 main runs with all 3 steps
  in effect (`gitlab-runner` currently OFFLINE — pipelines queue until
  the user starts the runner via `docker compose -f deploy/compose/runner.yml
  up -d` from svc repo). If 5/5 still RED, scope-out via
  `rules: - if: $CI_COMMIT_BRANCH == "main" when: never` + `- when: manual`
  per CLAUDE.md "surgical fixes, not allow_failure bypasses" rule (c).
- ☐ **Final flip** : 10 consecutive green main runs before flipping
  `allow_failure: true` → `false` per ADR-0033.

---

## 🟢 Nice-to-have

- ☐ **Régénérer la GIF demo du README** (~30 min). Visual content has
  drifted since 2026-04-21 (B-7 wave + Phase 4.1 SSE + tour-overlay).
  Run via `bin/record-demo.sh` after `bin/healthcheck-all.sh` returns
  all-green. Previously blocked by yanked `redis-commander:0.8.1` ;
  unblocked by svc commit
  [991f385](https://gitlab.com/mirador1/mirador-service/-/commit/991f385)
  (drop redis-commander from `./run.sh all`). Retry once svc main
  catches that commit.
