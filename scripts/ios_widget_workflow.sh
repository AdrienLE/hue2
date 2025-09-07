#!/usr/bin/env bash
set -euo pipefail

# iOS prebuild + build workflow intended for apps with a WidgetKit/AppIntents target.
# - Runs expo prebuild (optional) to ensure native iOS project exists/updated
# - Builds a production iOS binary locally via EAS using the existing scripts
# - Optionally uploads the resulting .ipa to Diawi
#
# Usage:
#   scripts/ios_widget_workflow.sh [--no-prebuild] [--profile <name>] [--local|--cloud] [--api-url <url>] [--diawi] [--token <DIAWI_TOKEN>] [--] [extra EAS args]
#
# Examples:
#   scripts/ios_widget_workflow.sh --diawi --token "$DIAWI_TOKEN"
#   scripts/ios_widget_workflow.sh --local --profile production -- --debug
#   scripts/ios_widget_workflow.sh --api-url https://your-prod-api --diawi
#
# Notes:
# - Requires: Node, Expo CLI, EAS CLI, Xcode, CocoaPods (for local builds)
# - Uses existing build pipeline (scripts/build-prod.sh and scripts/build_and_upload_diawi.sh)
# - If you already committed ios/ with your Widget extension, this will include it in the .ipa

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

DO_PREBUILD=1
PROFILE="production"
BUILD_MODE="local"   # local|cloud
API_URL=""
DO_DIAWI=0
DIAWI_TOKEN_IN="${DIAWI_TOKEN:-}"

EXTRA_EAS_ARGS=()

print_usage() {
  sed -n '1,80p' "$0" | sed 's/^# \{0,1\}//' | sed '1,2d'
}

err() { echo "Error: $*" >&2; }
info() { echo "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) print_usage; exit 0;;
    --no-prebuild) DO_PREBUILD=0; shift;;
    --prebuild) DO_PREBUILD=1; shift;;
    --profile) PROFILE="${2:-production}"; shift 2;;
    --local) BUILD_MODE="local"; shift;;
    --cloud) BUILD_MODE="cloud"; shift;;
    --api-url) API_URL="${2:-}"; shift 2;;
    --diawi) DO_DIAWI=1; shift;;
    --token) DIAWI_TOKEN_IN="${2:-}"; shift 2;;
    --) shift; while [[ $# -gt 0 ]]; do EXTRA_EAS_ARGS+=("$1"); shift; done;;
    *) EXTRA_EAS_ARGS+=("$1"); shift;;
  esac
done

# Basic checks
command -v node >/dev/null 2>&1 || { err "node not found"; exit 1; }
command -v npx >/dev/null 2>&1 || { err "npx not found"; exit 1; }

if (( DO_PREBUILD )); then
  info "Running expo prebuild for iOS..."
  (
    cd "$FRONTEND_DIR" || exit 1
    # Keep environment minimal; widget-specific targets/capabilities must already exist or be provided via config plugin
    npx expo prebuild -p ios --clean --non-interactive || npx expo prebuild -p ios --non-interactive
    # Ensure pods are installed
    if command -v pod >/dev/null 2>&1; then
      npx pod-install || (cd ios && pod install)
    fi
  )
  info "Prebuild complete. iOS project ready."
fi

# Decide build path
if (( DO_DIAWI )); then
  # Build + upload using existing helper
  info "Building iOS (profile=$PROFILE, mode=$BUILD_MODE) and uploading to Diawi..."
  if [[ -n "$API_URL" ]]; then
    EXTRA_EAS_ARGS+=("$API_URL")
  fi
  DIAWI_CMD=("$REPO_ROOT/scripts/build_and_upload_diawi.sh" ios)
  # Force local/cloud
  if [[ "$BUILD_MODE" == "local" ]]; then
    DIAWI_CMD+=(-- --local)
  else
    DIAWI_CMD+=(-- --non-interactive)
  fi
  # Pass token if provided explicitly
  if [[ -n "$DIAWI_TOKEN_IN" ]]; then
    export DIAWI_TOKEN="$DIAWI_TOKEN_IN"
  fi
  # Pass profile to underlying build script
  DIAWI_CMD+=(-- --profile "$PROFILE")
  # Ensure production env hits prod server by default (eas.json already sets this for 'production')
  if [[ ${#EXTRA_EAS_ARGS[@]} -gt 0 ]]; then DIAWI_CMD+=(-- "${EXTRA_EAS_ARGS[@]}"); fi
  "${DIAWI_CMD[@]}"
else
  # Build only
  info "Building iOS (profile=$PROFILE, mode=$BUILD_MODE)..."
  BUILD_CMD=("$REPO_ROOT/scripts/build-prod.sh" ios)
  [[ "$BUILD_MODE" == "local" ]] && BUILD_CMD+=(--local)
  BUILD_CMD+=(--profile "$PROFILE")
  if [[ -n "$API_URL" ]]; then BUILD_CMD+=("$API_URL"); fi
  if [[ ${#EXTRA_EAS_ARGS[@]} -gt 0 ]]; then BUILD_CMD+=(-- "${EXTRA_EAS_ARGS[@]}"); fi
  "${BUILD_CMD[@]}"
  info "iOS build completed. Find .ipa under frontend/ or check EAS output."
fi

info "Done."
