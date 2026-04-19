#!/usr/bin/env bash
# =============================================================================
# bin/generate-linux-visual-baselines.sh
#
# Why this script exists: Playwright names snapshots
# `<spec-name>-<project>-<platform>.png`, so a macOS-generated baseline
# doesn't match a Linux CI runner (anti-aliasing + font rasterisation
# differ enough to blow past the 0.2% tolerance). Running Playwright
# inside a Linux container on the dev laptop produces the `-linux`
# baselines CI expects, which we commit alongside the macOS ones.
#
# Usage:
#   cd mirador-ui
#   # Backend on :8080 (./run.sh app in service repo) + UI on :4200
#   # *bound to 0.0.0.0* so the container can reach it:
#   #   npx ng serve --host 0.0.0.0
#   # (the default `npm start` binds to localhost only, which is not
#   # reachable from inside the Linux container on Mac Docker Desktop)
#   bin/generate-linux-visual-baselines.sh
#   git status          # 3 new `*-chromium-linux.png` files
#   git add e2e/visual.spec.ts-snapshots
#   git commit -m "test(visual): regenerate Linux baselines"
#
# What it does:
#   1. Runs the Microsoft-provided Playwright image (pinned to the same
#      minor as `@playwright/test` in package.json).
#   2. Mounts the repo read-write so new baselines land in
#      `e2e/visual.spec.ts-snapshots/`.
#   3. Uses `--network=host` so the container can reach the host's
#      :4200 UI + :8080 backend (on Linux this is native; on Mac Docker
#      Desktop, `--network=host` is a no-op, hence the optional
#      `HOST_GATEWAY` override for `localhost` → `host.docker.internal`).
#
# Why not a CI job that auto-generates + commits on first run?
# - That would require a push-capable token in CI → security tradeoff.
# - A manual "run once per Playwright minor bump" from a dev machine
#   keeps the baseline in the code review loop (same SSOT as the specs).
# =============================================================================

set -euo pipefail

# Keep in lockstep with devDependencies."@playwright/test" in package.json.
# Bumping Playwright often bumps the Chromium build too, which shifts
# sub-pixel rendering and invalidates baselines — re-run this script on
# each minor bump if the visual tests turn red.
PLAYWRIGHT_VERSION="v1.59.1-jammy"

# On Mac Docker Desktop `--network=host` is a no-op; we bridge to the
# host's localhost via `host.docker.internal` (injected automatically by
# DD into every container). On Linux, `--network=host` does reach the
# host's loopback, so the same `localhost:4200` works.
UNAME=$(uname -s)
if [[ "$UNAME" == "Darwin" ]]; then
  BASE_URL="http://host.docker.internal:4200"
  NETWORK_FLAG=""   # no --network=host on Mac; bridge network + DD magic hostname
  EXTRA_HOSTS="--add-host=host.docker.internal:host-gateway"
else
  BASE_URL="http://localhost:4200"
  NETWORK_FLAG="--network=host"
  EXTRA_HOSTS=""
fi

echo "▸ Pulling playwright:${PLAYWRIGHT_VERSION}…"
docker pull "mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION}" >/dev/null

echo "▸ Generating Linux baselines against ${BASE_URL}…"
docker run --rm \
  $NETWORK_FLAG $EXTRA_HOSTS \
  -v "$PWD":/work -w /work \
  -e E2E_BASE_URL="$BASE_URL" \
  "mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION}" \
  /bin/bash -c 'npm ci --prefer-offline && npx playwright test --grep @visual --update-snapshots'

echo ""
echo "✓ Linux baselines written to e2e/visual.spec.ts-snapshots/"
ls -1 e2e/visual.spec.ts-snapshots/ | grep -E "linux" || echo "  (none found — check the container run output above)"
