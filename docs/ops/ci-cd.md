# CI / CD

Two complementary gates keep `dev` green: a **pre-push Git hook** that runs locally before a push lands, and a **GitLab CI pipeline** that re-runs the same checks on the server.

## GitLab CI

`.gitlab-ci.yml` runs 7 jobs across 4 stages:

| Stage | Job | What it does |
|---|---|---|
| validate | `typecheck` | `tsc --noEmit` strict compilation |
| validate | `lint:format` | Prettier check |
| validate | `lint:circular-deps` | Circular import detection |
| test | `unit-tests` | Vitest on Node 22 |
| test | `unit-tests:node20` | Same on Node 20 |
| build | `build:production` | Production bundle + size analysis |
| quality | `bundle-size-check` | Bundle budget verification |
| quality | `security:audit` | npm audit + sensitive file scan |

All jobs run on the local macbook runner (arm64) — never on GitLab SaaS shared runners — to preserve paid quota.

## Pre-push Hook

A Git pre-push hook runs `scripts/pre-push-checks.sh` automatically before every push. Installed via the npm `prepare` script on `npm install`.

```bash
npm run check        # standard mode (typecheck + prettier + tests + build)
npm run check:quick  # fast mode (typecheck + prettier + tests, no build)
npm run check:full   # full mode (+ npm audit + bundle analysis + secrets scan)
```

### Checks performed

- Working tree clean
- No merge conflict markers
- No sensitive files (`.env`, `.pem`, `.key`)
- No oversized files (>500KB)
- TypeScript strict compilation
- Prettier formatting
- No `TODO` / `FIXME` / `HACK` comments
- No `console.log` statements
- Unit tests pass
- Production build succeeds
- No circular dependencies
- `npm audit` (`--full` mode only)
- Bundle size budget (`--full` mode only)

## Auto-merge workflow

Per the global workflow rule: after pushing to `dev`, set auto-merge on the MR with
`glab mr merge <id> --auto-merge --squash=false --remove-source-branch=false`. The
`--remove-source-branch=false` flag is **mandatory** — the `dev` branch must never be
deleted on merge.

## See also

- [`run.sh` reference](../getting-started/run-sh.md) — the `check`, `check:quick`, `check:full` subcommands delegate to the same script.
- [Build & quality](build-quality.md) — the npm scripts behind each check.
