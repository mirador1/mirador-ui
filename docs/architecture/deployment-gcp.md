# Google Cloud — GKE Autopilot

Production deployment on GKE Autopilot with Cloud SQL, Memorystore, Managed Kafka, Grafana Cloud, and Auth0.

## Live project links

- [GCP Console — project mirador](https://console.cloud.google.com/home/dashboard?project=project-8d6ea68c-33ac-412b-8aa)
- [GKE Cluster — mirador-prod (europe-west1)](https://console.cloud.google.com/kubernetes/clusters/details/europe-west1/mirador-prod/details?project=project-8d6ea68c-33ac-412b-8aa)
- [Application — mirador1.duckdns.org](http://mirador1.duckdns.org)
- [GitLab — mirador1 group](https://gitlab.com/mirador1)

The production environment runs on **GKE Autopilot** — Google's fully managed Kubernetes offering where node provisioning, scaling, and patching are handled by GCP. All stateful infrastructure (database, cache, message broker) is **managed by Google**, eliminating operational overhead for maintenance and failover.

## Managed services

| Service | GCP Product | Local equivalent | Cost reference |
| --- | --- | --- | --- |
| PostgreSQL 17 | Cloud SQL | postgres container | ~$7/month (db-f1-micro), ~$1.70/month storage only when stopped |
| Redis 7 | Memorystore | redis container | ~$16/month (BASIC 1 GB) |
| Kafka 3.x | Google Managed Kafka | kafka container (KRaft) | ~$35/day (3 brokers × 3 vCPU) — use 1 vCPU in dev |
| Kubernetes | GKE Autopilot | kind cluster | ~$0.10/hour cluster management fee |
| Observability (traces, metrics, logs) | [Grafana Cloud](https://grafana.com/products/cloud/) | LGTM all-in-one container (Grafana + Tempo + Loki + Mimir) | Free tier — 50 GB logs, 10 k metrics, 50 GB traces / month |
| Authentication (OAuth2/OIDC) | [Auth0](https://auth0.com) | Keycloak container | Free tier — 7 500 MAU, unlimited social logins |

## Why managed services?

Managed services delegate scaling, patching, backups, and failover to the cloud provider. Cloud SQL enables **PITR** (point-in-time recovery), Memorystore provides **automatic failover replicas**, and Google Managed Kafka is **100% Kafka-compatible** — no code changes needed vs a self-hosted broker. Pub/Sub was not chosen because it requires rewriting all Spring Kafka consumers and producers.

**Grafana Cloud** replaces the local LGTM container — same dashboards, same OTLP protocol, no self-hosted storage to manage. The free tier covers development and low-traffic production workloads. **Auth0** replaces the local Keycloak container — fully managed OAuth2/OIDC with a generous free tier (7 500 MAU), social login, and MFA out of the box.

## Database authentication — Cloud SQL Auth Proxy

The backend pod connects to PostgreSQL via a **Cloud SQL Auth Proxy sidecar**. The proxy uses **Workload Identity** to authenticate with GCP (`mirador-sql-proxy` GCP service account) — no passwords are stored in the pod.

```
Backend pod:
  containers:
    - name: backend           # Spring Boot — DB_HOST=127.0.0.1
    - name: cloud-sql-proxy   # cloud-sql-proxy listens on :5432, forwards to Cloud SQL over mTLS
```

## Observability — Grafana Cloud (OTLP)

Traces, metrics, and logs are pushed from the Spring Boot backend to **Grafana Cloud** via the OpenTelemetry OTLP/HTTP protocol. The free tier covers 50 GB of logs, 10 k active Prometheus metrics series, and 50 GB of traces per month — sufficient for a dev/staging workload.

| Signal | Protocol | Grafana Cloud product |
| --- | --- | --- |
| Traces | OTLP/HTTP → /v1/traces | Grafana Tempo |
| Metrics | Prometheus remote_write | Grafana Mimir |
| Logs | OTLP/HTTP → /v1/logs | Grafana Loki |

```
# K8s Secret (set via GitLab CI variable GRAFANA_OTLP_ENDPOINT + GRAFANA_OTLP_TOKEN)
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(instanceId:apiKey)>
```

## Authentication — Auth0 (OAuth2/OIDC)

The Spring Boot backend validates JWT tokens issued by **Auth0**. The Angular frontend redirects unauthenticated users to the Auth0 Universal Login page. Auth0 handles token issuance, refresh, MFA, and social logins — no passwords stored in the application.

| Config key | Value (example) | Notes |
| --- | --- | --- |
| `AUTH0_DOMAIN` | `mirador.eu.auth0.com` | Issuer URI = `https://<domain>/` |
| `AUTH0_CLIENT_ID` | (from Auth0 app settings) | Angular SPA client |
| `AUTH0_CLIENT_SECRET` | (from Auth0 app settings) | Backend resource server validation |
| `AUTH0_AUDIENCE` | `https://mirador-api` | API identifier registered in Auth0 |

Auth0 replaces the local `Keycloak :9090` container in production — the same Spring Security OAuth2 Resource Server configuration works with both, only the issuer URI changes.

## Infrastructure as Code — Terraform

All GCP resources are defined in `terraform/gcp/`. State is stored in a GCS bucket (private, versioning enabled). Applying the Terraform plan provisions the full environment in about 15 minutes.

```bash
# One-time setup
./run.sh gcp-enable-apis     # enable container, sqladmin, redis, managedkafka APIs
./run.sh gcp-tf-bucket       # create GCS bucket for Terraform state

# Infrastructure lifecycle
./run.sh tf-plan             # preview changes (safe, no modifications)
./run.sh tf-apply            # create/update all GCP resources
./run.sh tf-destroy          # delete everything (requires confirmation)
```

## Terraform file layout

| File | Contents |
| --- | --- |
| `main.tf` | VPC, GKE Autopilot cluster, Cloud SQL, Memorystore Redis, Workload Identity |
| `kafka.tf` | Google Managed Kafka (activate with `kafka_enabled = true`) |
| `variables.tf` | project_id, region, environment, kafka_enabled, instance sizes |
| `outputs.tf` | GKE endpoint, Cloud SQL connection name, Redis host, Kafka bootstrap |
| `backend.tf` | GCS remote state backend configuration |
| `terraform.tfvars.example` | Template — copy to `terraform.tfvars` and fill in project ID |

## CI/CD — GitLab pipeline

Pushing to `main` triggers the `deploy:gke` job automatically. The `terraform-apply` job is manual (requires explicit pipeline trigger) to prevent accidental infrastructure changes.

| Stage | Job | Trigger |
| --- | --- | --- |
| build | `docker-build` | Every push — pushes `registry/backend:sha` and `frontend:sha` |
| infra | `terraform-plan` | Auto on `main` + MRs — preview infra changes |
| infra | `terraform-apply` | Manual ▶ — applies Terraform plan to GCP |
| deploy | `deploy:gke` | Auto on `main` — `envsubst | kubectl apply` |

## Custom domain + HTTPS

The application is reachable at [mirador1.duckdns.org](http://mirador1.duckdns.org) via [DuckDNS](https://www.duckdns.org) — a free dynamic DNS service. The A record points to the GKE ingress IP `34.52.233.183`. No annual fee, no credit card.

HTTPS will be enabled automatically once cert-manager is installed on the cluster — it requests a Let's Encrypt certificate for `mirador1.duckdns.org` on first deploy. The `K8S_HOST` GitLab CI variable is already set to `mirador1.duckdns.org`.

```bash
# DuckDNS setup (already done)
# 1. Account at duckdns.org → subdomain "mirador1" created
# 2. A record: mirador1.duckdns.org → 34.52.233.183
# 3. GitLab CI group variable: K8S_HOST=mirador1.duckdns.org

# To update the IP if it changes (e.g. after cluster recreation):
curl "https://www.duckdns.org/update?domains=mirador1&token=<TOKEN>&ip=<NEW_IP>"
```

## Deployment checklist

1. Install prerequisites: `brew install google-cloud-sdk terraform`
2. Create GCP project and authenticate: `gcloud auth application-default login`
3. Create [Grafana Cloud](https://grafana.com/auth/sign-up) account (free) → get OTLP endpoint + API key → set GitLab CI variables `GRAFANA_OTLP_ENDPOINT` and `GRAFANA_OTLP_TOKEN`
4. Create [Auth0](https://auth0.com/signup) account (free) → create tenant + SPA app → set CI variables `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`
5. Enable APIs: `./run.sh gcp-enable-apis`
6. Create Terraform state bucket: `./run.sh gcp-tf-bucket`
7. Fill `terraform/gcp/terraform.tfvars` (copy from `.example`)
8. Preview infrastructure: `./run.sh tf-plan`
9. Apply infrastructure: `./run.sh tf-apply` (~15 min)
10. Push to `main` → CI `deploy:gke` triggers automatically
11. (Optional) Register domain → add A record → set `K8S_HOST` CI variable → cert-manager issues HTTPS certificate automatically

---
[← Back to architecture index](README.md)
