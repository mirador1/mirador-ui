#!/usr/bin/env bash
# =============================================================================
# bin/record-asciinema-ship.sh — terminal cast of `bin/ship.sh --dry-run`
#
# Why this exists: the demo GIF shows the UI flow — what the running
# system DOES. The README also benefits from a cast showing what the
# DEVELOPER does to ship a change: one command (`bin/ship.sh`) that
# pushes, opens an MR, arms auto-merge, blocks until merged, and
# pushes the GitHub mirror. A 60-second asciinema cast embedded in
# the README captures the "it's all automated" narrative more
# convincingly than a paragraph of text.
#
# Usage:
#   brew install asciinema       # one-time
#   bin/record-asciinema-ship.sh # produces docs/media/ship.cast
#
# To embed in the README:
#   - Self-host: ship the .cast file as-is and use the asciinema-player
#     web component (no third-party dependency at view-time).
#   - Or: `asciinema upload docs/media/ship.cast` → get a public URL
#     → embed via `[![asciicast](https://asciinema.org/a/<id>.svg)]
#       (https://asciinema.org/a/<id>)`
#
# This script runs `bin/ship.sh --dry-run` so it doesn't actually push
# anything — the cast shows the SHAPE of the workflow, not a real push.
# =============================================================================

set -euo pipefail

OUT_DIR="docs/media"
OUT_CAST="$OUT_DIR/ship.cast"

if ! command -v asciinema >/dev/null 2>&1; then
  echo "✗ asciinema not installed — \`brew install asciinema\` (mac) or \`pip install asciinema\` (linux)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Find ship.sh — it lives in the sibling service repo
SHIP_SH="../../workspace-modern/mirador-service/bin/ship.sh"
if [[ ! -x "$SHIP_SH" ]]; then
  echo "✗ ship.sh not found at $SHIP_SH" >&2
  exit 1
fi

echo "▸ Recording asciinema cast (terminal will be captured)…"
echo "  Press Ctrl+D when ship.sh --dry-run finishes."
echo ""

# `--cols 100 --rows 30` keeps the cast a sensible terminal size for
# embedding in a README (full-width laptop terminals look squashed).
# `--idle-time-limit 2` collapses long idle pauses so the cast plays
# back at a reasonable pace.
asciinema rec "$OUT_CAST" \
  --cols 100 --rows 30 \
  --idle-time-limit 2 \
  --title "bin/ship.sh — one-command dev → main shipping" \
  --command "$SHIP_SH --dry-run"

SIZE=$(du -h "$OUT_CAST" | cut -f1)
echo ""
echo "✓ Done — $OUT_CAST ($SIZE)"
echo ""
echo "  Preview locally:"
echo "    asciinema play $OUT_CAST"
echo ""
echo "  Or upload to asciinema.org for a hosted URL:"
echo "    asciinema upload $OUT_CAST"
