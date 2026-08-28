#!/usr/bin/env bash
#
# apk.sh — build an installable Android APK, then put it on a phone.
#
# One command for the whole path the subject asks for: generate the native
# Android project, build a release APK, drop it at dist/app-release.apk, and
# install it if a phone is plugged in. Everything it needs is checked up front,
# so a missing JDK is a one-line message and not a 200-line Gradle stack trace.
#
# Usage:
#   bash scripts/apk.sh                 build, then install if a phone is found
#   bash scripts/apk.sh --install-only  skip the build, install dist/app-release.apk
#   SKIP_INSTALL=1 bash scripts/apk.sh  build only, never touch the phone
#
# Exit code 0 = an APK exists at dist/app-release.apk.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
DIST="$ROOT/dist"
APK="$DIST/app-release.apk"
GRADLE_OUT="$FRONTEND/android/app/build/outputs/apk/release/app-release.apk"

INSTALL_ONLY=0
[ "${1:-}" = "--install-only" ] && INSTALL_ONLY=1

# --- pretty output (same vocabulary as doctor.sh) --------------------------
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

is_wsl() { grep -qi microsoft /proc/version 2>/dev/null; }

# --- where is the Android SDK? ---------------------------------------------
# Respect the environment first, then look where each platform's installer puts
# it. Returns empty if there is no SDK anywhere we know about.
find_sdk() {
  local c
  for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" \
           "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" \
           "/usr/lib/android-sdk" "/opt/android-sdk"; do
    [ -n "$c" ] && [ -d "$c/platform-tools" ] && { echo "$c"; return 0; }
  done
  return 1
}

# adb ships inside the SDK; it is only on PATH if the user put it there.
find_adb() {
  local sdk
  command -v adb 2>/dev/null && return 0
  sdk="$(find_sdk)" && [ -x "$sdk/platform-tools/adb" ] && { echo "$sdk/platform-tools/adb"; return 0; }
  return 1
}

# --- phone detection --------------------------------------------------------
# Prints one serial on stdout when exactly one phone is ready, and explains the
# situation on stderr otherwise. Never fails the build: no phone just means the
# APK gets copied by hand.
detect_phone() {
  local adb devices ready unauth
  adb="$(find_adb)" || {
    warn "adb not found — cannot detect a phone (it ships in the SDK's platform-tools/)" >&2
    return 1
  }

  # Starts the adb server on first run; its chatter is not our output.
  devices="$("$adb" devices 2>/dev/null | tail -n +2)"
  ready="$(echo "$devices"  | awk '$2 == "device"       {print $1}')"
  unauth="$(echo "$devices" | awk '$2 == "unauthorized" {print $1}')"

  if [ -n "$unauth" ]; then
    warn "a phone is connected but not authorized — unlock it and tap 'Allow USB debugging'" >&2
    return 1
  fi

  case "$(echo "$ready" | grep -c .)" in
    0)
      if is_wsl; then
        warn "no phone detected. On WSL2, USB devices are not visible to Linux unless" >&2
        warn "you forward them: install usbipd-win on Windows, then 'usbipd attach --wsl'." >&2
        warn "Copying the APK to the phone by hand works just as well." >&2
      else
        warn "no phone detected — enable Developer options → USB debugging, then plug it in" >&2
      fi
      return 1 ;;
    1) echo "$ready"; return 0 ;;
    *)
      warn "more than one device attached; not guessing which one:" >&2
      echo "$ready" | sed 's/^/      /' >&2
      warn "install by hand: adb -s <serial> install -r $APK" >&2
      return 1 ;;
  esac
}

install_to_phone() {
  local serial adb
  serial="$(detect_phone)" || return 1
  adb="$(find_adb)"
  ok "phone detected: $serial"
  printf "     installing (-r replaces any previous build)…\n"
  # -r keeps app data across reinstalls; a signature change still needs a manual
  # uninstall, which the message below covers.
  if "$adb" -s "$serial" install -r "$APK"; then
    ok "installed — look for ${BOLD}Swifty Proteins${NC} in the app drawer"
    return 0
  fi
  bad "install failed. If it complains about signatures, remove the old copy first:"
  printf "      %s -s %s uninstall com.noachlly.swiftyprotein\n" "$adb" "$serial"
  return 1
}

# ===========================================================================
# install-only: skip everything else
# ===========================================================================
if [ "$INSTALL_ONLY" -eq 1 ]; then
  [ -f "$APK" ] || die "No APK at $APK — run 'make apk' first."
  step "Installing $(basename "$APK")"
  install_to_phone || exit 1
  exit 0
fi

# ===========================================================================
# 1. Preflight — fail with a fixable message, not a Gradle stack trace
# ===========================================================================
printf "${BOLD}Building the Swifty-Proteins APK${NC}\n"
step "Checking the toolchain"

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

