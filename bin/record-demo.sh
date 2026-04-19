#!/usr/bin/env bash
# =============================================================================
# bin/record-demo.sh — generate docs/media/demo.gif from a Playwright run.
#
# Why this script exists: a recruiter scanning the README needs to see the
# product in motion in under 3 seconds. A static screenshot under-sells the
# interactivity; an actual demo video is on YouTube — but a self-hosted GIF
# in the README has the lowest friction (no extra click, no tracking).
#
# Flow:
#   1. Check prerequisites: backend + UI dev-server both up, ffmpeg installed.
#   2. Run `e2e/demo.spec.ts` (separate from the assertion specs) with
#      `video: on` — Playwright captures a .webm of the browser session.
#   3. Convert the webm → optimised gif via ffmpeg with a 2-pass palette
#      (small filesize + no banding).
#   4. Drop the output at docs/media/demo.gif so the README `![](…)` link
#      resolves on GitHub + GitLab renders.
#
# Usage:
#   cd mirador-ui
#   ../mirador-service/run.sh app &          # backend in another shell
#   npm start &                               # UI dev server
#   bin/record-demo.sh                        # produces docs/media/demo.gif
#
# ADR-0033 ("Playwright E2E in kind-in-CI") lists this script as the
# Tier-2 enabler; keeping the recording outside the assertion suite
# avoids making demo cosmetics a CI-blocking flake.
#
# Prereqs:
#   - backend reachable at http://localhost:8080 (override via BACKEND_URL)
#   - UI dev server reachable at http://localhost:4200 (override via E2E_BASE_URL)
#   - ffmpeg installed (brew install ffmpeg, apt-get install ffmpeg)
#   - Chromium from Playwright (`npx playwright install chromium`)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:4200}"
OUT_DIR="docs/media"
OUT_GIF="$OUT_DIR/demo.gif"
VIDEO_DIR="test-results/demo-spec-Demo-recording-for-README-chromium"

# ─── 1. Prereqs ───────────────────────────────────────────────────────────────
info "Checking prereqs…"
command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg not found (brew install ffmpeg)"
command -v npx    >/dev/null 2>&1 || fail "npx not found (npm installed?)"

curl -sSf "$BACKEND_URL/actuator/health" >/dev/null 2>&1 \
  || fail "Backend not reachable at $BACKEND_URL — start with ./run.sh app in the service repo"

# Full-stack health pre-flight via the sibling service repo's
# bin/healthcheck-all.sh — this avoids the v3-iteration pattern of
# launching record-demo only to discover mid-run that LGTM crashed
# or Kafka stopped (cost: 10 wasted recordings this session).
SVC_HEALTHCHECK="../../workspace-modern/mirador-service/bin/healthcheck-all.sh"
if [[ -x "$SVC_HEALTHCHECK" ]]; then
  info "Running full-stack healthcheck…"
  if ! "$SVC_HEALTHCHECK" >/tmp/record-demo-healthcheck.log 2>&1; then
    warn "healthcheck-all reports a degraded stack — see /tmp/record-demo-healthcheck.log"
    warn "(continuing anyway; non-required services down is OK for the demo)"
  else
    ok "Full stack healthy"
  fi
else
  warn "healthcheck-all.sh not found at $SVC_HEALTHCHECK — skipping pre-flight"
fi
curl -sSf "$E2E_BASE_URL" >/dev/null 2>&1 \
  || fail "UI dev server not reachable at $E2E_BASE_URL — start with npm start"

ok "Prereqs met"

# ─── 2. Record with Playwright ────────────────────────────────────────────────
mkdir -p "$OUT_DIR"
info "Recording demo flow via Playwright (≈30 s)…"

# `--grep @demo` isolates the recording spec so the assertion suite
# (@golden) isn't triggered. We force `video: on` + a higher res via
# config overrides for a crisp README render.
PWTEST_VIDEO=on \
PWTEST_VIEWPORT_WIDTH=1280 \
PWTEST_VIEWPORT_HEIGHT=720 \
npx playwright test --grep @demo --workers=1 --reporter=list \
  || fail "Playwright demo spec failed — see test-results/"

# Find the produced webm (path contains the spec + project name).
WEBM=$(find test-results -type f -name "video.webm" -print -quit)
[[ -f "$WEBM" ]] || fail "Playwright didn't produce a video.webm — check test-results/"

