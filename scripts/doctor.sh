#!/usr/bin/env bash
#
# doctor.sh — dependency checker for the Swifty-Proteins project.
#
# Goal: in 2 years, an RNCP juror on any machine should be able to run this
# and learn EXACTLY what they need to test the project. Docker runs the backend
# and its database; the app is an Expo managed app, so it needs Node on the host
# and the Expo Go app on the phone.
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

# --- REQUIRED: Node, to run the Expo app -----------------------------------
if command -v node >/dev/null 2>&1; then
  node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "${node_major:-0}" -ge 20 ]; then
    ok "node found — $(node -v) (needed for 'npx expo start')"
  else
    bad "node $(node -v) is too old — Expo needs Node 20+"
  fi
else
  bad "node not found — needed to run the app with 'npx expo start' (https://nodejs.org)"
fi

# --- OPTIONAL --------------------------------------------------------------
printf "\n${BOLD}On the phone:${NC}\n"
printf "  Install ${BOLD}Expo Go${NC} from the Play Store, then scan the QR from 'npx expo start'.\n"
printf "  The phone and this machine must be on the same network.\n"

# KVM speeds up an Android emulator on the host (jury may prefer a real device)
printf "\n${BOLD}Optional (emulator instead of a real device):${NC}\n"
if [ "$OS" = "linux" ]; then
  if [ -e /dev/kvm ]; then ok "/dev/kvm present (hardware-accelerated emulator possible)"
  else warn "/dev/kvm not present — use a physical Android device, or enable virtualization in BIOS"; fi
else
  printf "  A physical device is recommended (the subject requires testing on one).\n"
fi

# --- verdict ---------------------------------------------------------------
printf "\n"
if [ "$missing" -eq 0 ]; then
  printf "${GREEN}${BOLD}All set.${NC} Run ${BOLD}make up${NC} for the backend, then ${BOLD}cd frontend && npx expo start${NC}.\n"
  exit 0
else
  printf "${RED}${BOLD}%d required item(s) missing.${NC} Fix the ✗ lines above, then re-run ${BOLD}make doctor${NC}.\n" "$missing"
  exit 1
fi
