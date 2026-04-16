# =============================================================================
# Multi-stage Dockerfile — Angular SPA served by Nginx.
#
# Lives under build/ for parity with the sibling mirador-service repo.
# Built from the repo root with:
#   docker build -f build/Dockerfile .
#
# Stage 1 (builder): Node 22 — npm ci + ng build --configuration production
# Stage 2 (runtime): Nginx 1.27 Alpine — serves the static bundle
#
# The production build uses baseUrl: '/api' (EnvService) so all API calls
# go to the same origin — no CORS when deployed behind the Nginx Ingress.
# =============================================================================

# ── Stage 1: build ────────────────────────────────────────────────────────────
# Pinned by tag + digest-friendly — Renovate keeps it current.
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (separate layer — cached when only src/ changes)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy source and build the production bundle. Note: build context is the
# repo root, so `COPY . .` pulls in everything (angular.json, config/,
# public/, src/, tsconfig*.json). .dockerignore keeps node_modules, dist,
# .angular, docs, .git out of the build context.
COPY . .
RUN npx ng build --configuration production

# ── Stage 2: serve ────────────────────────────────────────────────────────────
# Nginx 1.27 Alpine — minimal, well-maintained, ~50 MB image.
FROM nginx:1.27-alpine AS runtime

# OCI labels — traceability for cosign, Trivy, GitLab registry UI.
LABEL org.opencontainers.image.title="mirador-ui" \
      org.opencontainers.image.description="Mirador Angular 21 SPA" \
      org.opencontainers.image.source="https://gitlab.com/mirador1/mirador-ui" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.vendor="mirador1" \
      org.opencontainers.image.base.name="nginx:1.27-alpine"

# Copy the compiled Angular app into the Nginx web root.
# Ownership is left to the nginx default user (already non-root in :alpine).
COPY --from=builder /app/dist/mirador-ui/browser /usr/share/nginx/html

# Replace the default Nginx config with our SPA-aware config.
# Source lives under deploy/ (build context is the repo root).
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Nginx starts in the foreground (daemon off) — required for Docker/K8s.
CMD ["nginx", "-g", "daemon off;"]
