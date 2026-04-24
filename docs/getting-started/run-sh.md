# `bin/run.sh` Reference

The `bin/run.sh` script orchestrates the full stack. It delegates infrastructure commands to the backend's own `run.sh` (in the sibling `mirador-service` repo) rather than duplicating Docker Compose logic.

## Subcommands

| Command | Description |
|---|---|
| `./bin/run.sh` or `./bin/run.sh all` | Start everything: backend (infra + obs + app) + frontend |
| `./bin/run.sh frontend` | Frontend only (`npm start` + Docker API server) |
| `./bin/run.sh backend` | Backend only (infra + observability + Spring Boot) |
| `./bin/run.sh infra` | Infrastructure containers only (PostgreSQL, Kafka, Redis) |
| `./bin/run.sh obs` | Observability stack (Prometheus, Grafana, Zipkin, Loki...) |
| `./bin/run.sh app` | Spring Boot application only |
| `./bin/run.sh simulate` | Run backend traffic simulation scripts |
| `./bin/run.sh restart` | Stop + restart everything |
| `./bin/run.sh stop` | Stop all services (frontend + backend) |
| `./bin/run.sh nuke` | Full cleanup (containers, volumes, caches, dist, node_modules cache) |
| `./bin/run.sh status` | Show UP/DOWN status of all services |
| `./bin/run.sh check` | Pre-push checks: typecheck + prettier + tests + build |
| `./bin/run.sh check:quick` | Fast checks: typecheck + prettier + tests (no build) |
| `./bin/run.sh check:full` | Full checks: + npm audit + bundle analysis + secrets scan |

## Frontend start flow

`./bin/run.sh frontend` performs, in order:

1. `npm ci` (if `node_modules/` is missing or out of date)
2. Starts the Docker API server on port 3333 (see [docker-api.md](../ops/docker-api.md))
3. Runs `ng serve` on port 4200 with the dev proxy applied (see [proxy.md](../ops/proxy.md))

## See also

- [CI/CD](../ops/ci-cd.md) — how `check*` subcommands map to the pre-push hook and GitLab jobs
- [Environment](environment.md) — the `.env` variables `bin/run.sh` honours
