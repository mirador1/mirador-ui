# TASKS — mirador-ui (Angular 21)

Open work only. Per `~/.claude/CLAUDE.md` rules : UI-only items here ;
done items removed (use `git tag -l` for history).

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
