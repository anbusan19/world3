#!/usr/bin/env bash
# Pull the latest code and restart. Run on the instance: sudo bash /opt/wrld3/deploy/lightsail/update.sh
set -euo pipefail
git -C /opt/wrld3 pull --ff-only
(cd /opt/wrld3/backend && npm ci --omit=dev)
chown -R wrld3:wrld3 /opt/wrld3
systemctl restart wrld3 wrld3-proxy
