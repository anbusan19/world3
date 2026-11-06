# Deploy the wrld3 server on AWS Lightsail

**Is Lightsail enough? Yes.** The server is one small Node process that keeps its state in JSON files, plus a thin proxy. Nothing
here needs a database, a GPU or autoscaling. A **1 GB plan (about $7/month)** is comfortable for a hackathon crowd; the 512 MB plan
usually works too but leaves no headroom on event day. You pay for one instance and one static IP. The one thing Lightsail does not
give you is a second copy of the data, so turn on **automatic snapshots** (see step 6).

## What runs where
```
phone ──https──> Caddy (80/443, automatic certificate) ──> proxy :3001 ──> server :3000 (private, 127.0.0.1)
                                                          app API only      dashboard + edit API
```
Only the proxy is reachable from the internet. It forwards the app's own routes (sign-in, capture, passport, feed, files, share cards)
and refuses everything else, so the organizer dashboard and its edit API cannot be reached from outside.

## Steps
1. **Create the instance.** Lightsail console, Create instance, Linux/Unix, *OS only* Ubuntu 24.04 LTS, the $7 (1 GB) plan, region
   Mumbai (`ap-south-1`) for event latency. Name it `wrld3`.
2. **Give it a static IP.** Networking, Create static IP, attach it to `wrld3`. Under the instance's Networking tab open
   ports **80** and **443** (HTTP, HTTPS); keep 22 (SSH) restricted to your own IP.
3. **Pick the hostname.**
   - With a domain: add an `A` record `api.<your-domain>` to the static IP.
   - Without one: use `<ip with dashes>.sslip.io`, for example IP `3.110.4.5` gives `3-110-4-5.sslip.io`. It resolves to that IP and
     gets a real certificate, so the app can use plain https.
4. **Run the setup script** (SSH in with the Lightsail browser terminal or your key):
   ```
   curl -fsSL https://raw.githubusercontent.com/anbusan19/world3/main/deploy/lightsail/setup.sh -o setup.sh
   sudo SITE=3-110-4-5.sslip.io bash setup.sh
   ```
   It installs Node 22 and Caddy, clones the repo to `/opt/wrld3`, starts the server and proxy as services that restart on reboot,
   and turns on the firewall.
5. **Copy your secrets and data from your Mac** (never through git):
   ```
   scp backend/.env           ubuntu@<ip>:/tmp/env
   scp -r backend/data        ubuntu@<ip>:/tmp/data
   ssh ubuntu@<ip> 'sudo mv /tmp/env /opt/wrld3/backend/.env && sudo rm -rf /opt/wrld3/backend/data && sudo mv /tmp/data /opt/wrld3/backend/data && sudo chown -R wrld3:wrld3 /opt/wrld3/backend && sudo chmod 600 /opt/wrld3/backend/.env && sudo systemctl restart wrld3 wrld3-proxy'
   ```
   Copying `data/` keeps your spots, events, captures, sponsors, passports and the on-chain ledger (so ids and "already captured" stay
   consistent). In `.env` set `PUBLIC_BASE_URL=https://<your hostname>`. **Run the server in only one place at a time**: stop the
   Mac server and tunnel before people use AWS, because each copy has its own `data/`.
6. **Back it up.** Lightsail, instance, Snapshots, turn on *Automatic snapshots*. Before the event also take one by hand.
7. **Check it:** `https://<hostname>/api/health` returns `{"ok":true,...}` and `https://<hostname>/api/spots` returns 404.
8. **Reach the dashboard privately** with an SSH tunnel, then open <http://localhost:3000>:
   ```
   ssh -L 3000:127.0.0.1:3000 ubuntu@<ip>
   ```
9. **Update later:** `sudo bash /opt/wrld3/deploy/lightsail/update.sh`.

## Point the app at it
Live sites: landing https://wrld3.vercel.app, sponsor page https://wrld3-sponsors.vercel.app (the proxy lists them in `PUBLIC_SITE_HOSTS`).

Build the APK with both servers, so people get a switch in **Profile, Settings, Connection**:
```
EXPO_PUBLIC_SERVERS="AWS|https://15-252-207-174.sslip.io,Laptop|https://<your-tunnel>.trycloudflare.com" scripts/build-apk.sh
```
The first entry is the default. Each server keeps its own sign-in and stamps, so people who switch sign in again.

## Costs and limits
About $7 a month plus nothing for the IP while it is attached. Outbound traffic is included (2 TB on that plan). Sepolia gas and
Arkiv writes come from your own keys and are separate.
