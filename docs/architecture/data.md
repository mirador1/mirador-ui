# Data Layer

Three data stores with distinct roles, cache patterns, admin tools, and Flyway migration strategy.

## Three Data Stores — Distinct Roles

| Store | Primary role | Key features used |
| --- | --- | --- |
| **PostgreSQL 17** | Primary persistent store | Flyway versioned migrations · HikariCP pool · cursor-based pagination (`WHERE id > :cursor LIMIT n+1`) · offset pagination · `@Timed` / `@QueryMetrics` slow query detection |
| **Redis 7** | Cache, idempotency, ring buffer | Response caching with configurable TTL · idempotency key storage (24 h) · recent-customers sorted set · session data |

## Cache Pattern

- **Write-through on reads** — Customer records are stored in Redis on first read. Subsequent reads are served from cache until TTL expires or the record is updated.
- **Cache invalidation on writes** — Every PUT / PATCH / DELETE evicts the corresponding cache entry so stale data is never served.

## Admin Tools

- **pgAdmin — :5050** — Full PostgreSQL admin UI (desktop mode, no login). Schema, SQL, ERD, backup.
- **pgweb — :8081** — Lightweight read-only SQL client. The Database page uses its REST API to run 27 SQL presets directly from the browser.
- **RedisInsight — :5540** — Key browser, memory analysis, CLI. Inspect idempotency keys and ring buffer contents.
- **Redis Commander — :8082** — Live Redis command monitor. Watch real-time commands during idempotency or rate-limit demos.

## Flyway Migrations

Versioned SQL files live in `src/main/resources/db/migration/V*.sql`. Flyway runs automatically at Spring Boot startup and tracks applied migrations in the `flyway_schema_history` table.

---
[← Back to architecture index](README.md)
