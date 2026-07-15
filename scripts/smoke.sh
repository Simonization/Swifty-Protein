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

# curl is not guaranteed on the host, and failing for a missing test tool would be
# the same false alarm this script exists to prevent. Node 20+ is already required
# to run the app, and has global fetch.
if command -v curl >/dev/null 2>&1; then
  probe() { curl -fsS "$URL" 2>/dev/null | grep -q '"status":"ok"'; }
elif command -v node >/dev/null 2>&1; then
  probe() {
    node -e "fetch('$URL').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))" 2>/dev/null
  }
else
  echo "!! neither curl nor node found — skipping the health check" >&2
  echo "   verify manually: $URL" >&2
  exit 0
fi

for _ in $(seq 1 30); do
  if probe; then
    echo ">> backend healthy at $URL"
    exit 0
  fi
  sleep 1
done

echo "!! backend never became healthy at $URL (waited 30s)" >&2
echo "   see why with: docker compose logs backend" >&2
exit 1
