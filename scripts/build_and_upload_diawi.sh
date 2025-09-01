#!/usr/bin/env bash
set -euo pipefail

# Build (locally) and upload iOS/Android artifact to Diawi, then print QR
#
# Usage:
#   scripts/build_and_upload_diawi.sh [ios|android] [--file <path>] [--token <token>] [--skip-build] [--auto-yes] [--interactive] [--verbose] [--] [extra build args]
#
# Examples:
#   scripts/build_and_upload_diawi.sh                 # iOS local build (default), upload to Diawi
#   scripts/build_and_upload_diawi.sh ios -- --debug  # pass extra args through to build script
#   scripts/build_and_upload_diawi.sh android         # Android local build (if supported), upload
#   scripts/build_and_upload_diawi.sh --file frontend/build-*.ipa  # upload an existing file
#   DIAWI_TOKEN=... scripts/build_and_upload_diawi.sh  # token via env var
#
# Notes:
# - Requires DIAWI_TOKEN env var or --token <token>.
# - Uses ./scripts/build-prod.sh under the hood for building.
# - Prints an ANSI QR code with `qrencode` if available; otherwise prints install instructions.
# - Use --verbose to debug this script itself (shell trace); does not change build type.
# - Non-interactive by default; use --interactive to allow prompts.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
BUILD_SCRIPT="$REPO_ROOT/scripts/build-prod.sh"

PLATFORM="ios"        # default
ARTIFACT_FILE=""
TOKEN="${DIAWI_TOKEN:-}"
SKIP_BUILD=0
VERBOSE=0
# Whether to pass --auto-yes to build script (disabled by default)
AUTO_YES=0
FORCE_INTERACTIVE=0

print_usage() {
  sed -n '1,60p' "$0" | sed 's/^# \{0,1\}//' | sed '1,2d'
}

err() { echo "Error: $*" >&2; }
info() { echo "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required command '$1' not found in PATH"; exit 1
  fi
}

# Parse args
EXTRA_BUILD_ARGS=()
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      print_usage; exit 0;;
    ios|android)
      PLATFORM="$1"; shift;;
    --file)
      ARTIFACT_FILE="${2:-}"; shift 2;;
    --token)
      TOKEN="${2:-}"; shift 2;;
    --skip-build)
      SKIP_BUILD=1; shift;;
    --auto-yes)
      AUTO_YES=1; shift;;
    --interactive)
      FORCE_INTERACTIVE=1; shift;;
    --verbose)
      VERBOSE=1; shift;;
    --)
      shift
      # The rest goes straight to the build script
      while [[ $# -gt 0 ]]; do EXTRA_BUILD_ARGS+=("$1"); shift; done
      ;;
    *)
      # pass-through unknown options to build script (before --)
      EXTRA_BUILD_ARGS+=("$1"); shift;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  err "DIAWI_TOKEN is required. Set env var or pass --token <token>."
  echo "Export once: export DIAWI_TOKEN=your_token_here" >&2
  exit 1
fi

require_cmd curl

if (( VERBOSE )); then
  set -x
fi

# Optional JSON parser: prefer jq, fallback to python3
JSON_PARSER=""
if command -v jq >/dev/null 2>&1; then
  JSON_PARSER="jq"
elif command -v python3 >/dev/null 2>&1; then
  JSON_PARSER="python3"
else
  err "Neither 'jq' nor 'python3' was found; needed to parse Diawi responses."
  echo "Install jq: brew install jq  |  sudo apt-get install -y jq  |  sudo dnf install -y jq  |  sudo pacman -S jq" >&2
  exit 1
fi

json_get() {
  local key="$1"
  if [[ "$JSON_PARSER" == "jq" ]]; then
    jq -r ".$key" 2>/dev/null || true
  else
    # python3 fallback
    python3 - "$key" <<'PY'
import sys, json
path = sys.argv[1].split('.')
data = json.load(sys.stdin)
cur = data
for p in path:
    if isinstance(cur, list):
        try:
            cur = cur[int(p)]
        except Exception:
            cur = None
            break
    else:
        cur = cur.get(p)
        if cur is None:
            break
if cur is None:
    sys.exit(1)
elif isinstance(cur, (dict, list)):
    print(json.dumps(cur))
else:
    print(cur)
PY
  fi
}

list_artifacts() {
  case "$PLATFORM" in
    ios)
      find "$FRONTEND_DIR" -type f -name "*.ipa" 2>/dev/null | sort || true;
      ;;
    android)
      # Prefer .apk over .aab when present
      {
        find "$FRONTEND_DIR" -type f -name "*.apk" 2>/dev/null
        find "$FRONTEND_DIR" -type f -name "*.aab" 2>/dev/null
      } | sort || true
      ;;
  esac
}

