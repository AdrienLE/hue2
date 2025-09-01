#!/usr/bin/env bash
set -e

# Default production API URL
DEFAULT_PROD_API_URL="https://hue2-production.up.railway.app"

# Defaults
TARGET=""
API_URL="$DEFAULT_PROD_API_URL"
PROFILE="production"
LOCAL_BUILD=0
USE_UPDATE=0
UPDATE_BRANCH="production"
UPDATE_MESSAGE="Production update from build-prod.sh"
EXPO_DEBUG_FLAG=${EXPO_DEBUG:-}
AUTO_YES=0
EAS_EXTRA_ARGS=()
NON_INTERACTIVE=1
FORCE_INTERACTIVE=0

# Function to show usage
show_usage() {
    echo "Usage: $0 [<ios|android>] [API_URL] [options] [-- <extra EAS args>]"
    echo ""
    echo "Build app binaries (default):"
    echo "  $0 ios [API_URL] [--local] [--profile <name>]"
    echo "  $0 android [API_URL] [--local] [--profile <name>]"
    echo ""
    echo "Publish EAS Update (OTA):"
    echo "  $0 --update [API_URL] [--branch <name>] [--message <msg>]"
    echo "  $0 ios --update [API_URL]  # limit update to iOS"
    echo "  $0 android --update [API_URL]  # limit update to Android"
    echo ""
    echo "Options:"
    echo "  --local            Build locally using EAS local build (build mode only)"
    echo "  --update           Publish an EAS Update instead of building binaries"
    echo "  --branch <name>    EAS Update branch (default: $UPDATE_BRANCH)"
    echo "  --profile <name>   EAS build profile (default: $PROFILE)"
    echo "  --message <msg>    EAS Update message"
    echo "  --debug            Set EXPO_DEBUG=1 for verbose logs"
    echo "  --auto-yes         Auto-accept default answers to interactive prompts"
    echo "  --non-interactive  Fail fast instead of prompting when no TTY/CI"
    echo "  --interactive      Force prompts (requires a real TTY)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Default API URL: $DEFAULT_PROD_API_URL"
}

