#!/usr/bin/env bash
# Copies backend/.env and backend/data from this machine to the Lightsail server, then restarts it.
#   deploy/lightsail/push-secrets.sh <key.pem> <server-ip> <hostname>
# e.g. deploy/lightsail/push-secrets.sh ~/Downloads/LightsailDefaultKey-ap-south-1.pem 15.252.207.174 15-252-207-174.sslip.io
set -euo pipefail
KEY="${1:?path to the .pem key}"; IP="${2:?server ip}"; HOST="${3:?hostname}"
[ -f "$KEY" ] || { echo "No key file at $KEY. Download it from the Lightsail Connect tab (Download default key) and check the path: ls ~/Downloads/*.pem"; exit 1; }
cd "$(dirname "$0")/../.."
chmod 600 "$KEY"
S="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new backend/.env "ubuntu@$IP:/tmp/env"
scp -i "$KEY" -r backend/data "ubuntu@$IP:/tmp/data"
$S "ubuntu@$IP" "sudo mv /tmp/env /opt/wrld3/backend/.env && sudo rm -rf /opt/wrld3/backend/data && sudo mv /tmp/data /opt/wrld3/backend/data && sudo chown -R wrld3:wrld3 /opt/wrld3/backend && sudo chmod 600 /opt/wrld3/backend/.env && sudo sed -i 's#^PUBLIC_BASE_URL=.*#PUBLIC_BASE_URL=https://$HOST#' /opt/wrld3/backend/.env && sudo systemctl restart wrld3 wrld3-proxy"
echo "done. Check https://$HOST/api/health"