pick_latest() {
  # Cross-platform latest by mtime using stat
  local files=("$@")
  [[ ${#files[@]} -eq 0 ]] && return 1
  local latest_file=""; local latest_ts=0
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || continue
    local ts=0
    if stat -f '%m' "$f" >/dev/null 2>&1; then
      ts=$(stat -f '%m' "$f")      # macOS
    else
      ts=$(stat -c '%Y' "$f")      # Linux
    fi
    if (( ts > latest_ts )); then
      latest_ts=$ts; latest_file="$f"
    fi
  done
  [[ -n "$latest_file" ]] && echo "$latest_file"
}

build_if_needed() {
  if (( SKIP_BUILD )); then return 0; fi
  if [[ ! -x "$BUILD_SCRIPT" ]]; then
    err "Build script not found: $BUILD_SCRIPT"; exit 1
  fi
  info "Building ($PLATFORM) via $BUILD_SCRIPT ..."
  local before after diffout
  before="$(mktemp)"
  after="$(mktemp)"
  diffout="$(mktemp)"
  # Use default expansions to avoid nounset errors on EXIT
  trap 'rm -f "${before:-}" "${after:-}" "${diffout:-}"' EXIT
  list_artifacts > "$before" || true

  # Ensure local build unless overridden in EXTRA_BUILD_ARGS
  local pass_args=("$PLATFORM")
  # Default to local, let user override by explicitly passing --local/omitting
  if [[ ! " ${EXTRA_BUILD_ARGS[*]-} " =~ " --local " ]]; then
    pass_args+=("--local")
  fi
  # Default to non-interactive always unless user explicitly forces interactive
  if (( FORCE_INTERACTIVE )); then
    info "Interactive mode requested; prompts may appear."
    pass_args+=("--interactive")
  else
    case " ${EXTRA_BUILD_ARGS[*]-} " in
      *" --non-interactive "*|*" --interactive "*) : ;; # user provided
      *) pass_args+=("--non-interactive");;
    esac
  fi
  # Optionally pass through --auto-yes if requested
  if (( AUTO_YES )) && [[ ! " ${EXTRA_BUILD_ARGS[*]-} " =~ " --auto-yes " ]]; then
    pass_args+=("--auto-yes")
  fi
  pass_args+=("${EXTRA_BUILD_ARGS[@]-}")

  ( cd "$REPO_ROOT" && "$BUILD_SCRIPT" "${pass_args[@]}" )

  list_artifacts > "$after" || true
  # Compute new files (present after but not before)
  comm -13 "$before" "$after" > "$diffout" || true

  # Helper: pick latest file from a list file
  pick_latest_from_list_file() {
    local listfile="$1"
    local latest_file=""
    local latest_ts=0
    while IFS= read -r f; do
      [[ -f "$f" ]] || continue
      local ts=0
      if stat -f '%m' "$f" >/dev/null 2>&1; then
        ts=$(stat -f '%m' "$f")
      else
        ts=$(stat -c '%Y' "$f")
      fi
      if [[ -z "$latest_file" || "$ts" -gt "$latest_ts" ]]; then
        latest_ts="$ts"
        latest_file="$f"
      fi
    done < "$listfile"
    [[ -n "$latest_file" ]] && printf '%s\n' "$latest_file"
  }

  # Count lines in a file (portable)
  count_lines() { sed -n '$=' "$1" 2>/dev/null || echo 0; }

  local new_count
  new_count=$(count_lines "$diffout")
  if [[ "$new_count" -eq 0 ]]; then
    # Fallback: pick latest from all files after
    local latest
    latest=$(pick_latest_from_list_file "$after") || true
    if [[ -n "$latest" ]]; then
      ARTIFACT_FILE="$latest"
    else
      err "Could not determine newly built artifact."
      err "Check your build output and try passing --file <path>."
      exit 1
    fi
  elif [[ "$new_count" -eq 1 ]]; then
    ARTIFACT_FILE=$(sed -n '1p' "$diffout")
  else
    ARTIFACT_FILE=$(pick_latest_from_list_file "$diffout")
  fi
}

upload_to_diawi() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    err "Artifact not found: $file"; exit 1
  fi
  info "Uploading to Diawi: $file"
  local resp
  resp=$(curl -fsS -X POST "https://upload.diawi.com/" \
    -F "token=$TOKEN" \
    -F "file=@$file" \
    -F "find_by_udid=0" \
    -F "wall_of_apps=0") || { err "Upload failed."; exit 1; }

  local success job message
  success=$(echo "$resp" | json_get success || true)
  job=$(echo "$resp" | json_get job || true)
  message=$(echo "$resp" | json_get message || true)

  # Some Diawi responses only include {"job":"..."} without a success flag
  if [[ -z "$job" || "$job" == "null" ]]; then
    err "Diawi upload error: ${message:-unknown}. Raw: $resp"
    exit 1
  fi
  info "Upload queued. Diawi job: $job"

  # Poll for status
  local attempts=0
  local max_attempts=120   # ~10 minutes at 5s intervals
  local link="" status="" prog=""
  while (( attempts < max_attempts )); do
    sleep 5
    attempts=$((attempts+1))
    local sresp
    sresp=$(curl -fsS -X POST "https://upload.diawi.com/status" -F "token=$TOKEN" -F "job=$job" || true)
    status=$(echo "$sresp" | json_get status || true)
    link=$(echo "$sresp" | json_get link || true)
    if [[ -z "$link" || "$link" == "null" ]]; then
      link=$(echo "$sresp" | json_get 'result.link' || true)
    fi
    prog=$(echo "$sresp" | json_get progress || echo "")

    # Break as soon as a link is provided
    if [[ -n "$link" && "$link" != "null" ]]; then
      break
    fi

    if [[ "$status" =~ ^[0-9]+$ ]] && (( status >= 4000 )); then
      err "Diawi processing failed (status=$status). Raw: $sresp"
      exit 1
    fi

    if [[ -n "$prog" && "$prog" != "null" ]]; then
      echo "Waiting on Diawi (progress: $prog%)..."
    else
      echo "Waiting on Diawi..."
    fi
  done

  if [[ -z "$link" || "$link" == "null" ]]; then
    err "Timed out waiting for Diawi link."
    exit 1
  fi
  echo ""
  echo "Diawi install link: $link"
  echo ""

  # Print QR if available
  if command -v qrencode >/dev/null 2>&1; then
    echo "Scan this QR on your device:"
    # ansiutf8 works well on most terminals
    qrencode -t ansiutf8 "$link"
  else
    echo "qrencode not found. To install:"
    echo "- macOS (Homebrew): brew install qrencode"
    echo "- Ubuntu/Debian:    sudo apt-get update && sudo apt-get install -y qrencode"
    echo "- Fedora:           sudo dnf install -y qrencode"
    echo "- Arch:             sudo pacman -S qrencode"
    echo "- Alpine:           sudo apk add qrencode"
    echo ""
    echo "Alternatively, open the link above on your iPhone to install."
  fi
}

# Main
if [[ -z "$ARTIFACT_FILE" ]]; then
  build_if_needed
fi

if [[ -z "$ARTIFACT_FILE" ]]; then
  err "No artifact path resolved."; exit 1
fi

upload_to_diawi "$ARTIFACT_FILE"
