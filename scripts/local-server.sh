#!/usr/bin/env bash
# Runs the public proxy and a Cloudflare tunnel for the server on this machine, and prints the https address.
# The address changes each time unless you use a named tunnel with your own domain (docs/hosting.md).
# Start the main server first: (cd backend && npm start)
set -euo pipefail
cd "$(dirname "$0")/../backend"
pkill -f "src/proxy.js" 2>/dev/null || true; pkill cloudflared 2>/dev/null || true
node src/proxy.js > /tmp/wrld3-proxy.log 2>&1 &
cloudflared tunnel --url http://127.0.0.1:3001 --no-autoupdate > /tmp/wrld3-tunnel.log 2>&1 &
for _ in $(seq 1 30); do U=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/wrld3-tunnel.log | head -1); [ -n "$U" ] && break; sleep 1; done
echo "public address: ${U:-not ready, see /tmp/wrld3-tunnel.log}"
echo "bake it in: EXPO_PUBLIC_SERVERS=\"Laptop|${U}\" scripts/build-apk.sh"
wait
