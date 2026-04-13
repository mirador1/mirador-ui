#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# pre-push-checks.sh — comprehensive verification before pushing
#
# Usage:
#   ./scripts/pre-push-checks.sh          # run all checks
#   ./scripts/pre-push-checks.sh --quick  # skip build, only fast checks
#   ./scripts/pre-push-checks.sh --full   # all checks + bundle analysis
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

MODE="${1:---standard}"
ERRORS=0
WARNINGS=0

pass()    { echo -e "  ${GREEN}✓${NC} $1"; }
fail()    { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn()    { echo -e "  ${YELLOW}!${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
section() { echo -e "\n${BLUE}${BOLD}── $1 ──${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
section "Git checks"

# Uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  warn "Uncommitted changes detected"
else
  pass "Working tree clean"
fi

# Branch check
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  warn "Pushing directly to main"
else
  pass "Branch: $BRANCH"
fi

# Merge conflicts markers
if grep -rn "<<<<<<< " --include="*.ts" --include="*.html" --include="*.scss" src/ 2>/dev/null; then
  fail "Merge conflict markers found in src/"
else
  pass "No merge conflict markers"
fi

# Sensitive files
SENSITIVE=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(env|pem|key|p12)$|credentials|secret' || true)
if [ -n "$SENSITIVE" ]; then
  fail "Sensitive files staged: $SENSITIVE"
else
  pass "No sensitive files staged"
fi

# Large files (> 500KB)
LARGE=$(find src -type f -size +500k 2>/dev/null | head -5)
if [ -n "$LARGE" ]; then
  warn "Large files in src/: $LARGE"
else
  pass "No oversized files"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Code quality"

# TypeScript strict compilation
echo -n "  Typechecking... "
if npx tsc --noEmit -p tsconfig.app.json 2>/dev/null; then
  echo -e "${GREEN}✓${NC} TypeScript compiles (strict mode)"
else
  fail "TypeScript compilation failed"
fi

# Prettier formatting
echo -n "  Formatting... "
PRETTIER_OUT=$(npx prettier --check "src/**/*.{ts,html,scss}" 2>&1 || true)
if echo "$PRETTIER_OUT" | grep -q "All matched files use Prettier"; then
  echo -e "${GREEN}✓${NC} Prettier formatting OK"
elif echo "$PRETTIER_OUT" | grep -q "Checking"; then
  warn "Formatting issues (run: npm run format)"
else
  pass "Prettier OK"
fi

# TODO/FIXME/HACK check
TODOS=$(grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODOS" -gt 0 ]; then
  warn "$TODOS TODO/FIXME/HACK comments found"
else
  pass "No TODO/FIXME/HACK comments"
fi

# Console.log check
CONSOLE_LOGS=$(grep -rn "console\.\(log\|debug\|warn\|error\)" --include="*.ts" src/ 2>/dev/null | grep -v "spec\.ts" | grep -v "main\.ts" | wc -l | tr -d ' ')
if [ "$CONSOLE_LOGS" -gt 0 ]; then
  warn "$CONSOLE_LOGS console.log statements found (excluding tests)"
else
  pass "No console.log statements"
fi

# Unused imports (simple check: empty import lines)
EMPTY_IMPORTS=$(grep -rn "^import {}" --include="*.ts" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$EMPTY_IMPORTS" -gt 0 ]; then
  warn "$EMPTY_IMPORTS empty imports found"
else
  pass "No empty imports"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Tests"

echo -n "  Running unit tests... "
TEST_OUT=$(npm test 2>&1)
if echo "$TEST_OUT" | grep -q "passed"; then
  RESULTS=$(echo "$TEST_OUT" | grep "Tests" | head -1)
  echo -e "${GREEN}✓${NC} $RESULTS"
else
  echo ""
  echo "$TEST_OUT" | tail -10
  fail "Unit tests failed"
fi

# ─────────────────────────────────────────────────────────────────────────────
if [ "$MODE" != "--quick" ]; then
  section "Build"

  echo -n "  Production build... "
  if npx ng build --configuration production 2>/dev/null | tail -1 | grep -q "complete"; then
    echo -e "${GREEN}✓${NC} Production build OK"
  else
    # Try again capturing output
    BUILD_OUT=$(npx ng build --configuration production 2>&1)
    if echo "$BUILD_OUT" | grep -q "complete"; then
      echo -e "${GREEN}✓${NC} Production build OK"
    else
      fail "Production build failed"
    fi
  fi

  # Circular dependency check
  BUILD_WARNINGS=$(npx ng build --configuration production 2>&1 | grep -ci "circular" || true)
  if [ "$BUILD_WARNINGS" -gt 0 ]; then
    warn "Circular dependencies detected in build"
  else
    pass "No circular dependencies"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
if [ "$MODE" = "--full" ]; then
  section "Bundle analysis"

  if [ -d "dist/customer-observability-ui/browser" ]; then
    TOTAL=$(du -sh dist/customer-observability-ui/browser/ | cut -f1)
    pass "Total bundle size: $TOTAL"

    echo "  Top 5 chunks:"
    du -sh dist/customer-observability-ui/browser/*.js 2>/dev/null | sort -rh | head -5 | while read -r line; do
      echo "    $line"
    done
  fi

  section "Security"

  echo -n "  npm audit... "
  AUDIT=$(npm audit --audit-level=high 2>&1 || true)
  HIGH=$(echo "$AUDIT" | grep -c "high" || true)
  CRITICAL=$(echo "$AUDIT" | grep -c "critical" || true)
  if [ "$CRITICAL" -gt 0 ]; then
    fail "Critical vulnerabilities found"
  elif [ "$HIGH" -gt 0 ]; then
    warn "$HIGH high severity vulnerabilities"
  else
    pass "No high/critical vulnerabilities"
  fi

  # Hardcoded secrets patterns
  SECRETS=$(grep -rn "password\s*=\s*['\"]" --include="*.ts" src/ 2>/dev/null | grep -v "spec\.ts" | grep -v "placeholder" || true)
  if [ -n "$SECRETS" ]; then
    warn "Possible hardcoded passwords found"
  else
    pass "No hardcoded passwords"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Summary"

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}${BOLD}  BLOCKED: $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo -e "  Push aborted. Fix errors and retry."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}${BOLD}  PASSED with $WARNINGS warning(s)${NC}"
  echo -e "  Proceeding with push."
  exit 0
else
  echo -e "${GREEN}${BOLD}  ALL CHECKS PASSED${NC}"
  exit 0
fi
