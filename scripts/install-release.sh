#!/usr/bin/env bash
# Download a release APK from GitHub and install it via ADB.
#
#   ./scripts/install-release.sh              # installs latest release
#   ./scripts/install-release.sh v0.2.0       # installs specific tag
#   ./scripts/install-release.sh --launch     # installs and opens the app
#
# Caches downloaded APKs in /tmp/mokosh-release-cache so repeated runs
# don't re-download 180MB needlessly. Verifies SHA-256 digest when published
# with the release.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_NAME="${PACKAGE_NAME:-pl.hackyeah.mokosh}"
CACHE_DIR="${TMPDIR:-/tmp}/mokosh-release-cache"

have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Usage: ./scripts/install-release.sh [OPTIONS] [TAG]

Download a release APK from GitHub and install it on an Android device via ADB.

Arguments:
  TAG                   Release tag to install (default: latest)

Options:
  -s, --device SERIAL   ADB device serial (defaults to $ANDROID_SERIAL or single device)
  -r, --repo OWNER/REPO GitHub repo (default: auto-detected from git or sioodmy/hackyeah2026)
  -f, --force           Force re-download even if APK is cached
  -l, --launch          Launch Mokosh on the device after installation
  -h, --help            Show this help message
EOF
}

check_tools() {
  if ! have curl; then
    echo "error: curl is required but not installed." >&2
    exit 1
  fi
  if ! have jq; then
    echo "error: jq is required but not installed." >&2
    exit 1
  fi
}

check_adb() {
  if ! have adb; then
    echo "error: adb is not installed or not in PATH." >&2
    exit 1
  fi

  local attached_devices
  attached_devices="$(adb devices | awk 'NR>1 && NF>=2 {if ($2 == "device") print $1}')"

  if [[ -z $attached_devices ]]; then
    echo "error: no authorized ADB device found." >&2
    echo "Make sure your phone is connected and USB/wireless debugging is enabled." >&2
    adb devices >&2
    exit 1
  fi

  local count
  count="$(echo "$attached_devices" | grep -c . || true)"

  if [[ -n $DEVICE_SERIAL ]]; then
    if ! echo "$attached_devices" | grep -qx "$DEVICE_SERIAL"; then
      echo "error: device '$DEVICE_SERIAL' is not connected or not authorized." >&2
      adb devices >&2
      exit 1
    fi
    ADB=(adb -s "$DEVICE_SERIAL")
  elif [[ $count -gt 1 ]]; then
    echo "error: multiple ADB devices connected. Please specify one with -s <serial> or ANDROID_SERIAL:" >&2
    adb devices >&2
    exit 1
  else
    ADB=(adb)
  fi

  local model android_ver
  model="$("${ADB[@]}" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || true)"
  android_ver="$("${ADB[@]}" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r' || true)"
  echo "==> target device: ${model:-Unknown} (Android ${android_ver:-unknown})"
}

