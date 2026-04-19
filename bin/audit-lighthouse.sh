#!/usr/bin/env bash
# =============================================================================
# bin/audit-lighthouse.sh — generate docs/audit/lighthouse.{html,json}
#
# Why this exists: a recruiter scanning the README wants a single
# verifiable number for "is this UI well-built?". Lighthouse gives
# four (Performance / Accessibility / Best Practices / SEO) in one
# pass and writes a self-contained HTML report that can be opened
# offline. Keeping the artefact in the repo means the score is part
# of the project history (every release tag preserves its own audit),
# not a SaaS dashboard that disappears.
#
# Prereq: backend on :8080 + UI on :4200, both up via `./run.sh app`
# (or `./run.sh all`) in the sibling mirador-service repo, and
# `npm start` here.
#
# Usage:
#   bin/audit-lighthouse.sh                 # full audit, all 4 categories
#   bin/audit-lighthouse.sh /customers      # specific URL path
# =============================================================================

set -euo pipefail

URL_PATH="${1:-/}"
TARGET="http://localhost:4200${URL_PATH}"
OUT_DIR="docs/audit"
OUT_HTML="$OUT_DIR/lighthouse.html"
OUT_JSON="$OUT_DIR/lighthouse.json"

# Ensure target up — Lighthouse failing because of a 404 doesn't help.
if ! curl -sSf -m 5 "$TARGET" >/dev/null 2>&1; then
  echo "✗ $TARGET unreachable — start ng serve + the backend first." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "▸ Auditing $TARGET via Lighthouse…"
# `npx --yes` accepts the install prompt. `--preset=desktop` gives a
# realistic desktop-class score (the default mobile preset throttles
# CPU 4× + 3G network and tanks scores in a way that's not relevant
# for a self-hosted dev portfolio). Headless chrome via Playwright's
# bundled Chromium would be ideal but lighthouse picks the system
# chromium itself; install via `npx playwright install chromium`
# if it can't find one.
npx --yes lighthouse@12 "$TARGET" \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output=json \
  --output-path="$OUT_DIR/lighthouse" \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet

# lighthouse writes lighthouse.report.html / .report.json — rename to
# stable filenames so the README link doesn't drift between versions.
[[ -f "$OUT_DIR/lighthouse.report.html" ]] && mv "$OUT_DIR/lighthouse.report.html" "$OUT_HTML"
[[ -f "$OUT_DIR/lighthouse.report.json" ]] && mv "$OUT_DIR/lighthouse.report.json" "$OUT_JSON"

# Print the headline scores so this script doubles as a CI check.
node -e "
const r = require('./$OUT_JSON');
const c = r.categories;
const fmt = (s) => Math.round(s.score * 100).toString().padStart(3);
console.log();
console.log('  Performance     ' + fmt(c.performance));
console.log('  Accessibility   ' + fmt(c.accessibility));
console.log('  Best practices  ' + fmt(c['best-practices']));
console.log('  SEO             ' + fmt(c.seo));
console.log();
console.log('  Full report → $OUT_HTML');
"
