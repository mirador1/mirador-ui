# `deploy/` — Production deployment artifacts

All files under `deploy/` describe **how the frontend reaches production**.
Everything here is evaluated by the `deploy:*` CI jobs in `.gitlab-ci.yml`;
none of it affects local dev (which runs via `ng serve`, no containers).

## Sub-directories

| Directory                         | Role                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`kubernetes/`](kubernetes/)      | K8s manifests (Deployment + Service) for the `customer-ui` nginx container. Image is built by this repo's `docker-build` CI job. |

## Why group under `deploy/`?

Follows the same convention as `mirador-service`: every top-level folder
owns ONE concern — `src/` for source, `public/` for static assets,
`deploy/` for production deployment, `config/` for tool configs, etc.
When more deployment targets land (Fly.io manifests, Azure static-site
configs), they'll sit as siblings under `deploy/`.

## Relationship to `mirador-service/deploy/`

Both repos contribute K8s manifests to the **same cluster, same
namespace (`app`)**. The backend owns the shared Ingress
(`mirador-service/deploy/kubernetes/ingress.yaml`) — this repo only
ships frontend-specific Deployment + Service.

## CI wiring

| Job in `.gitlab-ci.yml` | Uses                                                 |
| ----------------------- | ---------------------------------------------------- |
| `deploy:gke`            | `deploy/kubernetes/frontend/{deployment,service}.yaml` |
| `deploy:eks` / `:aks` / `:k3s` / `:fly` (manual) | Same manifests, different cluster auth. |

## What NOT to put here

- **Source code** → `src/`
- **Static assets** → `public/`
- **Dev scripts** → `scripts/`
- **Cloud infrastructure** (VPC, GKE cluster) — lives only in
  `mirador-service/deploy/terraform/`. The frontend doesn't own any infra.
