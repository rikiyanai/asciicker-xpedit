#!/usr/bin/env bash
# launch_prod.sh — start the asciicker XP editor in production mode
#
# Usage:
#   ./scripts/deploy/launch_prod.sh
#   APP_DIR=/srv/xpedit ./scripts/deploy/launch_prod.sh
#
# Reads .env from APP_DIR if present. All config is env-driven.

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
fi

PIPELINE_HOST="${PIPELINE_HOST:-0.0.0.0}"
PIPELINE_PORT="${PIPELINE_PORT:-5071}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"

cd "$APP_DIR"

echo "Starting asciicker-xpedit on ${PIPELINE_HOST}:${PIPELINE_PORT} (workers=${GUNICORN_WORKERS})"
echo "App directory: ${APP_DIR}"

exec gunicorn wsgi:app \
    --bind "${PIPELINE_HOST}:${PIPELINE_PORT}" \
    --workers "${GUNICORN_WORKERS}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
