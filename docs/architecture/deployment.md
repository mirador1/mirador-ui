# Deployment

Architecture overview and comparison of the three supported deployment modes.

Three deployment modes are supported — see the dedicated pages:

- **[Docker](deployment-docker.md)** (local docker-compose, fastest to start)
- **[Kubernetes local](deployment-kubernetes.md)** (kind cluster, mirrors production)
- **[Google Cloud](deployment-gcp.md)** (GKE Autopilot, production)

In Kubernetes mode the two images sit behind a single Nginx Ingress, eliminating CORS entirely.

> *(Kubernetes architecture diagram rendered in the UI — see the About page, tab "Deployment". Shows Internet → Nginx Ingress Controller (namespace `ingress-nginx`) → `customer-service` and `customer-ui` (namespace `app`) → PostgreSQL, Redis, Kafka (namespace `infra`), plus a CI/CD footer with the 6 deployment targets.)*

Key facts from the diagram:

- **Internet (HTTPS)** terminates at the Nginx Ingress Controller in namespace `ingress-nginx`. Rules: `/api/(.*) → backend`, `/(.*) → frontend`.
- **`customer-service`** (namespace `app`): Spring Boot 4 · port 8080 · replicas 2 · HPA 1→5 @ 70% CPU · liveness + readiness + startup probes.
- **`customer-ui`** (namespace `app`): Angular 21 + Nginx · port 80 · replicas 2 · RollingUpdate · baseUrl `/api` (same-origin).
- **PostgreSQL 17** (namespace `infra`): StatefulSet + PVC 10 Gi · Flyway V1–V6 · `customers` + `app_user` + audit + `shedlock` tables.
- **Redis 7** (namespace `infra`): Deployment · 128 MB · JWT blacklist (TTL) · rate-limit buckets · recent customer ring buffer.
- **Kafka 3.8** (namespace `infra`): Deployment · KRaft mode · no ZooKeeper · topics: `created`, `request`, `reply`.

## Deployment targets

| Target | Type | Trigger | Use case |
| --- | --- | --- | --- |
| GKE Autopilot | Managed K8s | Auto on `main` | Default production |
| AWS EKS | Managed K8s | Manual ▶ | AWS infrastructure |
| Azure AKS | Managed K8s | Manual ▶ | Azure infrastructure |
| Cloud Run | Serverless | Manual ▶ | Low traffic / demos |
| Fly.io | PaaS | Manual ▶ | Side projects |
| k3s / bare metal | Self-hosted K8s | Manual ▶ | Hetzner / OVH / home lab |

## Local CI runner (zero gitlab.com minutes)

A local **GitLab Runner** connects to gitlab.com and executes pipeline jobs on your machine, consuming zero shared-runner minutes.

```bash
./run.sh runner                    # start the runner container
./run.sh register-cloud <TOKEN>    # link to gitlab.com project
# Get the token: gitlab.com → Project → Settings → CI/CD → Runners → New project runner
```

Every subsequent push runs the pipeline locally. See the [Docker](deployment-docker.md) page for local docker-compose setup, [Kubernetes local](deployment-kubernetes.md) for the kind cluster, and [Google Cloud](deployment-gcp.md) for GKE Autopilot.

---
[← Back to architecture index](README.md)
