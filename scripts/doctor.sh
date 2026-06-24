#!/usr/bin/env bash
#
# doctor.sh — dependency checker for the Swifty-Proteins project.
#
# Goal: in 2 years, an RNCP juror on any machine should be able to run this
# and learn EXACTLY what they need to test the project. With the Docker-based
# setup, the only hard requirement is Docker itself — everything else
# (Node, Android SDK, build-tools) lives inside containers.
#
# Exit code 0 = ready to run the project, non-zero = something missing.

set -u

# --- pretty output ---------------------------------------------------------
if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BOLD=""; NC=""
fi

missing=0
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
bad()  { printf "  ${RED}✗${NC} %s\n" "$1"; missing=$((missing+1)); }

# --- detect OS for install hints ------------------------------------------
OS="unknown"
case "$(uname -s)" in
  Linux*)  OS="linux" ;;
  Darwin*) OS="macos" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
esac

hint_docker() {
  case "$OS" in
    linux)   echo "      → https://docs.docker.com/engine/install/ (and add your user to the 'docker' group)";;
    macos)   echo "      → https://docs.docker.com/desktop/install/mac-install/  (or: brew install --cask docker)";;
    windows) echo "      → https://docs.docker.com/desktop/install/windows-install/ (WSL2 backend)";;
    *)       echo "      → https://docs.docker.com/get-docker/";;
  esac
}

printf "${BOLD}Swifty-Proteins — dependency check${NC}  (OS: %s)\n\n" "$OS"

# --- REQUIRED: Docker ------------------------------------------------------
printf "${BOLD}Required (to run the project):${NC}\n"
if command -v docker >/dev/null 2>&1; then
  ok "docker found — $(docker --version 2>/dev/null)"
  if docker info >/dev/null 2>&1; then
    ok "docker daemon is running"
  else
    bad "docker is installed but the daemon is not running (start Docker Desktop / 'sudo systemctl start docker')"
  fi
else
  bad "docker not found"
  hint_docker
fi

# docker compose v2 (plugin) or legacy v1
if docker compose version >/dev/null 2>&1; then
  ok "docker compose (v2) found"
elif command -v docker-compose >/dev/null 2>&1; then
  warn "only legacy 'docker-compose' (v1) found — v2 ('docker compose') recommended"
else
  bad "docker compose not found (ships with modern Docker Desktop / docker-compose-plugin)"
fi

# --- OPTIONAL: only needed to RE-BUILD the APK from source -----------------
printf "\n${BOLD}Optional (only to rebuild the APK from source):${NC}\n"
printf "  The shipped ${BOLD}dist/app-release.apk${NC} needs none of these — install on a phone and go.\n"

if docker buildx version >/dev/null 2>&1; then
  ok "docker buildx found (used by 'make apk')"
else
  warn "docker buildx not found — 'make apk' may be slower / unavailable"
fi

# KVM speeds up an Android emulator on the host (jury may prefer a real device)
if [ "$OS" = "linux" ]; then
  if [ -e /dev/kvm ]; then ok "/dev/kvm present (hardware-accelerated emulator possible)"
  else warn "/dev/kvm not present — use a physical Android device, or enable virtualization in BIOS"; fi
fi

# --- verdict ---------------------------------------------------------------
printf "\n"
if [ "$missing" -eq 0 ]; then
  printf "${GREEN}${BOLD}All set.${NC} Run ${BOLD}make up${NC} to start the backend, then install ${BOLD}dist/app-release.apk${NC}.\n"
  exit 0
else
  printf "${RED}${BOLD}%d required item(s) missing.${NC} Fix the ✗ lines above, then re-run ${BOLD}make doctor${NC}.\n" "$missing"
  exit 1
fi
