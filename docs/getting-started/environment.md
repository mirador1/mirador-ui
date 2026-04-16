# Environment Configuration

Copy `.env.example` to `.env` and customize if your ports differ from defaults:

```bash
cp .env.example .env
```

The `.env` file is gitignored — only `.env.example` is committed.

## Variables

Variables used by `run.sh` and `scripts/pre-push-checks.sh`:

| Variable | Default | Used by |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8080` | run.sh, env selector |
| `FRONTEND_PORT` | `4200` | run.sh status |
| `GRAFANA_PORT` | `3000` | run.sh status |
| `PROMETHEUS_PORT` | `9090` | run.sh status |
| `ZIPKIN_PORT` | `9411` | proxy, observability |
| `LOKI_PORT` | `3100` | proxy, observability |
| `PYROSCOPE_PORT` | `4040` | run.sh status |
| `PGADMIN_PORT` | `5050` | run.sh status |
| `KAFKA_UI_PORT` | `9080` | run.sh status |
| `REDIS_INSIGHT_PORT` | `5540` | run.sh status |
| `KEYCLOAK_PORT` | `9090` | run.sh status |

## Keeping `.env.example` in sync

Per the global workflow rule, `.env` and `.env.example` must always have the same keys.
When adding a new variable to `.env`, immediately mirror it in `.env.example` (with a safe
placeholder value) so new contributors get a working setup.

## See also

- [Port map](../reference/ports.md) — the concrete URLs each variable maps to
- [Theming / multi-environment](../guides/theming.md) — how the UI lets you switch backend URLs live
