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

# Function to show usage
show_usage() {
    echo "Usage: $0 [<ios|android>] [API_URL] [options]"
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
    --*)
      echo "Unknown option: $1"
      show_usage
      exit 1
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
    cd frontend && \
    EXPO_PUBLIC_API_URL="$API_URL" \
    npx eas update --branch "$UPDATE_BRANCH" --message "$UPDATE_MESSAGE" --platform "$PLATFORM_ARG"
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

  EAS_BUILD_CMD=(npx eas build --platform "$TARGET" --profile "$PROFILE")
  if [[ "$LOCAL_BUILD" -eq 1 ]]; then
    EAS_BUILD_CMD+=(--local)
  fi

  echo "Starting EAS build..."
  (
    cd frontend && \
    EXPO_PUBLIC_API_URL="$API_URL" "${EAS_BUILD_CMD[@]}"
  )

  echo ""
  echo "Production build completed!"
  echo "Platform: $TARGET"
  echo "Profile: $PROFILE"
  echo "API URL: $API_URL"
  echo ""
  echo "You can check build details on: https://expo.dev"
fi
