#!/usr/bin/env bash
#
# ensure-env.sh — guarantee ./.env carries a JWT_SECRET before compose starts.
#
# The backend image runs with NODE_ENV=production, and config.js deliberately
# refuses to boot on the dev fallback secret. Compose auto-loads ./.env from the
# project directory, so generating a real random secret here is what lets
# `make up` work with no setup — without baking a known secret into the repo and
# quietly hollowing out that production guard.
#
# .env is gitignored. Re-running is a no-op.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ] && grep -Eq '^JWT_SECRET=.+' .env; then
  exit 0
fi

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif [ -r /dev/urandom ]; then
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
  else
    echo "ensure-env.sh: need openssl or /dev/urandom to generate a secret" >&2
    exit 1
  fi
}

umask 077

# Start on a fresh line. Appending to a .env whose last line has no trailing
# newline would splice onto it ("FOO=barJWT_SECRET=..."), defining nothing --
# and the grep above would miss it forever, appending again on every run.
if [ -s .env ] && [ -n "$(tail -c 1 .env)" ]; then
  printf '\n' >> .env
fi

printf 'JWT_SECRET=%s\n' "$(gen_secret)" >> .env
echo ">> generated a random JWT_SECRET into .env"