# ─── 3. Convert to optimised gif ──────────────────────────────────────────────
info "Converting $WEBM → $OUT_GIF (ffmpeg 2-pass palette)…"

# Two-pass palette is the canonical way to produce a small, dither-free GIF
# from a video — pass 1 computes an optimal 256-color palette, pass 2
# applies it. `fps=8` + width 1100 is the sweet spot tuned against the
# v3 ~2-minute walkthrough: readable on a README (still crisp text in
# Grafana panels) while staying around 13 MB. Raise to fps=12 and
# 1280-wide if the demo is short (≤ 45 s) and you want smoother motion.
PALETTE="$(mktemp -d)/palette.png"
ffmpeg -y -i "$WEBM" -vf "fps=8,scale=1100:-1:flags=lanczos,palettegen" "$PALETTE" 2>/dev/null
ffmpeg -y -i "$WEBM" -i "$PALETTE" \
  -filter_complex "fps=8,scale=1100:-1:flags=lanczos[x];[x][1:v]paletteuse" \
  "$OUT_GIF" 2>/dev/null

SIZE=$(du -h "$OUT_GIF" | cut -f1)
ok "Done — $OUT_GIF ($SIZE)"

# ─── OTel span emission (proposal #9 — meta-observability) ────────────────────
# Emit a single OTel span describing this recording so a future operator
# searching Tempo for "service.name=record-demo" can see WHEN the README GIF
# was last regenerated, on which Playwright version, and how big the output
# was. Useful when investigating "why does main's GIF look stale": the trace
# tells you the answer in one query.
#
# Skipped if the OTLP endpoint isn't reachable (e.g. CI runs without LGTM).
OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
if curl -sSf -m 2 "${OTLP_ENDPOINT}/v1/traces" -X POST -H "Content-Type: application/json" -d '{}' >/dev/null 2>&1 || \
   curl -sSf -m 2 "${OTLP_ENDPOINT}/v1/traces" -o /dev/null 2>&1; then
  # Build a minimal OTLP-JSON trace payload. trace_id = 32 hex, span_id = 16 hex.
  TRACE_ID=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)
  SPAN_ID=$(openssl rand -hex 8 2>/dev/null || head -c 8 /dev/urandom | xxd -p)
  START_NS=$(($(date +%s) * 1000000000))
  END_NS=$START_NS  # zero-duration span — this is a marker, not a measurement
  PW_VERSION=$(node -p "require('./node_modules/@playwright/test/package.json').version" 2>/dev/null || echo "unknown")
  GIF_BYTES=$(stat -f%z "$OUT_GIF" 2>/dev/null || stat -c%s "$OUT_GIF")
  curl -sSf -m 5 -X POST "${OTLP_ENDPOINT}/v1/traces" \
    -H "Content-Type: application/json" \
    -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"record-demo"}},{"key":"service.version","value":{"stringValue":"'"${PW_VERSION}"'"}}]},"scopeSpans":[{"scope":{"name":"bin/record-demo.sh"},"spans":[{"traceId":"'"${TRACE_ID}"'","spanId":"'"${SPAN_ID}"'","name":"demo.gif.regenerated","kind":1,"startTimeUnixNano":"'"${START_NS}"'","endTimeUnixNano":"'"${END_NS}"'","attributes":[{"key":"output.path","value":{"stringValue":"'"${OUT_GIF}"'"}},{"key":"output.bytes","value":{"intValue":'"${GIF_BYTES}"'}},{"key":"playwright.version","value":{"stringValue":"'"${PW_VERSION}"'"}}]}]}]}]}' \
    >/dev/null 2>&1 \
      && info "OTel span emitted (trace_id=${TRACE_ID:0:8}…)" \
      || warn "OTLP push failed (non-blocking)"
fi

# Warn if GIF is bigger than the "fast-scrolling recruiter" threshold.
# GitHub-README readers lose interest past ~10 MB (slow cell connection).
BYTES=$(stat -f%z "$OUT_GIF" 2>/dev/null || stat -c%s "$OUT_GIF")
if [[ "$BYTES" -gt 10485760 ]]; then
  warn "GIF exceeds 10 MB — consider trimming the spec or lowering fps to 8"
fi

# ─── 4. Clean up ──────────────────────────────────────────────────────────────
rm -rf "$(dirname "$PALETTE")"
info "Keep or delete test-results/ manually (contains the raw .webm)"
