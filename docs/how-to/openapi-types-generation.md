# Auto-generate TypeScript types from the backend OpenAPI spec

**Why**: the backend (mirador-service) publishes its API shape at
`/v3/api-docs` (via springdoc). Keeping hand-written TypeScript types in the
UI next to the server's authoritative contract means every server-side DTO
change becomes a UI review task. This guide automates the diff.

**What it does**, in one sentence: a committed OpenAPI snapshot drives a
committed `generated.types.ts`; a CI check (`npm run verify:api-types`)
fails the pipeline if either side drifts without the other being regenerated.

## The moving parts

| Artifact | Path | Purpose |
|---|---|---|
| OpenAPI snapshot | [`docs/api/openapi.json`](../../docs/api/openapi.json) | Pretty-printed JSON, checked in. Source of truth for type generation. |
| Generated types | [`src/app/core/api/generated.types.ts`](../../src/app/core/api/generated.types.ts) | Auto-written by `openapi-typescript`. Never edited by hand. |
| Short aliases | [`src/app/core/api/generated-api.ts`](../../src/app/core/api/generated-api.ts) | Re-exports `ServerCustomer`, `ServerAggregatedResponse`, etc. over the awkward `components['schemas'][...]` indexing. |
| Fetch script | [`scripts/gen-openapi-snapshot.sh`](../../scripts/gen-openapi-snapshot.sh) | Pulls `/v3/api-docs` from a running backend into the snapshot. |
| Codegen script | [`scripts/gen-api-types.sh`](../../scripts/gen-api-types.sh) | Runs `openapi-typescript` snapshot → types. Deterministic. |
| Drift check | [`scripts/check-api-types-drift.sh`](../../scripts/check-api-types-drift.sh) | CI gate: types file must match what codegen would produce. |

## Day-to-day workflows

### The backend API changed (new field, new endpoint)

You're working on mirador-ui and the backend just shipped a new field on
`CustomerDto`. To mirror it:

```bash
# 1. Start the backend locally (from ../workspace-modern/mirador-service).
./run.sh    # or ./mvnw spring-boot:run

# 2. In mirador-ui:
npm run gen:api    # fetches snapshot AND regenerates types in one shot

# 3. Review the diffs — both should change together.
git diff docs/api/openapi.json src/app/core/api/generated.types.ts

# 4. Commit the pair as a single commit.
git add docs/api/openapi.json src/app/core/api/generated.types.ts
git commit -m "chore(api): regenerate TS types after <endpoint> change"
```

### You're reviewing an MR that touched the snapshot

`npm run verify:api-types` is wired into the CI `lint` stage, so a drifted
MR fails the pipeline automatically. Locally, you can run the same check:

```bash
npm run verify:api-types
# → exit 0 if committed types match snapshot
# → prints a diff preview and exit 1 otherwise
```

### You want to use a generated type in new code

Import from the short-alias file, not from the raw generated file:

```ts
import type { ServerCustomer, ServerCreateCustomerRequest } from '@core/api/generated-api';

// Example: a reactive form whose value maps 1:1 to the server request shape
interface CreateCustomerForm extends ServerCreateCustomerRequest {}
```

The aliases only pull what we've explicitly opted-in to expose. If you need
a type that isn't aliased yet, add it to `generated-api.ts` — one line.

## Why we don't replace the hand-written interfaces

The existing `Customer`, `Page<T>`, and `CustomerSummary` interfaces in
[`api.service.ts`](../../src/app/core/api/api.service.ts) document things
the OpenAPI spec doesn't:

- cache hints (the `v2.0` `createdAt` field is server-side-only on the v2 endpoint),
- null semantics (`id?: number` meaning "absent on create, present on response"),
- in-session invariants (`recent` buffer returns a subset).

A blanket swap would lose that documentation. Instead we keep the
hand-written types as the UI-facing contract and use the generated ones as
a *compatibility check source*. The `AssertCompatible<A, B>` helper in
`generated-api.ts` is the opt-in: pair a hand-written type with the server
one at a call site, and the compiler enforces they stay in sync.

## Tool choice — why `openapi-typescript` not `openapi-generator-cli`

| Criterion | `openapi-typescript` (7.x) | `openapi-generator-cli` (java) |
|---|---|---|
| Scope | Generates TS types only | Generates full Angular/React service clients |
| Install size | npm dep, ~7 MB | Requires Java + ~100 MB jar |
| Custom service concerns (tracing, ActivityService, EnvService base URL) | Kept in hand-written `ApiService` | Generated client replaces them, loses customisation |
| Zero-install for reviewers | Via `npx` | Would need Java on PATH |

A full client-generation pass (orval, `typescript-angular` template) would
force refactoring every HTTP call through the generated layer, throwing
away the hand-written `ApiService`'s tracing hooks and `EnvService`
integration. `openapi-typescript` is the narrow, high-value choice: we
only pay for the types contract, keep everything else.

## Troubleshooting

- **`Could not reach .../v3/api-docs`** — the backend isn't running, or
  springdoc is disabled in the active Spring profile. Start it with
  `./run.sh` in `../workspace-modern/mirador-service` and retry.
- **`verify:api-types` fails on CI but passes locally** — you regenerated
  the types but forgot to commit `docs/api/openapi.json`. Commit both.
- **`openapi-typescript` complains about an unsupported schema** — likely
  a `oneOf`/`anyOf` addition on the backend. Either flatten the DTO
  (preferred) or add a `--transform` flag to the codegen script.
- **`gen:api-types` output diffs wildly** — the generator version may have
  changed. `openapi-typescript` is pinned to an exact version in
  `package.json` to avoid this; upgrading is a dedicated commit.
