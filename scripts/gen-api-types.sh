#!/usr/bin/env bash
# =============================================================================
# scripts/gen-api-types.sh — regenerate src/app/core/api/generated.types.ts
# from the checked-in OpenAPI snapshot.
#
# Deterministic — given the same docs/api/openapi.json, produces the same
# generated.types.ts. Run locally after `npm run gen:openapi-snapshot`, or in
# CI to detect drift between a stale snapshot and the committed types.
#
# Env overrides:
#   SNAPSHOT_PATH — default: docs/api/openapi.json
#   TYPES_PATH    — default: src/app/core/api/generated.types.ts
# =============================================================================
set -euo pipefail

SNAPSHOT_PATH="${SNAPSHOT_PATH:-docs/api/openapi.json}"
TYPES_PATH="${TYPES_PATH:-src/app/core/api/generated.types.ts}"

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "$SCRIPT_DIR/.." && pwd)"

# Resolve SOURCE and TARGET honouring absolute paths — the drift-checker
# passes an absolute mktemp path as TYPES_PATH, so blindly prepending
# REPO_ROOT would produce a malformed double-slashed path and openapi-
# typescript would silently write somewhere unexpected.
case "$SNAPSHOT_PATH" in
  /*) SOURCE="$SNAPSHOT_PATH" ;;
  *)  SOURCE="$REPO_ROOT/$SNAPSHOT_PATH" ;;
esac
case "$TYPES_PATH" in
  /*) TARGET="$TYPES_PATH" ;;
  *)  TARGET="$REPO_ROOT/$TYPES_PATH" ;;
esac

if [ ! -f "$SOURCE" ]; then
  echo "OpenAPI snapshot not found: $SOURCE"
  echo "Run: npm run gen:openapi-snapshot (requires the backend running)"
  exit 1
fi

echo "▶ openapi-typescript $SNAPSHOT_PATH → $TYPES_PATH"
# --output is relative to the current working dir; call with absolute paths
# so the script works from any directory.
npx --yes openapi-typescript "$SOURCE" --output "$TARGET"

# Run prettier on the generated file so `npm run format:check` doesn't flag
# it and so the drift checker's regeneration matches the committed file
# byte-for-byte. Pass --config explicitly so prettier uses .prettierrc even
# when $TARGET is a tempfile outside the repo (the drift checker regenerates
# into /tmp — prettier's upward-config search would miss .prettierrc and fall
# back to defaults, producing double-quoted output that mismatches the
# committed single-quoted file).
npx --yes prettier --config "$REPO_ROOT/.prettierrc" --write "$TARGET" --log-level warn

LINES="$(wc -l < "$TARGET" | tr -d ' ')"
echo "Types generated: $TYPES_PATH ($LINES lines)"