# Parse arguments (options can be anywhere after optional TARGET and API_URL)
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_usage
      exit 0
      ;;
    --local)
      LOCAL_BUILD=1
      shift
      ;;
    --update)
      USE_UPDATE=1
      shift
      ;;
    --branch)
      UPDATE_BRANCH="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --message)
      UPDATE_MESSAGE="$2"
      shift 2
      ;;
    --debug)
      EXPO_DEBUG_FLAG=1
      shift
      ;;
    --auto-yes)
      AUTO_YES=1
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE=1
      shift
      ;;
    --interactive)
      FORCE_INTERACTIVE=1
      shift
      ;;
    --)
      shift
      # Collect the rest as extra EAS CLI args
      while [[ $# -gt 0 ]]; do EAS_EXTRA_ARGS+=("$1"); shift; done
      ;;
    --*)
      # Pass through unknown options to EAS CLI
      EAS_EXTRA_ARGS+=("$1")
      shift
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

# Handle positional args: [TARGET] [API_URL]
if [[ ${#POSITIONAL[@]} -ge 1 ]]; then
  case "${POSITIONAL[0]}" in
    ios|android)
      TARGET="${POSITIONAL[0]}"
      ;;
    *)
      # If not a platform, treat as API_URL and leave TARGET empty (allowed for --update)
      API_URL="${POSITIONAL[0]}"
      ;;
  esac
fi
if [[ ${#POSITIONAL[@]} -ge 2 ]]; then
  # Second positional is API_URL if provided
  API_URL="${POSITIONAL[1]}"
fi

# Validate combinations
if [[ "$USE_UPDATE" -eq 0 ]]; then
  # Build mode requires a target
  if [[ -z "$TARGET" ]]; then
    echo "Error: Target platform required for build."
    show_usage
    exit 1
  fi
else
  # Update mode: TARGET optional (defaults to all)
  :
fi

if [[ "$USE_UPDATE" -eq 1 ]]; then
  # EAS Update path
  PLATFORM_ARG="all"
  if [[ "$TARGET" == "ios" || "$TARGET" == "android" ]]; then
    PLATFORM_ARG="$TARGET"
  fi

  echo "Publishing EAS Update"
  echo "Branch: $UPDATE_BRANCH"
  echo "Platform: $PLATFORM_ARG"
  echo "API URL: $API_URL"

  (
    cd frontend || exit 1
    # Only set EXPO_DEBUG if explicitly provided
    if [[ -n "$EXPO_DEBUG_FLAG" ]]; then export EXPO_DEBUG="$EXPO_DEBUG_FLAG"; fi
    export EXPO_PUBLIC_API_URL="$API_URL"
    UPDATE_CMD=(npx eas update --branch "$UPDATE_BRANCH" --message "$UPDATE_MESSAGE" --platform "$PLATFORM_ARG")
    if [[ "$FORCE_INTERACTIVE" -ne 1 ]]; then
      UPDATE_CMD+=(--non-interactive)
    fi
    if [[ ${#EAS_EXTRA_ARGS[@]} -gt 0 ]]; then
      UPDATE_CMD+=("${EAS_EXTRA_ARGS[@]}")
    fi
    "${UPDATE_CMD[@]}"
  )

  echo ""
  echo "EAS Update published!"
  echo "Branch: $UPDATE_BRANCH"
  echo "Platform: $PLATFORM_ARG"
  echo "API URL: $API_URL"
else
  # EAS Build path
  echo "Building production app for $TARGET"
  echo "API URL: $API_URL"
  echo "Profile: $PROFILE"
  if [[ "$LOCAL_BUILD" -eq 1 ]]; then
    echo "Mode: local build"
  else
    echo "Mode: cloud build"
  fi

  # Decide interactivity: default to non-interactive, unless explicitly forced
  IS_TTY=0
  if [[ -t 0 && -t 1 ]]; then IS_TTY=1; fi
  if [[ "$FORCE_INTERACTIVE" -eq 1 ]]; then
    NON_INTERACTIVE=0
  fi

  # Preflight checks
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is not installed or not in PATH" >&2
    exit 1
  fi
  echo "Node: $(node -v)"
  if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx is not installed or not in PATH" >&2
    exit 1
  fi

  # Frontend deps
  if [[ ! -d frontend/node_modules ]]; then
    echo "Installing frontend dependencies..."
    (cd frontend && yarn install --silent)
  fi

  # iOS local build prerequisites (best effort checks)
  if [[ "$LOCAL_BUILD" -eq 1 && "$TARGET" == "ios" ]]; then
    if ! command -v xcodebuild >/dev/null 2>&1; then
      echo "Error: xcodebuild not found. Install Xcode + Command Line Tools." >&2
      exit 1
    fi
    if ! command -v pod >/dev/null 2>&1; then
      echo "Error: CocoaPods (pod) not found. Install with: sudo gem install cocoapods" >&2
      exit 1
    fi
    echo "Xcode: $(xcodebuild -version | head -n1)"
    echo "CocoaPods: $(pod --version)"

    # Ensure iOS platform runtime is available (Xcode 16+ manages Platforms separately)
    # If iPhoneOS SDK is not listed, attempt to download/install it automatically.
    if ! xcodebuild -showsdks | grep -qi "iphoneos"; then
      echo "iOS platform runtime not found in xcodebuild -showsdks output."
      echo "Attempting to install iOS platform via: xcodebuild -downloadPlatform iOS"
      if xcodebuild -downloadPlatform iOS; then
        echo "Successfully downloaded iOS platform runtime."
      else
        echo "Warning: Automatic iOS platform download failed." >&2
        echo "Please open Xcode → Settings → Platforms and install the iOS platform (e.g., iOS 18.x)," >&2
        echo "or run manually: xcodebuild -downloadPlatform iOS" >&2
      fi
    else
      # Optional: surface current iPhoneOS SDK versions for visibility
      echo "Available iPhoneOS SDKs:"
      xcodebuild -showsdks | sed -n '/iPhoneOS/p'
    fi
  fi

  EAS_BUILD_CMD=(npx eas build --platform "$TARGET" --profile "$PROFILE")
  if [[ "$LOCAL_BUILD" -eq 1 ]]; then
    EAS_BUILD_CMD+=(--local)
  fi
  if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
    EAS_BUILD_CMD+=(--non-interactive)
  fi
  # Append any extra EAS CLI args
  if [[ ${#EAS_EXTRA_ARGS[@]} -gt 0 ]]; then
    EAS_BUILD_CMD+=("${EAS_EXTRA_ARGS[@]}")
  fi

  echo "Starting EAS build..."
  (
    cd frontend || exit 1
    # Only set EXPO_DEBUG if explicitly provided
    if [[ -n "$EXPO_DEBUG_FLAG" ]]; then export EXPO_DEBUG="$EXPO_DEBUG_FLAG"; fi
    export EXPO_PUBLIC_API_URL="$API_URL"
    # Always avoid piping input; rely solely on --non-interactive if set
    "${EAS_BUILD_CMD[@]}"
  )

  echo ""
  echo "Production build completed!"
  echo "Platform: $TARGET"
  echo "Profile: $PROFILE"
  echo "API URL: $API_URL"
  echo ""
  echo "You can check build details on: https://expo.dev"
fi
