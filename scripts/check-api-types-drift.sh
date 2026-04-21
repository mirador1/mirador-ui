#!/usr/bin/env bash
# =============================================================================
# scripts/check-api-types-drift.sh — CI gate: verify src/app/core/api/
# generated.types.ts matches what scripts/gen-api-types.sh would produce.
#
# Rationale: the committed generated.types.ts MUST stay in sync with
# docs/api/openapi.json. A reviewer changing the snapshot (new endpoint)
# but forgetting to regenerate the TS types would silently break the UI
# contract. This script runs `gen-api-types.sh` against a temp file and
# diffs it against the committed one; non-zero exit = drift.
#
# Run locally: npm run verify:api-types
# Run in CI:   wire this into the UI pipeline (lint stage).
# =============================================================================
set -euo pipefail

SNAPSHOT_PATH="${SNAPSHOT_PATH:-docs/api/openapi.json}"
TYPES_PATH="${TYPES_PATH:-src/app/core/api/generated.types.ts}"

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "$SCRIPT_DIR/.." && pwd)"

# Use a tempdir + fixed .ts filename so prettier can infer the TypeScript
# parser inside gen-api-types.sh. `mktemp -t foo.ts` on macOS appends a random
# suffix AFTER .ts (→ foo.ts.XXXXX), which breaks prettier's extension-based
# parser detection. A real .ts file inside a tempdir avoids the issue.
TMPDIR_="$(mktemp -d -t mirador-api-drift-XXXXXX)"
trap 'rm -rf "$TMPDIR_"' EXIT
TMPFILE="$TMPDIR_/generated.types.ts"

# Regenerate to a throwaway path — don't overwrite the committed file.
TYPES_PATH="$TMPFILE" SNAPSHOT_PATH="$SNAPSHOT_PATH" "$SCRIPT_DIR/gen-api-types.sh" >/dev/null

if diff -u "$REPO_ROOT/$TYPES_PATH" "$TMPFILE" > /tmp/api-types-diff.log 2>&1; then
  echo "✅ $TYPES_PATH is in sync with $SNAPSHOT_PATH"
  exit 0
fi

echo "❌ $TYPES_PATH is out of sync with $SNAPSHOT_PATH"
echo
echo "Diff preview (first 40 lines):"
head -40 /tmp/api-types-diff.log
echo
echo "Run: npm run gen:api-types   # then commit the updated file"
exit 1
