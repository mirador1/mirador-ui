# Architecture

Extracted prose content of every tab from the About page (`src/app/features/about/about.component.html`). One Markdown file per tab, plus this index.

| Page | Description |
| --- | --- |
| [Overview](overview.md) | Full-stack observability and management platform built with Angular 21 and Spring Boot 4. |
| [Infrastructure](infrastructure.md) | All services, host ports, `bin/run.sh` command reference and external SaaS dependencies. |
| [Deployment](deployment.md) | Architecture overview and comparison of the three supported deployment modes. |
| [Docker](deployment-docker.md) | Local docker-compose deployment — the fastest way to run the full stack. |
| [Kubernetes local](deployment-kubernetes.md) | kind (Kubernetes IN Docker) cluster mirroring the production setup on your laptop. |
| [Google Cloud](deployment-gcp.md) | Production deployment on GKE Autopilot with Cloud SQL, Memorystore, Managed Kafka, Grafana Cloud, and Auth0. |
| [Technology stack](technology-stack.md) | All technologies used in this project, alphabetically sorted, with usage notes. |
| [Compatibility](compatibility.md) | Maven profiles for Spring Boot × Java version combinations, and the source-overlay technique. |
| [Observability](observability.md) | Instrument-once signal routes (traces, logs, metrics, profiles) and key correlation patterns. |
| [Resilience](resilience.md) | Four resilience patterns demonstrable interactively: rate limit, circuit breaker, retry, idempotency. |
| [Security](security.md) | Authentication modes, role-based access control, and vulnerable demo endpoints. |
| [Messaging](messaging.md) | Kafka KRaft pipeline, topic configuration, and monitoring tools. |
| [Data layer](data.md) | PostgreSQL + Redis roles, cache pattern, admin tools, and Flyway migrations. |
| [Testing](testing.md) | Test layers, frameworks, coverage, and CI integration. |

> The original tabs also contain SVG diagrams and interactive content (live container status, copy-to-clipboard code blocks, clickable external links). Those are preserved in the UI — each Markdown file flags where a diagram lived.
