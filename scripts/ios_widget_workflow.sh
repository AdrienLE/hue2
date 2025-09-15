#!/usr/bin/env bash
set -euo pipefail

# iOS prebuild + build workflow intended for apps with a WidgetKit/AppIntents target.
# - Runs expo prebuild (optional) to ensure native iOS project exists/updated
# - Builds a production iOS binary locally via EAS using the existing scripts
# - Optionally uploads the resulting .ipa to Diawi
#
# Usage:
#   scripts/ios_widget_workflow.sh [--no-prebuild] [--profile <name>] [--local|--cloud] [--api-url <url>] \
#                                  [--interactive|--non-interactive] [--diawi] [--token <DIAWI_TOKEN>] \
#                                  [--token-file <path>] [--dev-run] [--xcode-open] [--verbose] [--] [extra EAS args]
#
# Examples:
#   scripts/ios_widget_workflow.sh --diawi --token "$DIAWI_TOKEN" --verbose
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

DO_PREBUILD=1        # 1=always run, 0=skip; will auto-skip if ios/ exists unless forced
PROFILE="production"
BUILD_MODE="local"   # local|cloud
API_URL=""
DO_DIAWI=0
DIAWI_TOKEN_IN="${DIAWI_TOKEN:-}"
DIAWI_TOKEN_FILE=""
SKIP_BUILD=0
ARTIFACT_FILE=""
FORCE_PREBUILD=0
CLEAN_PREBUILD=0
RUN_PODS=1
DEV_RUN=0
XCODE_OPEN=0
VERBOSE=0

# Interactivity control (forwarded to underlying build script)
FORCE_INTERACTIVE=0
FORCE_NON_INTERACTIVE=0

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
    --force-prebuild) FORCE_PREBUILD=1; DO_PREBUILD=1; shift;;
    --clean-prebuild) CLEAN_PREBUILD=1; DO_PREBUILD=1; FORCE_PREBUILD=1; shift;;
    --profile) PROFILE="${2:-production}"; shift 2;;
    --local) BUILD_MODE="local"; shift;;
    --cloud) BUILD_MODE="cloud"; shift;;
    --api-url) API_URL="${2:-}"; shift 2;;
    --diawi) DO_DIAWI=1; shift;;
    --token) DIAWI_TOKEN_IN="${2:-}"; shift 2;;
    --token-file) DIAWI_TOKEN_FILE="${2:-}"; shift 2;;
    --skip-build) SKIP_BUILD=1; shift;;
    --file) ARTIFACT_FILE="${2:-}"; shift 2;;
    --no-pod-install) RUN_PODS=0; shift;;
    --dev-run) DEV_RUN=1; shift;;
    --xcode-open) XCODE_OPEN=1; shift;;
    --interactive) FORCE_INTERACTIVE=1; FORCE_NON_INTERACTIVE=0; shift;;
    --non-interactive) FORCE_NON_INTERACTIVE=1; FORCE_INTERACTIVE=0; shift;;
    --verbose) VERBOSE=1; shift;;
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
    # If ios/ already exists and not forcing, skip prebuild for incremental builds
    if [[ -d ios && $FORCE_PREBUILD -eq 0 ]]; then
      info "iOS project exists; skipping prebuild (use --force-prebuild or --clean-prebuild to regenerate)."
    else
      if (( CLEAN_PREBUILD )); then
        npx expo prebuild -p ios --clean --non-interactive
      else
        npx expo prebuild -p ios --non-interactive
      fi
    fi
    # Pods: optional; skip if requested
    if (( RUN_PODS )); then
      if command -v pod >/dev/null 2>&1; then
        npx pod-install || (cd ios && pod install)
      fi
    else
      info "Skipping CocoaPods install (--no-pod-install)"
    fi
  )
  info "Prebuild complete. iOS project ready."
fi

# Sanity check: verify Widget extension target seems present in Xcode project
PBXPROJ="$FRONTEND_DIR/ios/Hue2.xcodeproj/project.pbxproj"
WIDGET_PLIST="$FRONTEND_DIR/ios/Hue2Widget/Info.plist"
if [[ -f "$PBXPROJ" ]]; then
  EXT_PRESENT=0
  # Heuristic 1: any app extension target entries or .appex product references
  if rg -n "wrapper\.app-extension|\\.appex|PBXNativeTarget.*Widget" "$PBXPROJ" >/dev/null 2>&1; then
    EXT_PRESENT=1
  fi
  # Heuristic 2: Info.plist declares a WidgetKit extension
  if [[ $EXT_PRESENT -eq 0 && -f "$WIDGET_PLIST" ]]; then
    if rg -n "com\\.apple\\.widgetkit-extension" "$WIDGET_PLIST" >/dev/null 2>&1 || \
       grep -q "com.apple.widgetkit-extension" "$WIDGET_PLIST"; then
      EXT_PRESENT=1
    fi
  fi
  if [[ $EXT_PRESENT -eq 0 ]]; then
    echo "" >&2
    echo "[Warning] No WidgetKit extension target detected in the Xcode project." >&2
    echo "          The files exist under ios/<AppName>Widget/, but the Xcode target" >&2
    echo "          must be added and embedded once for widgets to appear." >&2
    echo "          Quick fix: run with --xcode-open and add ‘Widget Extension’ target in Xcode," >&2
    echo "          pointing it at ios/Hue2Widget/, then rebuild." >&2
    echo "" >&2
  fi
