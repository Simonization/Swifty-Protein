#!/usr/bin/env bash
#
# ensure-env.sh — two things `make up` needs in place before compose starts:
#
#   1. ./.env carries a JWT_SECRET (generated once, then left alone).
#   2. frontend/.env's EXPO_PUBLIC_API_URL points at this machine's current
#      LAN IP (refreshed on every run — unlike the secret, the IP can
#      legitimately change between runs: different Wi-Fi, DHCP lease, etc.).
#      This is what lets `make apk` / `make ios` produce a build that reaches
#      the backend on a phone tethered to this machine's network, with
#      nobody opening the app's Settings screen to type an IP in by hand.
#
# Both are gitignored; re-running is safe either way.

set -euo pipefail

cd "$(dirname "$0")/.."

ensure_jwt_secret() {
  if [ -f .env ] && grep -Eq '^JWT_SECRET=.+' .env; then
    return 0
  fi

  local secret
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -hex 32)"
  elif [ -r /dev/urandom ]; then
    secret="$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
  else
    echo "ensure-env.sh: need openssl or /dev/urandom to generate a secret" >&2
    exit 1
  fi

  umask 077
  # Start on a fresh line. Appending to a .env whose last line has no trailing
  # newline would splice onto it ("FOO=barJWT_SECRET=..."), defining nothing --
  # and the check above would miss it forever, appending again on every run.
  if [ -s .env ] && [ -n "$(tail -c 1 .env)" ]; then
    printf '\n' >> .env
  fi
  printf 'JWT_SECRET=%s\n' "$secret" >> .env
  echo ">> generated a random JWT_SECRET into .env"
}

ensure_frontend_api_url() {
  local ip
  ip="$(bash "$(dirname "${BASH_SOURCE[0]}")/lan-ip.sh" 2>/dev/null)" || {
    echo "!! could not detect a LAN IP (no network?) — leaving frontend/.env as-is" >&2
    return 0
  }
  local url="http://${ip}:3000"

  [ -f frontend/.env ] || : > frontend/.env

  # Rewrite the EXPO_PUBLIC_API_URL line in place without sed -i, whose flag
  # for "no backup suffix" differs between BSD (macOS) and GNU (Linux) --
  # grep -v + append is the same on both.
  local tmp
  tmp="$(mktemp)"
  grep -v '^EXPO_PUBLIC_API_URL=' frontend/.env > "$tmp" || true
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$url" >> "$tmp"
  mv "$tmp" frontend/.env

  echo ">> frontend/.env: EXPO_PUBLIC_API_URL=$url (this machine's current LAN IP)"
}

ensure_jwt_secret
ensure_frontend_api_url
