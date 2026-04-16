# Quick Start

How to install prerequisites, clone both repos, and boot the full stack for the first time.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 22 LTS | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **npm** | 10 | bundled with Node 22 |
| **Docker Desktop** | 4.x | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Java** | 17 / 21 / 25 (default: 25) | [sdkman.io](https://sdkman.io) `sdk install java 25-open` |
| **Git** | any | pre-installed on most systems |

Both repos must live as siblings (the frontend's `run.sh` locates the backend by relative path):

```
dev/
  workspace-modern/mirador-service/   ← backend
  js/mirador-ui/                       ← this repo (frontend)
```

## First-time setup — complete stack

```bash
# Clone both repos (run from your dev root)
git clone https://gitlab.com/benoit.besson/mirador-service.git workspace-modern/mirador-service
git clone https://gitlab.com/benoit.besson/mirador-ui.git js/mirador-ui

# Start everything — one command
bash js/mirador-ui/run.sh
```

Docker starts automatically. Sign in with **admin / admin** at http://localhost:4200.

## Backend only

```bash
bash workspace-modern/mirador-service/run.sh all
# → API at http://localhost:8080/swagger-ui.html  (admin/admin)
```

## Next steps

- [run.sh reference](run-sh.md) — every subcommand of the launcher
- [Environment configuration](environment.md) — customise ports via `.env`
- [User manual](../guides/user-manual.md) — per-feature walkthrough of the UI
- [Port map](../reference/ports.md) — full list of local URLs
