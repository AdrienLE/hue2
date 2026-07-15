#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-web}"
if [[ "$TARGET" != "web" && "$TARGET" != "ios" && "$TARGET" != "android" ]]; then
  echo "Usage: $0 [web|ios|android]"
  exit 2
fi

TOKEN="${SWOOSH_QA_TOKEN:-local-swoosh-qa-token}"
USER_ID="${SWOOSH_QA_USER_ID:-dev-widget-user}"

available_port() {
  python3 -c 'import socket; sock = socket.socket(); sock.bind(("127.0.0.1", 0)); print(sock.getsockname()[1]); sock.close()'
}

BACKEND_PORT="${SWOOSH_QA_BACKEND_PORT:-$(available_port)}"
METRO_PORT="${SWOOSH_QA_METRO_PORT:-$(available_port)}"
while [[ "$METRO_PORT" == "$BACKEND_PORT" ]]; do
  METRO_PORT="$(available_port)"
done

API_URL="${SWOOSH_QA_API_URL:-http://127.0.0.1:$BACKEND_PORT}"
DB_PATH="${SWOOSH_QA_DB_PATH:-/private/tmp/swoosh-ui-qa-$BACKEND_PORT.db}"

echo "Swoosh QA backend: $API_URL"
echo "Swoosh QA Metro:   http://127.0.0.1:$METRO_PORT"
echo "Swoosh QA database: $DB_PATH"

python3 scripts/seed_widget_dev_data.py --database-path "$DB_PATH" --user-id "$USER_ID"

APP_ENV=development \
RAILWAY_ENVIRONMENT=development \
ENABLE_DEV_AUTH=1 \
DEV_AUTH_TOKEN="$TOKEN" \
DEV_AUTH_USER_ID="$USER_ID" \
DATABASE_URL="sqlite:///$DB_PATH" \
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT" &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd frontend
EXPO_PUBLIC_ENVIRONMENT=development \
EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN="$TOKEN" \
EXPO_PUBLIC_API_URL="$API_URL" \
npx expo start --"$TARGET" --port "$METRO_PORT"
