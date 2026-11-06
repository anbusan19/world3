#!/usr/bin/env bash
# Sets up the wrld3 server on a fresh Ubuntu 22.04/24.04 Lightsail instance. Run as root (sudo):
#   sudo SITE=api.example.com bash setup.sh
# SITE is the hostname people will use. No domain? Use <your-static-ip-with-dashes>.sslip.io, e.g. 3-110-4-5.sslip.io
# (it resolves to that IP and Caddy gets a real certificate for it).
set -euo pipefail
: "${SITE:?set SITE=your.hostname}"
REPO="${REPO:-https://github.com/anbusan19/world3.git}"
APP=/opt/wrld3

apt-get update -y
apt-get install -y curl git debian-keyring debian-archive-keyring apt-transport-https gpg ufw
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
# Caddy (automatic HTTPS)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

id wrld3 >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin wrld3
git config --global --add safe.directory "$APP"
[ -d "$APP/.git" ] || git clone "$REPO" "$APP"
git -C "$APP" pull --ff-only
(cd "$APP/backend" && npm ci --omit=dev)
mkdir -p "$APP/backend/data"
chown -R wrld3:wrld3 "$APP"
[ -f "$APP/backend/.env" ] || { cp "$APP/backend/.env.example" "$APP/backend/.env"; chown wrld3:wrld3 "$APP/backend/.env"; echo ">> fill in $APP/backend/.env (or scp your own)"; }
chmod 600 "$APP/backend/.env"

# the main server stays on 127.0.0.1:3000 (dashboard + edit API: private); only the proxy on 3001 is public via Caddy
cat >/etc/systemd/system/wrld3.service <<UNIT
[Unit]
Description=wrld3 server
After=network-online.target
[Service]
User=wrld3
WorkingDirectory=$APP/backend
ExecStart=/usr/bin/node src/server.js
Environment=PORT=3000 NODE_ENV=production PUBLIC_BASE_URL=https://$SITE
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
cat >/etc/systemd/system/wrld3-proxy.service <<UNIT
[Unit]
Description=wrld3 public proxy (app API only)
After=wrld3.service
[Service]
User=wrld3
WorkingDirectory=$APP/backend
ExecStart=/usr/bin/node src/proxy.js
Environment=PROXY_PORT=3001
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
cat >/etc/caddy/Caddyfile <<CADDY
$SITE {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
}
CADDY

ufw allow 22/tcp
ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable
systemctl daemon-reload
systemctl enable --now wrld3 wrld3-proxy
systemctl restart caddy
sleep 3
curl -fsS "http://127.0.0.1:3001/api/health" && echo && echo "up: https://$SITE/api/health"
