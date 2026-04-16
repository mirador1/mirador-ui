# `scripts/` — Developer convenience scripts

Helpers that automate day-to-day dev tasks for the Angular frontend. None
of these scripts ship with the production build — they're local-only
tooling invoked from `package.json` scripts, `lefthook.yml` hooks, or
manually during development.

## Scripts

| Script                   | What it does                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-api.mjs`         | Lightweight HTTP proxy that exposes the local Docker Engine socket to the browser (listens on `localhost:3333`). Used by the Architecture/Topology dashboard widget to show container status + let the user stop/start services from the UI. Run via `node scripts/docker-api.mjs` (or `./run.sh docker-api`). |
| `pre-push-checks.sh`     | Orchestrated pre-push validation suite (lint + format + build + unit tests). Invoked by `lefthook.yml` on `git push` so broken code never reaches the remote. Also callable manually for a full local smoke test. |
| `README.md`              | This file.                                                                                                                                              |

## Conventions

- **Idempotent when possible** — scripts should be safe to rerun; failures
  must halt immediately (`set -euo pipefail` for bash, early `throw` for JS).
- **Env var overrides** — no hard-coded paths or ports. Defaults are
  sensible, but every tunable is exposed via `DOCKER_API_PORT`, `BASE_URL`,
  etc.
- **Document inputs** — each script has a header comment listing arguments,
  env vars, and prerequisites.

## Where to put a new script

| Kind                                     | Location                               |
| ---------------------------------------- | -------------------------------------- |
| Local dev helper, one-shot tool          | `scripts/`                             |
| CI-only one-liner                        | Inline in `.gitlab-ci.yml`             |
| Build integration (tsc/ng/eslint extras) | `package.json` `scripts:` section      |
| Git hook logic                           | `lefthook.yml` + a helper here if non-trivial |

## Running

From the project root:

```bash
# Start the Docker API proxy (listens on localhost:3333)
node scripts/docker-api.mjs

# Full pre-push suite (same thing lefthook runs automatically)
./scripts/pre-push-checks.sh
```
