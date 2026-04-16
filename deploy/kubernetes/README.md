# `deploy/kubernetes/` — Kubernetes manifests for the Angular frontend

This directory holds the K8s resources applied by the `deploy:*` jobs in
`.gitlab-ci.yml`. The frontend runs as a static-file nginx container serving
the production build output from `dist/` — tiny image, no JVM, no runtime
dependencies other than the compiled JS/HTML/CSS bundle.

## Sub-directories

| Directory                 | Role                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`frontend/`](frontend/)  | Deployment + Service for the `customer-ui` nginx container. Image built by this repo's `docker-build` CI job and pushed to `registry.gitlab.com/mirador1/mirador-ui`. |

## How this relates to `mirador-service`'s `deploy/kubernetes/`

The Spring Boot backend repository has its own `deploy/kubernetes/` directory with its
own Deployment, Service, HPA, ConfigMap, Ingress, etc. Both projects share
the **same K8s namespace (`app`)** and the **same Ingress** — the
backend's `deploy/kubernetes/ingress.yaml` routes `/api/*` → backend and `/*` → frontend
on the shared hostname (`mirador1.duckdns.org`). So this directory only
owns the frontend resources; the Ingress lives in `mirador-service/deploy/kubernetes/`.

## Deploy flow (from `.gitlab-ci.yml`)

```
docker-build → push image to registry.gitlab.com/mirador1/mirador-ui:$SHA
  ↓
deploy:gke → kubectl apply deploy/kubernetes/frontend/{deployment,service}.yaml
               (envsubst substitutes $IMAGE_TAG, $CI_REGISTRY_IMAGE)
```

The backend's deploy:gke does NOT apply these files — each repo deploys
its own image to avoid tag mismatches.

## What NOT to put here

- **Ingress** → belongs in `mirador-service/deploy/kubernetes/ingress.yaml` (single
  entry point for both frontend and backend).
- **Cloud infrastructure** (VPC, GKE cluster) → `mirador-service/terraform/gcp/`.
- **Local Docker Compose configs** → this repo has none (the frontend runs
  via `ng serve --proxy-config proxy.conf.json` locally, not a Docker
  container).

## Related files

- `Dockerfile` (repo root) — nginx image definition.
- `nginx.conf` (repo root) — nginx server config baked into the image.
- `.gitlab-ci.yml` — `deploy:*` jobs that apply these manifests.
