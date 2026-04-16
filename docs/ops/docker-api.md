# Docker Control API

`scripts/docker-api.mjs` is a lightweight Node.js HTTP server (port 3333) that provides two services:

1. **Docker management** — List, start, stop, restart Docker containers via `docker` CLI commands.
2. **Observability proxy** — Proxies requests to Zipkin (`:9411`) and Loki (`:3100`) to avoid CORS issues.

Started automatically by `run.sh frontend` and `npm run dev`.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/containers` | GET | List all Docker containers with status |
| `/containers/:name/start` | POST | Start a container |
| `/containers/:name/stop` | POST | Stop a container |
| `/containers/:name/restart` | POST | Restart a container |
| `/zipkin/*` | GET | Proxy to Zipkin API |
| `/loki/*` | GET | Proxy to Loki API |

## Security note

The server is intentionally bound to `localhost` only and has no authentication — it is a development convenience, not a production service. Do not expose port 3333 to any network interface.

## See also

- [Proxy configuration](proxy.md) — how the UI routes `/docker-api/*` to this server
- [Dashboard — Docker service control](../guides/user-manual.md#dashboard) — the UI that drives these endpoints