fi

# Fast dev path: run the native app (incremental Xcode build) for testing widget/app without generating an .ipa
if (( DEV_RUN )); then
  info "Launching dev run (incremental) via Expo run:ios..."
  (
    cd "$FRONTEND_DIR" || exit 1
    npx expo run:ios
  )
  if (( XCODE_OPEN )); then
    open "$FRONTEND_DIR/ios/Hue2.xcworkspace" || open "$FRONTEND_DIR/ios/Hue2.xcodeproj" || true
  fi
  info "Dev run finished."
  exit 0
fi

# Optional convenience: open Xcode to leverage incremental builds manually
if (( XCODE_OPEN )); then
  open "$FRONTEND_DIR/ios/Hue2.xcworkspace" || open "$FRONTEND_DIR/ios/Hue2.xcodeproj" || true
fi

# Decide build path
  if (( DO_DIAWI )); then
  # Build + upload using existing helper
  info "Building iOS (profile=$PROFILE, mode=$BUILD_MODE) and uploading to Diawi..."
  if [[ -n "$API_URL" ]]; then
    EXTRA_EAS_ARGS+=("$API_URL")
  fi
  DIAWI_CMD=("$REPO_ROOT/scripts/build_and_upload_diawi.sh" ios)
  if [[ -n "$DIAWI_TOKEN_FILE" ]]; then
    DIAWI_CMD+=(--token-file "$DIAWI_TOKEN_FILE")
  fi
  # If provided, select a specific artifact and/or skip the build step
  if (( SKIP_BUILD )); then DIAWI_CMD+=(--skip-build); fi
  if [[ -n "$ARTIFACT_FILE" ]]; then DIAWI_CMD+=(--file "$ARTIFACT_FILE"); fi
  # Force local/cloud
  if [[ "$BUILD_MODE" == "local" ]]; then
    DIAWI_CMD+=(-- --local)
  else
    DIAWI_CMD+=(-- --non-interactive)
  fi
  # Respect interactive preference for the Diawi helper (which then forwards to build script)
  if (( FORCE_INTERACTIVE )); then
    DIAWI_CMD=("${DIAWI_CMD[@]:0:1}" --interactive "${DIAWI_CMD[@]:1}")
  elif (( FORCE_NON_INTERACTIVE )); then
    DIAWI_CMD=("${DIAWI_CMD[@]:0:1}" --non-interactive "${DIAWI_CMD[@]:1}")
  fi
  # Pass token if provided explicitly
  if [[ -n "$DIAWI_TOKEN_IN" ]]; then
    export DIAWI_TOKEN="$DIAWI_TOKEN_IN"
  fi
  # Pass profile to underlying build script
  DIAWI_CMD+=(-- --profile "$PROFILE")
  # Increase logging in Diawi helper when requested
  if (( VERBOSE )); then
    DIAWI_CMD=("${DIAWI_CMD[@]:0:1}" --verbose "${DIAWI_CMD[@]:1}")
  fi
  # Ensure production env hits prod server by default (eas.json already sets this for 'production')
  if [[ ${#EXTRA_EAS_ARGS[@]} -gt 0 ]]; then DIAWI_CMD+=(-- "${EXTRA_EAS_ARGS[@]}"); fi
  "${DIAWI_CMD[@]}"
else
  # Build only
  info "Building iOS (profile=$PROFILE, mode=$BUILD_MODE)..."
  BUILD_CMD=("$REPO_ROOT/scripts/build-prod.sh" ios)
  [[ "$BUILD_MODE" == "local" ]] && BUILD_CMD+=(--local)
  BUILD_CMD+=(--profile "$PROFILE")
  # Respect interactive preference for underlying build
  if (( FORCE_INTERACTIVE )); then
    BUILD_CMD+=(--interactive)
  elif (( FORCE_NON_INTERACTIVE )); then
    BUILD_CMD+=(--non-interactive)
  fi
  if [[ -n "$API_URL" ]]; then BUILD_CMD+=("$API_URL"); fi
  if [[ ${#EXTRA_EAS_ARGS[@]} -gt 0 ]]; then BUILD_CMD+=(-- "${EXTRA_EAS_ARGS[@]}"); fi
  "${BUILD_CMD[@]}"
  info "iOS build completed. Find .ipa under frontend/ or check EAS output."
fi

info "Done."
