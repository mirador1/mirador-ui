# =============================================================================
# Multi-stage Dockerfile — Angular SPA served by Nginx
#
# Stage 1 (builder): Node 22 — npm ci + ng build --configuration production
# Stage 2 (runtime): Nginx 1.27 Alpine — serves the static bundle
#
# The production build uses baseUrl: '/api' (EnvService) so all API calls
# go to the same origin — no CORS when deployed behind the Nginx Ingress.
# =============================================================================

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (separate layer — cached when only src/ changes)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build the production bundle
COPY . .
RUN npx ng build --configuration production

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy the compiled Angular app into the Nginx web root
COPY --from=builder /app/dist/mirador-ui/browser /usr/share/nginx/html

# Replace the default Nginx config with our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Nginx starts in the foreground (daemon off) — required for Docker/K8s
CMD ["nginx", "-g", "daemon off;"]
