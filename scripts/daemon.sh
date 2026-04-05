#!/bin/bash
# Mindbrain API Daemon — start/stop/status/logs
# Usage: mb-daemon start|stop|status|restart|logs
set -euo pipefail

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

MINDBRAIN_DIR="${MINDBRAIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PID_FILE="${HOME}/.mindbrain/daemon.pid"
LOG_FILE="${HOME}/.mindbrain/daemon.log"
PORT="${MINDBRAIN_PORT:-3456}"

mkdir -p "${HOME}/.mindbrain"

get_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
    rm -f "$PID_FILE"
  fi
  return 1
}

cmd_start() {
  if pid=$(get_pid); then
    echo -e "${GREEN}Already running${RESET} (PID $pid, port $PORT)"
    return 0
  fi

  echo -e "${DIM}Starting Mindbrain API on :${PORT}...${RESET}"

  cd "$MINDBRAIN_DIR"
  nohup bun run apps/api/src/index.ts > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # Wait for health
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
      echo -e "${GREEN}${BOLD}✓ Running${RESET} — PID $pid, port $PORT"
      return 0
    fi
    sleep 0.2
  done

  echo -e "${RED}Failed to start${RESET} — check logs: mb-daemon logs"
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  return 1
}

cmd_stop() {
  if pid=$(get_pid); then
    kill "$pid"
    rm -f "$PID_FILE"
    echo -e "${RED}${BOLD}✗ Stopped${RESET} (PID $pid)"
  else
    echo -e "${DIM}Not running${RESET}"
  fi
}

cmd_restart() {
  cmd_stop
  sleep 0.5
  cmd_start
}

cmd_status() {
  if pid=$(get_pid); then
    local uptime
    uptime=$(ps -o etime= -p "$pid" 2>/dev/null | xargs)
    echo -e "${GREEN}${BOLD}● Running${RESET} — PID $pid, port $PORT, uptime $uptime"
  else
    echo -e "${RED}${BOLD}● Stopped${RESET}"
    return 1
  fi
}

cmd_logs() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -f "$LOG_FILE"
  else
    echo -e "${DIM}No logs yet${RESET}"
  fi
}

case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  *)
    echo -e "${BOLD}Mindbrain Daemon${RESET}"
    echo ""
    echo "  mb-daemon start     Start API server"
    echo "  mb-daemon stop      Stop API server"
    echo "  mb-daemon restart   Restart API server"
    echo "  mb-daemon status    Check if running"
    echo "  mb-daemon logs      Tail log output"
    ;;
esac
