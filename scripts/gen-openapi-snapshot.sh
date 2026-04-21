#!/usr/bin/env bash
# =============================================================================
# scripts/gen-openapi-snapshot.sh — refresh docs/api/openapi.json from the
# live backend.
#
# Run this when the backend's API changed (new endpoint, new DTO field) so
# the checked-in snapshot stays the contract-source for TS type generation.
#
# Requires: the backend reachable at $BACKEND_URL (default localhost:8080).
# Start with `./run.sh` in ../workspace-modern/mirador-service or
# `./mvnw spring-boot:run`.
#
# After this, run `npm run gen:api-types` to regenerate TypeScript types
# from the new snapshot. The pair is split so the "refresh snapshot" step
# (which requires a running backend) is separate from the "regenerate
# types" step (which is deterministic and runs in CI without a backend).
#
# Env overrides:
#   BACKEND_URL   — default: http://localhost:8080
#   SNAPSHOT_PATH — default: docs/api/openapi.json (relative to repo root)
# =============================================================================
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
SNAPSHOT_PATH="${SNAPSHOT_PATH:-docs/api/openapi.json}"

# Repo root — script lives in scripts/, go up one level.
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "$SCRIPT_DIR/.." && pwd)"
TARGET="$REPO_ROOT/$SNAPSHOT_PATH"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (for JSON pretty-printing). Install: brew install jq"
  exit 2
fi

echo "▶ Fetching OpenAPI spec from $BACKEND_URL/v3/api-docs"
if ! curl -sSf -m 10 "$BACKEND_URL/v3/api-docs" -o "$TARGET.tmp"; then
  echo "Could not reach $BACKEND_URL/v3/api-docs — is the backend running?"
  echo "Start it with: cd ../workspace-modern/mirador-service && ./run.sh"
  rm -f "$TARGET.tmp"
  exit 1
fi

# Pretty-print so diffs are reviewable line-by-line when the spec changes.
# Raw springdoc output is minified single-line JSON, useless in git diff.
jq '.' "$TARGET.tmp" > "$TARGET"
rm -f "$TARGET.tmp"

LINES="$(wc -l < "$TARGET" | tr -d ' ')"
echo "Snapshot updated: $SNAPSHOT_PATH ($LINES lines)"
echo "Next: npm run gen:api-types"
