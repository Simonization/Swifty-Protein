#!/usr/bin/env bash
#
# ios.sh — build the iOS app and install it on a connected iPhone/iPad.
#
# macOS + Xcode only: unlike the Android path, there is no cloud-signing trick
# that avoids needing a Mac here, and no way around Apple requiring Xcode to
# build for a real device. `npx expo run:ios` does the actual work (generate
# the native ios/ project, pod install, build via xcodebuild, install to the
# device) — this script only checks the toolchain up front and finds the one
# connected device, so a missing dependency is a one-line message instead of
# a stack trace three tools deep.
#
# Usage:
#   bash scripts/ios.sh
#
# Exit code 0 = installed on a device.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"

if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BOLD=""; NC=""
fi
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
bad()  { printf "  ${RED}✗${NC} %s\n" "$1"; }
step() { printf "\n${BOLD}%s${NC}\n" "$1"; }
die()  { printf "\n${RED}${BOLD}%s${NC}\n" "$1"; exit 1; }

printf "${BOLD}Building the Swifty-Proteins iOS app${NC}\n"
step "Checking the toolchain"

if [ "$(uname -s)" != "Darwin" ]; then
  printf "\n${RED}${BOLD}iOS builds need macOS + Xcode.${NC}\n" >&2
  # A plain heredoc, not one nested inside "$(...)": macOS ships bash 3.2 by
  # default, and its parser breaks on an apostrophe inside a heredoc that is
  # itself inside a double-quoted command substitution (confirmed against
  # 3.2.57 while writing this — "Expo's" was enough to trigger it).
  cat >&2 <<EOF
This machine is $(uname -s). There is no way around that (Apple requires
Xcode to build for a real device).
  - Android instead, from here: make apk
  - Or build in Expo's cloud, then hand the result to a Mac (or a device
    already registered with a paid Apple Developer account) to install it:
      cd frontend && npx eas-cli build --platform ios --profile preview
EOF
  exit 1
fi

missing=0

if command -v node >/dev/null 2>&1; then
  node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "${node_major:-0}" -ge 20 ]; then
    ok "node $(node -v)"
  else
    bad "node $(node -v) is too old — Expo SDK 57 needs Node 20.19+ or 22.13+"; missing=$((missing+1))
  fi
else
  bad "node not found — https://nodejs.org"; missing=$((missing+1))
fi

if command -v xcodebuild >/dev/null 2>&1 && xcodebuild -version >/dev/null 2>&1; then
  ok "$(xcodebuild -version | head -1)"
else
  bad "Xcode not found or not selected (the Command Line Tools alone are not enough)"; missing=$((missing+1))
  printf "      → install Xcode from the App Store, then: sudo xcode-select -s /Applications/Xcode.app\n"
fi

if command -v pod >/dev/null 2>&1; then
  ok "cocoapods $(pod --version 2>/dev/null)"
else
  bad "CocoaPods not found (needed for iOS native dependencies)"; missing=$((missing+1))
  printf "      → sudo gem install cocoapods   (or: brew install cocoapods)\n"
fi

if [ "$missing" -gt 0 ]; then
  printf "\n${RED}${BOLD}%d item(s) missing — no iOS build is possible on this machine yet.${NC}\n" "$missing"
  exit 1
fi

# --- find the one connected iPhone/iPad ------------------------------------
# `xcrun xctrace list devices` lists real hardware under "== Devices ==" and
# simulators under "== Simulators ==" (exact wording can drift across Xcode
# versions — Xcode's own Window -> Devices and Simulators is the fallback of
# record if this ever stops matching). "== Devices ==" also lists the Mac
# itself as a trace target, with a standard 8-4-4-4-12 UUID; a real iPhone/iPad
# UDID has a distinctive different shape — 8 hex chars, one hyphen, 16 hex
# chars — which is what the pattern below actually keys on.
detect_ios_device() {
  local raw devices count
  raw="$(xcrun xctrace list devices 2>&1)"
  devices="$(printf '%s\n' "$raw" \
    | awk '/^== Devices ==/{f=1;next} /^==/{f=0} f' \
    | grep -v 'Simulator' \
    | grep -E '\([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}\)$')"
  count="$(printf '%s\n' "$devices" | grep -c . || true)"
  case "$count" in
    0)
      warn "no iOS device detected" >&2
      printf "      → plug in an iPhone/iPad, unlock it, and tap \"Trust This Computer\" if asked\n" >&2
      printf "      → confirm it in Xcode: Window -> Devices and Simulators\n" >&2
      return 1 ;;
    1)
      printf '%s\n' "$devices" | sed -E 's/.*\(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16})\)$/\1/'
      return 0 ;;
    *)
      warn "more than one iOS device attached; not guessing which one:" >&2
      printf '%s\n' "$devices" | sed 's/^/      /' >&2
      return 1 ;;
  esac
}

step "Looking for a connected iPhone/iPad"
UDID="$(detect_ios_device)" || exit 1
ok "device: $UDID"

# ===========================================================================
# Build + install (expo run:ios does prebuild, pod install, xcodebuild, and
# the on-device install in one step — this is the same command a developer
# would run by hand, just preflighted)
# ===========================================================================
cd "$FRONTEND" || die "frontend/ not found"

if [ ! -d node_modules ]; then
  step "Installing dependencies (npm ci)"
  npm ci || die "npm ci failed."
fi

step "Building and installing (this generates ios/, runs pod install, and builds via Xcode)"
printf "  First run downloads and compiles for several minutes.\n\n"

npx expo run:ios --device "$UDID" --configuration Release
run_status=$?
if [ "$run_status" -ne 0 ]; then
  printf "\n${RED}${BOLD}expo run:ios failed.${NC}\n" >&2
  cat >&2 <<EOF
The most common cause is code signing: open the .xcworkspace under frontend/ios
in Xcode once, select the app target -> Signing & Capabilities, and set your
own Apple ID as the team (a free account is enough for your own device; it
re-signs roughly every 7 days). Then re-run this script.
EOF
  exit 1
fi

step "Done"
ok "Installed on $UDID — look for Swifty Protein on the device."
printf "\n  Backend for the login screen: ${BOLD}make up${NC}, then set the LAN URL in\n"
printf "  the app under Settings → Backend URL (on a phone, \"localhost\" is the phone).\n"
