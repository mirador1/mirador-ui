# Infrastructure

All services and their host ports, plus the `run.sh` command reference and external SaaS dependencies.

## Port Map

All services run on localhost. Default credentials: `admin / admin` for the Angular UI, Spring API, Keycloak, and Grafana. pgAdmin: `admin@demo.com / admin`.

### Application

| Port | Service | Notes |
| --- | --- | --- |
| `:8080` | [Customer API (local)](http://localhost:8080/swagger-ui.html) | Spring Boot — direct process (ng serve connects here) |
| `:4200` | Angular UI (ng serve) | Dev server → API on :8080 (not kind). Use :8090 for the kind cluster. |
| `:8090` | [kind ingress (HTTP)](http://localhost:8090) | nginx-ingress: frontend + /api — full stack in Kubernetes |
| `:8443` | kind ingress (HTTPS) | TLS termination in kind (self-signed cert) |

### Data Stores

| Port | Service | Notes |
| --- | --- | --- |
| `:5432` | PostgreSQL | Primary database (via DB_PORT env) |
| `:6379` | Redis | Cache, idempotency, ring buffer |
| `:9092` | Kafka | KRaft mode, PLAINTEXT_HOST listener |
| `:11434` | [Ollama](http://localhost:11434) | Local LLM (llama3.2) for /bio |
| `:9090` | [Keycloak](http://localhost:9090) | OAuth2/OIDC — admin / admin |

### Admin Tools

| Port | Service | Notes |
| --- | --- | --- |
| `:5050` | [pgAdmin](http://localhost:5050) | PostgreSQL UI (desktop mode, no login) |
| `:8081` | [pgweb](http://localhost:8081) | Lightweight SQL client + REST API |
| `:9080` | [Kafka UI](http://localhost:9080) | Topics, messages, consumer groups |
| `:5540` | [RedisInsight](http://localhost:5540) | Redis key browser, memory analysis |
| `:8082` | [Redis Commander](http://localhost:8082) | Live command monitor, auto-connects |

### CI

| Port | Service | Notes |
| --- | --- | --- |
| `—` | GitLab Runner | Executes CI jobs locally — zero gitlab.com minutes consumed |

### Observability

| Port | Service | Notes |
| --- | --- | --- |
| `:3000` | [Grafana LGTM](http://localhost:3000) | Traces · Logs · Metrics (no login) |
| `:3000` | [Grafana (LGTM)](http://localhost:3000/explore) | Tempo traces + Loki logs — use Explore for TraceQL |
| `:9091` | [Mimir](http://localhost:9091) | Metrics (Prometheus-compatible API, bundled in otel-lgtm) |
| `:3200` | Tempo API | Trace query API — use Grafana Explore for the UI |
| `:4040` | [Pyroscope](http://localhost:4040) | Continuous profiling — CPU, memory |
| `:3100` | Loki (CORS proxy) | Log queries via Nginx CORS proxy |
| `:4318` | OTLP HTTP | Spring Boot sends traces/logs here |

### Infrastructure

| Port | Service | Notes |
| --- | --- | --- |
| `:2375` | Docker API proxy | Filtered, read-only Docker Engine API |

## run.sh Commands

All commands run from the `customer-service/` directory.

| Command | Description |
| --- | --- |
| `./run.sh all` | Start everything (infra + observability + app) |
| `./run.sh restart` | Stop + restart everything (keeps data) |
| `./run.sh stop` | Stop app + all containers |
| `./run.sh nuke` | Full cleanup — containers, volumes, build artifacts |
| `./run.sh status` | Check status of all services |
| `./run.sh simulate` | Generate traffic (60 iterations, 2s pause) |
| `./run.sh obs` | Start only the observability stack (Grafana, Prometheus…) |
| `./run.sh app` | Start only the Spring Boot app |
| `./run.sh app-profiled` | Start app with Pyroscope profiling agent |
| `./run.sh test` | Unit tests (no Docker) |
| `./run.sh integration` | Integration tests (Testcontainers) |
| `./run.sh verify` | lint + unit + integration — mirrors full CI pipeline |
| `./run.sh security-check` | OWASP Dependency-Check (CVE scan) |

Pre-push hook (lefthook) runs unit tests automatically before every `git push`.

## Quick Start

```bash
# Start everything (backend + frontend)
./run.sh all

# Or start individually:
cd ../workspace-modern/customer-service
docker compose up -d                                      # Infrastructure
docker compose -f docker-compose.observability.yml up -d  # Observability
./run.sh app-profiled                                     # Backend with Pyroscope

cd ../customer-observability-ui
npm install && npm start                                  # Frontend on :4200

# Sign in: admin / admin

# Get a JWT token via curl
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

# Create a customer
curl -s -X POST http://localhost:8080/customers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'

# Generate traffic for dashboards
./run.sh simulate
```

## External Services

Cloud and SaaS services used by Mirador (require an account or subscription).

- **[GitLab](https://gitlab.com/mirador1)** — Source code, CI/CD pipelines, MR auto-merge
- **[SonarCloud](https://sonarcloud.io/project/overview?id=mirador1_mirador-service)** — Static analysis, code coverage, security hotspots
- **[Auth0](https://manage.auth0.com/)** — JWT / OIDC identity provider (alternative to Keycloak)
- **[DuckDNS](https://www.duckdns.org/)** — Free dynamic DNS for GKE public endpoint
- **[Google Cloud](https://console.cloud.google.com/)** — GKE Autopilot, Cloud SQL, Artifact Registry, Cloud Run

---
[← Back to architecture index](README.md)