detect_repo() {
  if [[ -n $REPO ]]; then
    return 0
  fi

  if [[ -n ${GITHUB_REPOSITORY:-} ]]; then
    REPO="$GITHUB_REPOSITORY"
    return 0
  fi

  if have git && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local remote_url
    remote_url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
    if [[ $remote_url =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
      REPO="${BASH_REMATCH[1]}"
      return 0
    fi
  fi

  REPO="sioodmy/hackyeah2026"
}

fetch_release() {
  echo "==> fetching release info for $REPO ($TARGET_TAG)..."
  local api_url
  if [[ $TARGET_TAG == "latest" ]]; then
    api_url="https://api.github.com/repos/${REPO}/releases/latest"
  else
    api_url="https://api.github.com/repos/${REPO}/releases/tags/${TARGET_TAG}"
  fi

  local auth_header=()
  if [[ -n ${GITHUB_TOKEN:-${GH_TOKEN:-}} ]]; then
    local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
    auth_header=(-H "Authorization: Bearer $token")
  fi

  local release_json
  if ! release_json="$(curl -sSfL "${auth_header[@]}" -H "Accept: application/vnd.github+json" "$api_url")"; then
    echo "error: failed to fetch release '$TARGET_TAG' from $REPO" >&2
    exit 1
  fi

  TAG_NAME="$(echo "$release_json" | jq -r '.tag_name // empty')"
  RELEASE_TITLE="$(echo "$release_json" | jq -r '.name // empty')"

  APK_URL="$(echo "$release_json" | jq -r '.assets[] | select(.name | endswith(".apk")) | .browser_download_url' | head -n1)"
  APK_NAME="$(echo "$release_json" | jq -r '.assets[] | select(.name | endswith(".apk")) | .name' | head -n1)"
  EXPECTED_DIGEST="$(echo "$release_json" | jq -r '.assets[] | select(.name | endswith(".apk")) | .digest // empty' | head -n1)"

  if [[ -z $APK_URL || -z $APK_NAME ]]; then
    echo "error: no .apk asset found in release $TAG_NAME" >&2
    exit 1
  fi

  echo "==> release: $TAG_NAME ($RELEASE_TITLE)"
  echo "==> asset:   $APK_NAME"
}

download_apk() {
  local tag_cache_dir="$CACHE_DIR/$REPO/$TAG_NAME"
  mkdir -p "$tag_cache_dir"
  APK_PATH="$tag_cache_dir/$APK_NAME"

  local need_download=true
  if [[ -f $APK_PATH && $FORCE_DOWNLOAD == false ]]; then
    if [[ -n $EXPECTED_DIGEST && $EXPECTED_DIGEST == sha256:* ]]; then
      local expected_hash="${EXPECTED_DIGEST#sha256:}"
      local actual_hash
      actual_hash="$(sha256sum "$APK_PATH" | awk '{print $1}')"
      if [[ $actual_hash == "$expected_hash" ]]; then
        echo "==> using cached APK: $APK_PATH (hash matches)"
        need_download=false
      fi
    elif [[ -s $APK_PATH ]]; then
      echo "==> using cached APK: $APK_PATH"
      need_download=false
    fi
  fi

  if [[ $need_download == true ]]; then
    echo "==> downloading $APK_NAME..."
    local tmp_file="${APK_PATH}.tmp.$$"
    local auth_header=()
    if [[ -n ${GITHUB_TOKEN:-${GH_TOKEN:-}} ]]; then
      local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
      auth_header=(-H "Authorization: Bearer $token")
    fi

    if ! curl -fLC - --progress-bar "${auth_header[@]}" -o "$tmp_file" "$APK_URL"; then
      rm -f "$tmp_file"
      echo "error: download failed" >&2
      exit 1
    fi
    mv "$tmp_file" "$APK_PATH"

    if [[ -n $EXPECTED_DIGEST && $EXPECTED_DIGEST == sha256:* ]]; then
      local expected_hash="${EXPECTED_DIGEST#sha256:}"
      local actual_hash
      actual_hash="$(sha256sum "$APK_PATH" | awk '{print $1}')"
      if [[ $actual_hash != "$expected_hash" ]]; then
        echo "error: SHA-256 mismatch for downloaded APK!" >&2
        echo "expected: $expected_hash" >&2
        echo "actual:   $actual_hash" >&2
        rm -f "$APK_PATH"
        exit 1
      fi
      echo "==> verified SHA-256: $actual_hash"
    fi
  fi
}

install_apk() {
  echo "==> installing $APK_NAME via adb..."
  "${ADB[@]}" install -r -d "$APK_PATH"

  local pkg="$PACKAGE_NAME"
  local version_info
  version_info="$("${ADB[@]}" shell dumpsys package "$pkg" 2>/dev/null | grep -E "versionCode|versionName" | tr -d '\r' | sed 's/^[[:space:]]*//' || true)"
  if [[ -z $version_info ]]; then
    local fallback_info
    fallback_info="$("${ADB[@]}" shell dumpsys package "pl.hackyeah.panicmap" 2>/dev/null | grep -E "versionCode|versionName" | tr -d '\r' | sed 's/^[[:space:]]*//' || true)"
    if [[ -n $fallback_info ]]; then
      pkg="pl.hackyeah.panicmap"
      version_info="$fallback_info"
    fi
  fi

  echo "==> successfully installed!"
  if [[ -n $version_info ]]; then
    echo "==> installed version on device:"
    echo "$version_info" | while IFS= read -r line; do
      echo "    $line"
    done
  fi

  if [[ $LAUNCH_APP == true ]]; then
    echo "==> launching $pkg..."
    "${ADB[@]}" shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  fi
}

main() {
  TARGET_TAG="latest"
  DEVICE_SERIAL="${ANDROID_SERIAL:-}"
  REPO=""
  FORCE_DOWNLOAD=false
  LAUNCH_APP=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
    -s | --device)
      DEVICE_SERIAL="$2"
      shift 2
      ;;
    -r | --repo)
      REPO="$2"
      shift 2
      ;;
    -f | --force)
      FORCE_DOWNLOAD=true
      shift
      ;;
    -l | --launch)
      LAUNCH_APP=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "error: unknown option $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      TARGET_TAG="$1"
      shift
      ;;
    esac
  done

  check_tools
  check_adb
  detect_repo
  fetch_release
  download_apk
  install_apk
}

main "$@"