# React Native 0.86 / AGP 8 need JDK 17+. JDK 11 fails deep inside Gradle with a
# class-version error, which is why this is checked here and not discovered there.
if command -v java >/dev/null 2>&1; then
  java_major="$(java -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p')"
  if [ "${java_major:-0}" -ge 17 ]; then
    ok "java $(java -version 2>&1 | head -1 | sed 's/.*version "\([^"]*\)".*/\1/')"
  else
    bad "java ${java_major:-?} is too old — React Native 0.86 needs JDK 17+"; missing=$((missing+1))
  fi
else
  bad "java not found — install a JDK 17+:"; missing=$((missing+1))
  case "$(uname -s)" in
    Darwin*) printf "      → brew install --cask temurin@17\n" ;;
    Linux*)  printf "      → sudo apt install openjdk-17-jdk   (or your distro's equivalent)\n" ;;
    *)       printf "      → https://adoptium.net/temurin/releases/?version=17\n" ;;
  esac
fi

if SDK="$(find_sdk)"; then
  ok "android sdk — $SDK"
  export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
else
  bad "no Android SDK found (looked at \$ANDROID_HOME, \$ANDROID_SDK_ROOT, ~/Android/Sdk,"; missing=$((missing+1))
  printf "      ~/Library/Android/sdk, /usr/lib/android-sdk, /opt/android-sdk)\n"
  printf "      → install Android Studio, or the command-line tools:\n"
  printf "        https://developer.android.com/studio#command-tools\n"
  printf "      → then: export ANDROID_HOME=\$HOME/Android/Sdk\n"
fi

if [ "$missing" -gt 0 ]; then
  printf "\n${YELLOW}${BOLD}%d item(s) missing — no local build is possible on this machine.${NC}\n" "$missing"
  printf "\n${BOLD}You do not need any of it if you build in the cloud instead:${NC}\n"
  printf "    cd frontend && npx eas-cli build --platform android --profile preview\n"
  printf "  That needs a free Expo account and network access, and ${BOLD}no local Android\n"
  printf "  toolchain at all${NC}. It prints a download link when the build finishes.\n"
  exit 1
fi

# ===========================================================================
# 2. Build
# ===========================================================================
cd "$FRONTEND" || die "frontend/ not found"

if [ ! -d node_modules ]; then
  step "Installing dependencies (npm ci)"
  npm ci || die "npm ci failed."
fi

step "Pointing the build at this machine's backend"
# EXPO_PUBLIC_API_URL is inlined into the JS bundle below (expo prebuild +
# gradle run Metro, which loads frontend/.env automatically) — refreshing it
# here means an APK built for "phone tethered to this machine" reaches the
# backend without anyone opening Settings on the phone to type an IP in.
# Safe to run even without `make up` first: it only touches frontend/.env.
bash "$ROOT/scripts/ensure-env.sh" || warn "could not refresh frontend/.env — building with whatever it already has"

step "Generating the native Android project (expo prebuild)"
# The icon and the native launch screen are applied here — this step is exactly
# why Expo Go shows Expo's branding and an APK shows ours.
NODE_ENV=production npx expo prebuild --platform android --no-install \
  || die "expo prebuild failed."

step "Compiling the release APK (gradle)"
printf "  First run downloads Gradle and the Android build tools; expect several minutes.\n\n"
[ -x android/gradlew ] || chmod +x android/gradlew 2>/dev/null
( cd android && ./gradlew assembleRelease ) || die "Gradle build failed."

[ -f "$GRADLE_OUT" ] || die "Gradle reported success but no APK at $GRADLE_OUT"

# ===========================================================================
# 3. Publish the artifact where the jury guide says it is
# ===========================================================================
mkdir -p "$DIST"
cp "$GRADLE_OUT" "$APK"

size="$(du -h "$APK" | cut -f1)"
step "Done"
ok "$APK ($size)"
if command -v sha256sum >/dev/null 2>&1; then
  printf "     sha256 %s\n" "$(sha256sum "$APK" | cut -c1-16)…"
fi
warn "debug-signed: Expo's template signs 'release' with the debug keystore."
printf "     It installs and runs; it is simply not store-signed.\n"

# ===========================================================================
# 4. Onto the phone
# ===========================================================================
if [ "${SKIP_INSTALL:-0}" = "1" ]; then
  printf "\n  SKIP_INSTALL=1 — not touching the phone.\n"
else
  step "Looking for a phone"
  install_to_phone || {
    printf "\n  ${BOLD}Install it by hand instead:${NC}\n"
    printf "    copy %s to the phone (USB, Drive, email…), open it there,\n" "dist/app-release.apk"
    printf "    and allow 'install from unknown sources' when Android asks.\n"
    printf "    With a phone plugged in later: ${BOLD}make install${NC}\n"
  }
fi

printf "\n  Backend for the login screen: ${BOLD}make up${NC}, then set the LAN URL in\n"
printf "  the app under Settings → Backend URL (on a phone, 'localhost' is the phone).\n"
