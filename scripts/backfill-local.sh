#!/usr/bin/env bash
# Lend the production backfill this machine's IP: runs the Worker locally (env `backfill` in wrangler.jsonc,
# production D1/R2, local gate and workflows) and keeps its telemetry slots filled. Needs `wrangler login`.
# Runs until stopped; keeps the Mac awake meanwhile.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-5180}"
TOKEN="$(sed -n 's/^ADMIN_TOKEN="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' .dev.vars)"

CLOUDFLARE_ENV=backfill caffeinate -i npx vite --port "$PORT" --strictPort &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT

until curl -sf "localhost:$PORT/api/health" >/dev/null; do sleep 2; done
echo "backfill helper up on :$PORT"

# Finished jobs start the next one themselves; this catches anything that slipped (restart, stale claims).
while kill -0 "$SERVER" 2>/dev/null; do
  curl -s -X POST -H "Authorization: Bearer $TOKEN" "localhost:$PORT/api/admin/tick" >/dev/null || true
  sleep 300
done
