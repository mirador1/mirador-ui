# `build/` — container build context

Contains the Dockerfile used to package the Angular SPA into an Nginx-based
OCI image. Isolated from the repo root for parity with the sibling
`mirador-service/build/` layout — both repos use the same convention.

## Files

| File         | Purpose                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile` | Multi-stage: Node 22 Alpine builder → Nginx 1.27 Alpine runtime. OCI-labelled. Serves `dist/mirador-ui/browser/` from `/usr/share/nginx/html`. |

## How to build

The Dockerfile expects the **repo root** as the build context (so it can
copy `package.json`, `src/`, `angular.json`, `config/`, `public/`). Run
from the repo root, not from this directory:

```bash
# Local build
docker build -f build/Dockerfile -t mirador-ui:local .

# With explicit amd64 target (matches GKE nodes)
docker buildx build -f build/Dockerfile --platform linux/amd64 \
  -t mirador-ui:local .
```

The CI pipeline (`.gitlab-ci.yml` → `docker-build` job) uses the same
invocation, with added cache + OCI revision/created labels.

## Nginx runtime config

The Nginx config used at runtime lives at `deploy/nginx.conf` (it's a
deploy-time concern, not a build concern). The Dockerfile copies it in
during stage 2.

## What NOT to put here

- Kubernetes manifests → `deploy/kubernetes/`
- Nginx config → `deploy/nginx.conf`
- Application source → `src/`
- Angular / TypeScript / ESLint configs → repo root (tooling expects them there)
