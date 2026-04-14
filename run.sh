#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Start the full stack or individual components
#
# Delegates infrastructure and backend commands to the backend's own run.sh
# instead of duplicating Docker Compose logic.
#
# Usage:
#   ./run.sh              # start everything (backend all + frontend)
#   ./run.sh frontend     # frontend only (assumes backend is running)
#   ./run.sh backend      # delegate to backend: infra + obs + spring app
#   ./run.sh infra        # delegate to backend: db + kafka + redis + tools
#   ./run.sh obs          # delegate to backend: observability stack
#   ./run.sh app          # delegate to backend: spring boot only
#   ./run.sh simulate     # delegate to backend: traffic simulation
#   ./run.sh stop         # stop everything (frontend + backend stop)
#   ./run.sh restart      # delegate to backend: restart + start frontend
#   ./run.sh nuke         # delegate to backend: full cleanup
#   ./run.sh status       # check what's running
#   ./run.sh check        # run pre-push checks (typecheck + tests + build)
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

BACKEND_DIR="$(cd "$SCRIPT_DIR/../workspace-modern/mirador-service" 2>/dev/null && pwd)"
BACKEND_RUN="$BACKEND_DIR/run.sh"
FRONTEND_DIR="$SCRIPT_DIR"
MODE="${1:-all}"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }

check_backend() {
  if [ ! -f "$BACKEND_RUN" ]; then
    fail "Backend run.sh not found at $BACKEND_RUN"
    echo "  Expected: ../workspace-modern/mirador-service/run.sh"
    exit 1
  fi
}

run_backend() {
  check_backend
  info "Delegating to backend: ./run.sh $1"
  (cd "$BACKEND_DIR" && bash run.sh "$1")
}

wait_for() {
  local url=$1 name=$2 timeout=${3:-30}
  info "Waiting for $name..."
  for i in $(seq 1 $timeout); do
    if curl -sf "$url" > /dev/null 2>&1; then
      ok "$name is ready"
      return 0
    fi
    sleep 1
  done
  warn "$name not ready after ${timeout}s"
  return 1
}

start_frontend() {
  cd "$FRONTEND_DIR"
  if [ ! -d "node_modules" ]; then
    info "Installing npm dependencies..."
    npm ci
  fi
  info "Dev server starting on http://localhost:${FRONTEND_PORT:-4200}"
  info "Zipkin (CORS):  http://localhost:9411  (direct, ZIPKIN_HTTP_ALLOWED_ORIGINS)"
  info "Loki (CORS):    http://localhost:3100  (via Nginx CORS proxy)"
  info "Docker API:     http://localhost:2375  (via docker-socket-proxy + Nginx CORS proxy)"
  npm start
}

show_status() {
  echo -e "\n${BOLD}Service Status${NC}\n"

  check_service() {
    local name=$1 url=$2
    if curl -sf "$url" > /dev/null 2>&1; then
      echo -e "  ${GREEN}UP${NC}   $name  ($url)"
    else
      echo -e "  ${RED}DOWN${NC} $name  ($url)"
    fi
  }

  check_service "Frontend"      "http://localhost:${FRONTEND_PORT:-4200}"
  check_service "Backend API"   "${BACKEND_URL:-http://localhost:8080}/actuator/health"
  check_service "Swagger UI"    "${BACKEND_URL:-http://localhost:8080}/swagger-ui.html"
  echo ""
  check_service "pgAdmin"       "http://localhost:${PGADMIN_PORT:-5050}"
  check_service "Kafka UI"      "http://localhost:${KAFKA_UI_PORT:-9080}"
  check_service "RedisInsight"  "http://localhost:${REDIS_INSIGHT_PORT:-5540}"
  echo ""
  check_service "Prometheus"    "http://localhost:${PROMETHEUS_PORT:-9090}/-/ready"
  check_service "Grafana"       "http://localhost:${GRAFANA_PORT:-3000}"
  check_service "Grafana LGTM"  "http://localhost:${GRAFANA_LGTM_PORT:-3001}"
  check_service "Zipkin"        "http://localhost:${ZIPKIN_PORT:-9411}"
  check_service "Loki"          "http://localhost:${LOKI_PORT:-3100}/ready"
  check_service "Pyroscope"     "http://localhost:${PYROSCOPE_PORT:-4040}"
  echo ""
  check_service "Keycloak"      "http://localhost:${KEYCLOAK_PORT:-9090}/admin"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

case "$MODE" in
  all)
    echo -e "\n${BOLD}Starting full stack...${NC}\n"
    run_backend "all" &
    BACKEND_PID=$!
    wait_for "${BACKEND_URL:-http://localhost:8080}/actuator/health" "Backend API" 90
    echo ""
    show_status
    echo -e "${BOLD}Starting frontend (foreground)...${NC}\n"
    start_frontend
    ;;

  frontend|front|ui)
    start_frontend
    ;;

  backend|back)
    run_backend "all"
    ;;

  infra|docker)
    check_backend
    info "Starting infra via backend run.sh..."
    (cd "$BACKEND_DIR" && bash run.sh db)
    (cd "$BACKEND_DIR" && bash run.sh kafka)
    ok "Infrastructure started"
    ;;

  obs|observability)
    run_backend "obs"
    ;;

  app)
    run_backend "app"
    ;;

  app-profiled)
    run_backend "app-profiled"
    ;;

  simulate)
    run_backend "simulate"
    ;;

  restart)
    run_backend "restart" &
    wait_for "${BACKEND_URL:-http://localhost:8080}/actuator/health" "Backend API" 90
    show_status
    start_frontend
    ;;

  stop|down)
    info "Stopping frontend..."
    pkill -f "ng serve" 2>/dev/null && ok "Frontend stopped" || true
    run_backend "stop"
    ok "All stopped"
    ;;

  nuke)
    info "Stopping frontend..."
    pkill -f "ng serve" 2>/dev/null || true
    run_backend "nuke"
    info "Cleaning frontend..."
    rm -rf "$FRONTEND_DIR/dist" "$FRONTEND_DIR/node_modules/.cache"
    ok "Full cleanup done"
    ;;

  status|check-status)
    show_status
    ;;

  check)
    bash "$FRONTEND_DIR/scripts/pre-push-checks.sh" "--standard"
    ;;

  check:quick)
    bash "$FRONTEND_DIR/scripts/pre-push-checks.sh" "--quick"
    ;;

  check:full)
    bash "$FRONTEND_DIR/scripts/pre-push-checks.sh" "--full"
    ;;

  *)
    echo ""
    echo "Usage: ./run.sh <command>"
    echo ""
    echo "Stack:"
    echo "  all           start everything (backend all + frontend)"
    echo "  frontend      frontend only (npm start)"
    echo "  backend       backend all (infra + obs + spring app)"
    echo "  infra         docker infrastructure (db + kafka)"
    echo "  obs           observability stack (prometheus, grafana, etc.)"
    echo "  app           spring boot app only"
    echo "  app-profiled  spring boot with Pyroscope profiling"
    echo "  simulate      run backend traffic simulation"
    echo "  restart       stop + restart everything"
    echo "  stop          stop all services"
    echo "  nuke          full cleanup (containers, volumes, caches)"
    echo "  status        check what's running"
    echo ""
    echo "Quality:"
    echo "  check         pre-push checks (typecheck + tests + build)"
    echo "  check:quick   fast checks (no build)"
    echo "  check:full    full checks (+ audit + bundle analysis)"
    echo ""
    exit 1
    ;;
esac
