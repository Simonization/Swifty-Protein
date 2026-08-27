#!/usr/bin/env bash
#
# run.sh — detect the host OS and whatever device is plugged in, then build
# and install onto it. The "just make it work" entry point behind `make run`.
#
# The matrix (per the subject: iOS builds need macOS + Xcode; Android does
# not need anything platform-specific):
#
#   macOS         + Android device -> Android build   (scripts/apk.sh)
#   macOS         + iOS device     -> iOS build        (scripts/ios.sh)
#   Linux/Windows + Android device -> Android build    (scripts/apk.sh)
#   Linux/Windows + iOS device     -> unsupported, explained rather than attempted
#
# If both an Android and an iOS device are attached at once (only possible on
# macOS), this asks rather than guessing — set TARGET=android or TARGET=ios.
#
# DETECT_ONLY=1 prints what's connected and exits without building anything
# (this is what `make devices` runs).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BOLD=""; NC=""
fi
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
die()  { printf "\n${RED}${BOLD}%s${NC}\n" "$1"; exit 1; }

HOST_OS="unknown"
case "$(uname -s)" in
  Linux*)  HOST_OS="linux" ;;
  Darwin*) HOST_OS="macos" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_OS="windows" ;;
esac

# --- Android: same SDK search apk.sh uses, kept independent on purpose so
# this script never needs to know apk.sh's internals to answer "is one there?" --
find_sdk() {
  local c
  for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" \
           "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" \
           "/usr/lib/android-sdk" "/opt/android-sdk"; do
    [ -n "$c" ] && [ -d "$c/platform-tools" ] && { echo "$c"; return 0; }
  done
  return 1
}
find_adb() {
  command -v adb 2>/dev/null && return 0
  local sdk
  sdk="$(find_sdk)" && [ -x "$sdk/platform-tools/adb" ] && { echo "$sdk/platform-tools/adb"; return 0; }
  return 1
}
android_device_count() {
  local adb
  adb="$(find_adb)" || { echo 0; return; }
  # grep -c always prints a count, 0 included — it only exits non-zero when
  # that count is 0, which used to double-print via a naive `|| echo 0`.
  "$adb" devices 2>/dev/null | tail -n +2 | awk '$2 == "device"' | grep -c .
}

# --- iOS: real hardware only, and only checkable on macOS -------------------
ios_device_count() {
  [ "$HOST_OS" = "macos" ] || { echo 0; return; }
  command -v xcrun >/dev/null 2>&1 || { echo 0; return; }
  # "== Devices ==" also lists the Mac itself (as an Instruments trace target),
  # with a standard 8-4-4-4-12 UUID. A real iPhone/iPad UDID has a different,
  # distinctive shape: 8 hex chars, one hyphen, 16 hex chars — that's the part
  # that must match, not just "looks like it has a UUID in parens".
  xcrun xctrace list devices 2>&1 \
    | awk '/^== Devices ==/{f=1;next} /^==/{f=0} f' \
    | grep -v 'Simulator' \
    | grep -cE '\([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}\)$'
}

printf "${BOLD}Swifty-Proteins — device detection${NC}  (host: %s)\n\n" "$HOST_OS"

n_android="$(android_device_count)"
n_ios="$(ios_device_count)"

if [ "$n_android" -gt 0 ]; then ok "$n_android Android device(s) connected"
else warn "no Android device connected"; fi

if [ "$HOST_OS" = "macos" ]; then
  if [ "$n_ios" -gt 0 ]; then ok "$n_ios iOS device(s) connected"
  else warn "no iOS device connected"; fi
else
  warn "iOS device detection skipped — only possible on macOS"
fi

if [ "${DETECT_ONLY:-0}" = "1" ]; then
  printf "\n  (DETECT_ONLY=1 — not building anything.)\n"
  exit 0
fi

target="${TARGET:-}"

if [ -z "$target" ]; then
  if [ "$n_android" -gt 0 ] && [ "$n_ios" -gt 0 ]; then
    die "Both an Android and an iOS device are connected — re-run with TARGET=android or TARGET=ios to pick one."
  elif [ "$n_android" -gt 0 ]; then
    target="android"
  elif [ "$n_ios" -gt 0 ]; then
    target="ios"
  fi
fi

case "$target" in
  android)
    printf "\n${BOLD}Target: Android${NC}\n"
    exec bash "$ROOT/scripts/apk.sh"
    ;;
  ios)
    if [ "$HOST_OS" != "macos" ]; then
      printf "\n${RED}${BOLD}Target: iOS, but this machine is %s.${NC}\n" "$HOST_OS" >&2
      # A plain heredoc, not one nested inside "$(...)": macOS ships bash 3.2
      # by default, and its parser breaks on an apostrophe inside a heredoc
      # that is itself inside a double-quoted command substitution.
      cat >&2 <<EOF
iOS builds need Xcode, which only runs on macOS — there is no supported way to
build or install the iOS app from here. Options:
  - Build an Android APK instead: make apk
  - Build the iOS app on a Mac (this repo, unmodified): make ios
  - Build in Expo's cloud from here, then hand the result to someone with a Mac
    (or a device already registered with a paid Apple Developer account):
      cd frontend && npx eas-cli build --platform ios --profile preview
EOF
      exit 1
    fi
    printf "\n${BOLD}Target: iOS${NC}\n"
    exec bash "$ROOT/scripts/ios.sh"
    ;;
  *)
    printf "\n"
    warn "no device detected."
    if [ "$HOST_OS" = "macos" ]; then
      printf "  Connect an Android phone (USB debugging on) or an iPhone/iPad (trusted), then re-run.\n"
    else
      printf "  Connect an Android phone with USB debugging on, then re-run — this machine can only\n"
      printf "  target Android; iOS builds need a Mac.\n"
    fi
    printf "  Or skip a device entirely: cd frontend && npx expo start, then scan the QR with Expo Go.\n"
    exit 1
    ;;
esac
