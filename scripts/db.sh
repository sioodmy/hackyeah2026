#!/usr/bin/env bash
# Start a Postgres for development.
#
#   ./scripts/db.sh up      start (docker compose if available, else nix postgres)
#   ./scripts/db.sh down    stop it
#   ./scripts/db.sh status  show state
#   ./scripts/db.sh url     print DATABASE_URL
#
# Docker is used when present because that is what the deployed server runs.
# Without Docker we fall back to the Postgres from nixpkgs (the devShell already
# puts initdb/pg_ctl on PATH), which keeps `just db:up` working on a machine that
# has neither Docker nor a system Postgres.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${MOKOSH_PGDATA:-${PANICMAP_PGDATA:-$ROOT/.direnv/pgdata}}"
SOCKET_DIR="${MOKOSH_PGSOCK:-${PANICMAP_PGSOCK:-$ROOT/.direnv/pgsock}}"
LOG_FILE="$DATA_DIR/postgres.log"
DB_NAME="${MOKOSH_DB_NAME:-${PANICMAP_DB_NAME:-mokosh}}"
DB_USER="${MOKOSH_DB_USER:-${PANICMAP_DB_USER:-mokosh}}"
DB_PASS="${MOKOSH_DB_PASSWORD:-${PANICMAP_DB_PASSWORD:-mokosh}}"
NIX_PG_PORT="${MOKOSH_PG_PORT:-${PANICMAP_PG_PORT:-5433}}"
COMPOSE=(docker compose -f "$ROOT/infra/docker-compose.yml")

have() { command -v "$1" >/dev/null 2>&1; }

using_docker() { [[ ${MOKOSH_DB_BACKEND:-${PANICMAP_DB_BACKEND:-auto}} != "nix" ]] && have docker; }

nix_running() {
  have pg_ctl && [[ -f "$DATA_DIR/PG_VERSION" ]] && pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1
}

compose_running() { using_docker && "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -q '^db$'; }

db_up() {
  if using_docker; then
    echo "==> starting postgres via docker compose"
    "${COMPOSE[@]}" up -d db
    echo "==> waiting for readiness"
    # Single quotes on purpose: $POSTGRES_USER is expanded by the shell inside
    # the container, not here.
    # shellcheck disable=SC2016
    "${COMPOSE[@]}" exec -T db sh -c \
      'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do sleep 0.5; done'
    echo "==> postgres is up on localhost:5432"
    echo "DATABASE_URL=postgresql+psycopg://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
    return 0
  fi

  if ! have initdb; then
    cat >&2 <<'EOF'
error: neither docker nor a nix postgres is available.

Run this from the devShell (nix develop), or install docker.
EOF
    return 1
  fi

  echo "==> starting postgres from nixpkgs (data in $DATA_DIR)"
  mkdir -p "$DATA_DIR" "$SOCKET_DIR"

  if [[ ! -f "$DATA_DIR/PG_VERSION" ]]; then
    initdb -D "$DATA_DIR" -U "$DB_USER" --auth=trust >/dev/null
  fi

  pg_ctl -D "$DATA_DIR" -l "$LOG_FILE" -o \
    "-p $NIX_PG_PORT -k $SOCKET_DIR -c listen_addresses=127.0.0.1" \
    -w start >/dev/null

  # Ensure DB_USER exists if this cluster was initialized under another user name
  if ! psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
    local superuser
    superuser="$(psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -d postgres -tAc "SELECT usename FROM pg_user WHERE usesuper LIMIT 1" 2>/dev/null || true)"
    if [[ -n $superuser ]]; then
      psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -U "$superuser" -d postgres -c \
        "CREATE ROLE ${DB_USER} WITH SUPERUSER LOGIN PASSWORD '${DB_PASS}'" >/dev/null 2>&1 || true
    fi
  fi

  psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 ||
    psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -U "$DB_USER" -d postgres -c \
      "CREATE DATABASE ${DB_NAME}" >/dev/null

  echo "==> postgres is up on 127.0.0.1:${NIX_PG_PORT} (socket ${SOCKET_DIR})"
  echo "DATABASE_URL=postgresql+psycopg://${DB_USER}@127.0.0.1:${NIX_PG_PORT}/${DB_NAME}"
}

db_down() {
  if compose_running; then
    echo "==> stopping docker compose postgres"
    "${COMPOSE[@]}" down
    return 0
  fi

  if nix_running; then
    echo "==> stopping nix postgres"
    pg_ctl -D "$DATA_DIR" -m fast -w stop >/dev/null
    return 0
  fi

  echo "postgres is not running"
}

db_status() {
  if compose_running; then
    echo "docker compose: running"
    "${COMPOSE[@]}" ps
    return 0
  fi
  if nix_running; then
    echo "nix postgres: running (port ${NIX_PG_PORT})"
    pg_ctl -D "$DATA_DIR" status
    return 0
  fi
  echo "postgres is not running"
  return 1
}

db_url() {
  # Prefer whichever backend is actually running over whichever *could* run:
  # a docker binary with a dead daemon must not shadow a live nix postgres.
  if compose_running; then
    echo "postgresql+psycopg://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
  elif nix_running; then
    echo "postgresql+psycopg://${DB_USER}@127.0.0.1:${NIX_PG_PORT}/${DB_NAME}"
  elif using_docker; then
    echo "postgresql+psycopg://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
  else
    echo "postgresql+psycopg://${DB_USER}@127.0.0.1:${NIX_PG_PORT}/${DB_NAME}"
  fi
}

case "${1:-up}" in
up) db_up ;;
down | stop) db_down ;;
restart)
  db_down || true
  db_up
  ;;
status) db_status ;;
url) db_url ;;
psql)
  shift
  if compose_running; then
    exec "${COMPOSE[@]}" exec db psql -U "$DB_USER" -d "$DB_NAME" "$@"
  else
    exec psql -h "$SOCKET_DIR" -p "$NIX_PG_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
  fi
  ;;
*)
  echo "usage: $0 {up|down|restart|status|url|psql}" >&2
  exit 2
  ;;
esac
