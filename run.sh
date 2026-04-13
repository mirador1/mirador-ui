#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Start the full stack or individual components
#
# Usage:
#   ./run.sh              # start everything (infra + obs + backend + frontend)
#   ./run.sh frontend     # frontend only (assumes backend is running)
#   ./run.sh backend      # infra + backend (no frontend)
#   ./run.sh infra        # docker infra only (postgres, kafka, redis, etc.)
#   ./run.sh obs          # observability stack only (grafana, prometheus, etc.)
#   ./run.sh stop         # stop all docker containers and processes
#   ./run.sh status       # check what's running
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

# Load .env if present
ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_DIR="$(cd "$(dirname "$0")/../workspace-modern/customer-service" 2>/dev/null && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-all}"

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }

check_backend_dir() {
  if [ ! -d "$BACKEND_DIR" ]; then
    fail "Backend not found at $BACKEND_DIR"
    echo "  Expected: ../workspace-modern/customer-service"
    echo "  Clone it or set BACKEND_DIR env var"
    exit 1
  fi
}

wait_for() {
  local url=$1 name=$2 timeout=${3:-30}
  info "Waiting for $name ($url)..."
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

# ── Commands ─────────────────────────────────────────────────────────────────

start_infra() {
  check_backend_dir
  info "Starting infrastructure (PostgreSQL, Kafka, Redis, Ollama, Keycloak)..."
  (cd "$BACKEND_DIR" && docker compose up -d)
  wait_for "http://localhost:${PGADMIN_PORT:-5050}" "pgAdmin" 15 || true
  ok "Infrastructure started"
}

start_obs() {
  check_backend_dir
  info "Starting observability stack (Grafana, Prometheus, Zipkin, Loki, Pyroscope)..."
  (cd "$BACKEND_DIR" && docker compose -f docker-compose.observability.yml up -d)
  wait_for "http://localhost:${PROMETHEUS_PORT:-9090}/-/ready" "Prometheus" 20 || true
  ok "Observability stack started"
}

start_backend() {
  check_backend_dir
  info "Starting Spring Boot backend..."
  (cd "$BACKEND_DIR" && ./mvnw spring-boot:run -q &)
  wait_for "${BACKEND_URL:-http://localhost:8080}/actuator/health" "Backend API" 60
}

start_frontend() {
  info "Starting Angular frontend..."
  cd "$FRONTEND_DIR"
  if [ ! -d "node_modules" ]; then
    info "Installing npm dependencies..."
    npm ci
  fi
  info "Dev server starting on http://localhost:4200"
  npm start
}

stop_all() {
  info "Stopping all services..."

  # Stop frontend (ng serve)
  pkill -f "ng serve" 2>/dev/null && ok "Frontend stopped" || true

  # Stop backend (spring-boot)
  pkill -f "spring-boot:run" 2>/dev/null && ok "Backend stopped" || true
  pkill -f "customer-service" 2>/dev/null || true

  # Stop docker
  if [ -d "$BACKEND_DIR" ]; then
    (cd "$BACKEND_DIR" && docker compose down 2>/dev/null) && ok "Infra containers stopped" || true
    (cd "$BACKEND_DIR" && docker compose -f docker-compose.observability.yml down 2>/dev/null) && ok "Obs containers stopped" || true
  fi

  ok "All stopped"
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
  check_service "pgAdmin"       "http://localhost:${PGADMIN_PORT:-5050}"
  check_service "Kafka UI"      "http://localhost:${KAFKA_UI_PORT:-9080}"
  check_service "RedisInsight"  "http://localhost:${REDIS_INSIGHT_PORT:-5540}"
  check_service "Prometheus"    "http://localhost:${PROMETHEUS_PORT:-9090}/-/ready"
  check_service "Grafana"       "http://localhost:${GRAFANA_PORT:-3000}"
  check_service "Zipkin"        "http://localhost:${ZIPKIN_PORT:-9411}"
  check_service "Loki"          "http://localhost:${LOKI_PORT:-3100}/ready"
  check_service "Pyroscope"     "http://localhost:${PYROSCOPE_PORT:-4040}"
  check_service "Keycloak"      "http://localhost:${KEYCLOAK_PORT:-9090}/admin"
  check_service "Swagger UI"    "${BACKEND_URL:-http://localhost:8080}/swagger-ui.html"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

case "$MODE" in
  all)
    echo -e "\n${BOLD}Starting full stack...${NC}\n"
    start_infra
    start_obs
    start_backend
    echo ""
    show_status
    echo -e "${BOLD}Starting frontend (foreground)...${NC}\n"
    start_frontend
    ;;
  frontend|front|ui)
    start_frontend
    ;;
  backend|back|api)
    start_infra
    start_obs
    start_backend
    show_status
    ;;
  infra|docker)
    start_infra
    ;;
  obs|observability)
    start_obs
    ;;
  stop|down)
    stop_all
    ;;
  status|check)
    show_status
    ;;
  *)
    echo "Usage: ./run.sh [all|frontend|backend|infra|obs|stop|status]"
    echo ""
    echo "  all       Start everything (infra + obs + backend + frontend)"
    echo "  frontend  Frontend only (npm start)"
    echo "  backend   Infra + observability + Spring Boot"
    echo "  infra     Docker infrastructure only"
    echo "  obs       Observability stack only"
    echo "  stop      Stop all services and containers"
    echo "  status    Check what's running"
    exit 1
    ;;
esac
