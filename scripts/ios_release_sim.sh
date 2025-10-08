#!/usr/bin/env bash
set -euo pipefail

# Build and launch the Expo iOS app in Release mode on the simulator while
# mirroring the "production" EAS profile environment variables. This helps
# reproduce production-only crashes locally without doing a full device build.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

PROFILE="production"
API_URL_OVERRIDE=""
DO_PREBUILD=0
CLEAN_PREBUILD=0
RUN_PODS=1
VERBOSE=0

print_usage() {
  cat <<'USAGE'
Usage: scripts/ios_release_sim.sh [options]

Options:
  --profile <name>      EAS build profile to mirror (default: production)
  --api-url <url>       Override API base URL for this run
  --prebuild            Run "expo prebuild" before building
  --clean-prebuild      Run "expo prebuild --clean" before building
  --no-pod-install      Skip "pod install" step after prebuild
  --verbose             Enable verbose logging (set -x)
  -h, --help            Show this message

Examples:
  scripts/ios_release_sim.sh
  scripts/ios_release_sim.sh --verbose
  scripts/ios_release_sim.sh --profile staging --api-url https://staging.example.com
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --api-url)
      API_URL_OVERRIDE="${2:-}"
      shift 2
      ;;
    --prebuild)
      DO_PREBUILD=1
      shift
      ;;
    --clean-prebuild)
      DO_PREBUILD=1
      CLEAN_PREBUILD=1
      shift
      ;;
    --no-pod-install)
      RUN_PODS=0
      shift
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

[[ $VERBOSE -eq 1 ]] && set -x

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found in PATH" >&2
  exit 1
fi

cd "$REPO_ROOT"

# Ensure the native project exists when asked to prebuild explicitly or when missing.
if [[ $DO_PREBUILD -eq 1 || ! -d "$FRONTEND_DIR/ios" ]]; then
  echo "Running expo prebuild (clean=$CLEAN_PREBUILD)..."
  pushd "$FRONTEND_DIR" >/dev/null
  if [[ $CLEAN_PREBUILD -eq 1 ]]; then
    INCLUDE_NATIVE_CONFIG=1 npx expo prebuild -p ios --clean --non-interactive
  else
    INCLUDE_NATIVE_CONFIG=1 npx expo prebuild -p ios --non-interactive
  fi
  popd >/dev/null
fi

if [[ $RUN_PODS -eq 1 && -d "$FRONTEND_DIR/ios" ]]; then
  echo "Ensuring CocoaPods are installed..."
  pushd "$FRONTEND_DIR/ios" >/dev/null
  if [[ -f Gemfile ]] && command -v bundle >/dev/null 2>&1; then
    bundle install --quiet || bundle install
    bundle exec pod install
  else
    if command -v pod >/dev/null 2>&1; then
      pod install
    else
      echo "Warning: CocoaPods not available; proceeding without pod install" >&2
    fi
  fi
  popd >/dev/null
fi

# Load the profile-specific environment variables from eas.json to mirror production config.
PROFILE_ENV_OUTPUT=$(node - "$FRONTEND_DIR/eas.json" "$PROFILE" <<'NODE'
const fs = require('fs');
const easPath = process.argv[2];
const profileName = process.argv[3];
const easConfig = JSON.parse(fs.readFileSync(easPath, 'utf8'));
const profile = easConfig.build?.[profileName];
if (!profile) {
  console.error(`Profile "${profileName}" not found in ${easPath}`);
  process.exit(1);
}
const env = profile.env || {};
for (const [key, value] of Object.entries(env)) {
  console.log(`${key}=${value}`);
}
NODE
)

while IFS='=' read -r key value; do
  [[ -z "$key" ]] && continue
  export "$key"="$value"
done <<< "$PROFILE_ENV_OUTPUT"

# Always force the environment flag even if eas.json omitted it.
export EXPO_PUBLIC_ENVIRONMENT="${EXPO_PUBLIC_ENVIRONMENT:-$PROFILE}"

if [[ -n "$API_URL_OVERRIDE" ]]; then
  export EXPO_PUBLIC_API_URL="$API_URL_OVERRIDE"
  # Keep production override in sync when mirroring production config.
  export EXPO_PUBLIC_API_URL_PRODUCTION="$API_URL_OVERRIDE"
fi

# Ensure we reflect the new architecture setting expected by the production build.
export EXPO_NEW_ARCH_ENABLED="${EXPO_NEW_ARCH_ENABLED:-1}"

echo "Launching Release simulator build for profile '$PROFILE'..."

pushd "$FRONTEND_DIR" >/dev/null
npx expo run:ios \
  --scheme Hue2 \
  --configuration Release
popd >/dev/null

echo "Done. Inspect the Xcode/Metro logs for runtime errors to diagnose the crash."
