#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-web}"
if [[ "$TARGET" != "web" && "$TARGET" != "ios" && "$TARGET" != "android" ]]; then
  echo "Usage: $0 [web|ios|android]"
  exit 2
fi

DB_PATH="${SWOOSH_QA_DB_PATH:-/private/tmp/swoosh-ui-qa.db}"
TOKEN="${SWOOSH_QA_TOKEN:-local-swoosh-qa-token}"
USER_ID="${SWOOSH_QA_USER_ID:-dev-widget-user}"
API_URL="${SWOOSH_QA_API_URL:-http://127.0.0.1:8000}"

python3 scripts/seed_widget_dev_data.py --database-path "$DB_PATH" --user-id "$USER_ID"

APP_ENV=development \
RAILWAY_ENVIRONMENT=development \
ENABLE_DEV_AUTH=1 \
DEV_AUTH_TOKEN="$TOKEN" \
DEV_AUTH_USER_ID="$USER_ID" \
DATABASE_URL="sqlite:///$DB_PATH" \
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd frontend
EXPO_PUBLIC_ENVIRONMENT=development \
EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN="$TOKEN" \
EXPO_PUBLIC_API_URL="$API_URL" \
npx expo start --"$TARGET"
