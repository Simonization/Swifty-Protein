#!/usr/bin/env bash
#
# smoke.sh — prove the backend actually came up.
#
# `docker compose up -d` exiting 0 only means the containers were accepted; with
# restart: unless-stopped a backend that throws on boot just crash-loops quietly
# behind a green-looking `make up`. Polling /health means a broken boot fails
# here, loudly, instead of in front of the jury.

set -uo pipefail

URL="http://localhost:${PORT:-3000}/health"

for _ in $(seq 1 30); do
  if curl -fsS "$URL" 2>/dev/null | grep -q '"status":"ok"'; then
    echo ">> backend healthy at $URL"
    exit 0
  fi
  sleep 1
done

echo "!! backend never became healthy at $URL (waited 30s)" >&2
echo "   see why with: docker compose logs backend" >&2
exit 1
