# Proxy Configuration

The Angular dev server proxies several routes to avoid CORS issues during development. Configured in `config/proxy.conf.json` and wired into `ng serve` via `angular.json`.

## Rules

| Frontend Path | Target | Purpose |
|---|---|---|
| `/docker-api/*` | `localhost:3333` | Docker control API + Zipkin/Loki proxy |
| `/proxy/kafka-ui/*` | `localhost:9080` | Kafka UI API (topology health checks) |
| `/proxy/ollama/*` | `localhost:11434` | Ollama API (topology health checks) |
| `/proxy/keycloak/*` | `localhost:9090` | Keycloak API |

## Why a proxy

Zipkin, Loki, Kafka UI, Ollama and Keycloak do not send `Access-Control-Allow-Origin` for browser calls from `localhost:4200`. Rather than shipping custom CORS config into each service (which would only help development), the dev server proxies calls through a same-origin path so the browser sees them as first-party requests.

In production, these routes are served by Nginx — see `deploy/nginx.conf`.

## See also

- [Docker control API](docker-api.md) — the `/docker-api/*` target
- [Ports](../reference/ports.md) — URLs of every proxied service
