# Kubernetes Local — kind (Kubernetes IN Docker)

A **kind** cluster mirrors the production Kubernetes setup on your laptop in minutes. The full stack — backend, frontend, PostgreSQL, Redis, Kafka — runs behind an nginx-ingress on a nip.io wildcard DNS name (no `/etc/hosts` edits needed).

## Prerequisites

| Tool | Install | Purpose |
| --- | --- | --- |
| `kind` | `brew install kind` | Creates a local K8s cluster inside Docker |
| `kubectl` | `brew install kubectl` | Applies manifests, checks rollout status |
| Docker Desktop | docker.com | Hosts the kind node container |

## Quick start

```bash
./run.sh k8s-local          # create cluster + build images + deploy (~3 min first run)
./run.sh k8s-local-delete   # tear everything down
```

The script creates a single-node kind cluster, installs nginx-ingress, builds `mirador/backend:local` and `mirador/frontend:local`, loads them into kind (no registry push needed), applies all manifests, and waits for rollouts.

Access the app at **`http://mirador.127.0.0.1.nip.io:8090`** — nip.io resolves `*.127.0.0.1.nip.io` to `127.0.0.1`, so the cluster is reachable from the host without any system configuration.

## What `./run.sh k8s-local` does

| Step | Command | Notes |
| --- | --- | --- |
| 1 — Cluster | `kind create cluster --config k8s/kind-config.yaml` | Port 80→8090, 443→8443 on host |
| 2 — Ingress | `kubectl apply -f nginx-ingress` | nginx-ingress with IngressClass `nginx` |
| 3 — Backend image | `docker build → kind load` | Bypasses registry, `imagePullPolicy: IfNotPresent` |
| 4 — Frontend image | `docker build → kind load` | Angular prod build with nginx |
| 5 — Secrets | `kubectl create secret generic app-secrets` | DB_PASSWORD, JWT_SECRET, API_KEY |
| 6 — Manifests | `envsubst | kubectl apply -f` | All `k8s/` YAMLs with variables substituted |
| 7 — Wait | `kubectl rollout status` | Waits for backend + frontend pods to be Ready |

## Kubernetes manifests layout

```
k8s/
├── kind-config.yaml          # kind cluster: port mappings, ingress-ready label
├── local/
│   └── ingress.yaml          # HTTP-only ingress for local testing
├── gke/
│   ├── ingress.yaml          # HTTPS ingress with cert-manager (production)
│   └── cloud-sql-proxy.yaml  # Workload Identity + Cloud SQL Auth Proxy sidecar
├── backend/
│   ├── deployment.yaml       # Spring Boot pod (2 replicas in prod)
│   ├── service.yaml          # ClusterIP on port 8080
│   └── configmap.yaml        # ENV vars: DB_URL, REDIS_HOST, KAFKA_BROKERS …
├── frontend/
│   ├── deployment.yaml       # Angular + nginx pod
│   └── service.yaml
└── infra/
    ├── postgres.yaml         # PostgreSQL (local only — Cloud SQL on GKE)
    ├── redis.yaml            # Redis (local only — Memorystore on GKE)
    └── kafka.yaml            # Kafka KRaft (local only — Managed Kafka on GKE)
```

---
[← Back to architecture index](README.md)
