# `docs/` — Auto-generated API documentation

This directory holds documentation generated from the TypeScript source by
two tools. Nothing in here is hand-written — regenerate by running the
commands below. The generated HTML is served locally by the
`mirador-service/infra/nginx/compodoc.conf` proxy at <http://localhost:8085>.

## Sub-directories

| Directory                | Generator                                         | Command                                  |
| ------------------------ | ------------------------------------------------- | ---------------------------------------- |
| [`compodoc/`](compodoc/) | [Compodoc](https://compodoc.app/) — Angular-aware API reference covering components, services, directives, pipes, and routes. | `npm run compodoc`                       |
| [`typedoc/`](typedoc/)   | [TypeDoc](https://typedoc.org/) — generic TypeScript API reference; useful for non-Angular utility modules.                   | `npm run typedoc` (config in `/typedoc.json`) |

Both folders are **git-ignored** — their content is auto-generated and can
be rebuilt anywhere at any time.

## Why two generators?

Compodoc understands Angular-specific constructs (`@Component`, `@Input`,
router config) and produces a UI optimized for navigating a component
tree. TypeDoc is purely TypeScript-aware — it gives richer coverage for
regular interfaces, types, and helper functions that aren't Angular
decorators. Neither fully replaces the other, so we ship both.

## Serving

For local dev:
```bash
npm run compodoc:serve   # opens http://localhost:8080
npm run typedoc:serve    # opens http://localhost:8081
```

In the project-wide Docker stack:
```bash
# from mirador-service repo root
./run.sh obs             # also brings up the compodoc nginx proxy
# browse to http://localhost:8085
```

## Publishing

In the GitLab CI `typedoc` job, the generated HTML is uploaded as a
pipeline artifact for download. It is NOT deployed to production — the
only "always-on" copy is the nginx compodoc container in the local stack.

## What NOT to put here

- Hand-written guides → belong in the Spring Boot project's `docs/` (it's
  the authoritative home for human-facing documentation across the
  system, not just the backend).
- Screenshots for docs → same: `mirador-service/docs/screenshots/`.
- Build output → `/dist/` (Angular production bundle).
