# Local Deployment — Docker Compose

The fastest way to run the full stack locally. Two Docker Compose files bring up 22 containers covering the application, all infrastructure services, and the complete observability stack. No Kubernetes, no registry — everything runs on `localhost`.

## Compose files

| File | Services | Purpose |
| --- | --- | --- |
| `docker-compose.yml` | PostgreSQL, Redis, Kafka (KRaft), Ollama, Keycloak, pgAdmin, pgweb, Kafka UI, RedisInsight, Redis Commander, SonarQube, Compodoc, Maven Site | Application infrastructure — data stores and admin tools |
| `docker-compose.observability.yml` | LGTM all-in-one (Grafana + Loki + Tempo + Mimir), Prometheus, Pyroscope, Nginx CORS proxy, docker-socket-proxy | Full observability stack — metrics, traces, logs, profiling |

## Quick start

```bash
./bin/run.sh all           # start infrastructure + observability + Spring Boot app
./bin/run.sh status        # check which services are up
./bin/run.sh stop          # stop app + all containers (data preserved)
./bin/run.sh nuke          # full cleanup — containers, volumes, build artifacts
```

The Spring Boot backend starts on `:8080` and the Angular frontend on `:4200` (dev server with proxy). CORS is handled by the dev proxy — the browser talks only to `localhost:4200`.

## Useful commands

| Command | What it does |
| --- | --- |
| `./bin/run.sh all` | Start everything (infra + obs + app) |
| `./bin/run.sh obs` | Start only the observability stack |
| `./bin/run.sh app` | Start only the Spring Boot app |
| `./bin/run.sh app-profiled` | Start app with Pyroscope profiling agent |
| `./bin/run.sh restart` | Stop + restart everything (keeps data) |
| `./bin/run.sh simulate` | Generate traffic (60 iterations, 2 s pause) |
| `./bin/run.sh sonar` | Run mvn verify + SonarQube analysis |
| `./bin/run.sh security-check` | OWASP CVE scan (Dependency-Check) |

## Service access (all on localhost)

| Port | Service | Notes |
| --- | --- | --- |
| `:4200` | Angular UI (dev server) | Hot-reload, proxies /api → :8080 |
| `:8080` | Spring Boot API | REST + Actuator + SSE |
| `:3000` | Grafana | Dashboards, traces, logs |
| `:9090` | Keycloak | OAuth2 / OIDC identity provider (admin / admin) |
| `:5432` | PostgreSQL | Primary database |
| `:6379` | Redis | Cache, idempotency keys, ring buffer |
| `:9092` | Kafka | KRaft mode — PLAINTEXT_HOST listener |
| `:11434` | Ollama | LLM inference — llama3.2 model |
| `:3000` | Grafana LGTM | Traces (Tempo) · Logs (Loki) · Metrics (Mimir) · Profiles (Pyroscope) |
| `:9091` | Mimir API | Prometheus-compatible metrics query endpoint (bundled in LGTM) |
| `:4318` | OTLP HTTP | Spring Boot sends traces and logs here → Loki + Tempo |
| `:5050` | pgAdmin | PostgreSQL GUI — desktop mode (no login) |
| `:8081` | pgweb | Lightweight SQL client + REST API |
| `:9080` | Kafka UI | Topics, consumer groups, messages |
| `:5540` | RedisInsight | Redis key browser, memory analysis |
| `:8082` | Redis Commander | Live command monitor, auto-connects |
| `:9000` | SonarQube | Code quality dashboard (admin / admin) |
| `:8084` | Maven Site | JaCoCo, Surefire, SpotBugs, Pitest reports |
| `:8086` | Compodoc | Angular API documentation |

## Prerequisites

```bash
# macOS
brew install docker          # or install Docker Desktop
brew install maven           # for ./bin/run.sh build
brew install node            # for Angular dev server

# Verify
docker --version             # Docker 25+
java --version               # Java 25 (for Spring Boot 4 default profile)
mvn --version                # Maven 3.9+
```

---
[← Back to architecture index](README.md)
