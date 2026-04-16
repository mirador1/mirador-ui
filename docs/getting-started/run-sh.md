# `run.sh` Reference

The `run.sh` script at the project root orchestrates the full stack. It delegates infrastructure commands to the backend's own `run.sh` rather than duplicating Docker Compose logic.

## Subcommands

| Command | Description |
|---|---|
| `./run.sh` or `./run.sh all` | Start everything: backend (infra + obs + app) + frontend |
| `./run.sh frontend` | Frontend only (`npm start` + Docker API server) |
| `./run.sh backend` | Backend only (infra + observability + Spring Boot) |
| `./run.sh infra` | Infrastructure containers only (PostgreSQL, Kafka, Redis) |
| `./run.sh obs` | Observability stack (Prometheus, Grafana, Zipkin, Loki...) |
| `./run.sh app` | Spring Boot application only |
| `./run.sh simulate` | Run backend traffic simulation scripts |
| `./run.sh restart` | Stop + restart everything |
| `./run.sh stop` | Stop all services (frontend + backend) |
| `./run.sh nuke` | Full cleanup (containers, volumes, caches, dist, node_modules cache) |
| `./run.sh status` | Show UP/DOWN status of all services |
| `./run.sh check` | Pre-push checks: typecheck + prettier + tests + build |
| `./run.sh check:quick` | Fast checks: typecheck + prettier + tests (no build) |
| `./run.sh check:full` | Full checks: + npm audit + bundle analysis + secrets scan |

## Frontend start flow

`./run.sh frontend` performs, in order:

1. `npm ci` (if `node_modules/` is missing or out of date)
2. Starts the Docker API server on port 3333 (see [docker-api.md](../ops/docker-api.md))
3. Runs `ng serve` on port 4200 with the dev proxy applied (see [proxy.md](../ops/proxy.md))

## See also

- [CI/CD](../ops/ci-cd.md) — how `check*` subcommands map to the pre-push hook and GitLab jobs
- [Environment](environment.md) — the `.env` variables `run.sh` honours
