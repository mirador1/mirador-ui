# TASKS — mirador-ui (Angular 21)

Open work only. Per `~/.claude/CLAUDE.md` rules : UI-only items here ;
done items removed (use `git tag -l` for history).

---

## 🔴 Active shield — e2e:kind (TODO 2026-05-25)

`e2e:kind` job in [`.gitlab-ci/test.yml` line 82](file:///Users/benoitbesson/dev/js/mirador-ui/.gitlab-ci/test.yml)
keeps `allow_failure: true` with a 30-day exit ticket.

- ☐ **Step 3** : wait for next 5 main runs to confirm steps 1+2 (debug
  bundle + `waitForBackendReady` helper, both shipped 2026-04-25 15:05)
  fixed `customer-crud.spec.ts`. If 5/5 still RED, scope-out via
  `rules: when: never` on main + leave manually triggerable per ADR-0033.
- ☐ **Exit criterion** : 10 consecutive green main runs before flipping
  `allow_failure: true` → `false`.

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
