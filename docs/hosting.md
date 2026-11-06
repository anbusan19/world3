# Hosting World3 so anyone can use the app

The backend is ONE stateful Node process (`backend/`): sign-ins, captures (the World ID replay protection), passports, sponsors,
the event clock and the faucet all live in `backend/data/*.json`, and the keys live in `backend/.env`. That shapes every choice.

## Run one primary, behind a stable address
- Put a **domain you own** in the app build (`EXPO_PUBLIC_SERVERS="Main|https://api.<your-domain>"`), never a tunnel or IP address.
  Then the server can move (Mac mini now, AWS later) by changing DNS/tunnel only, with no app update.
- Two processes, as on the Mac: the main server stays on `127.0.0.1:3000` (dashboard + edit API, private) and only the read-only
  public front (`npm run proxy`, port 3001) is exposed.

## Option A: the Mac mini (fastest, free)
Cloudflare Tunnel with a *named* tunnel and your domain: `cloudflared tunnel create world3`, route `api.<domain>` to
`http://127.0.0.1:3001`, run it as a service. Keep the Mac awake (`caffeinate -s`, or Energy Saver "prevent sleeping"), start the
server and proxy with `launchd` so they restart after a reboot. Weak spots: home power and internet.

## Option B: AWS (more reliable)
One small instance (Lightsail or EC2 `t4g.nano`/`t4g.micro`, Node 24, Caddy for HTTPS), a persistent disk for `backend/data`,
secrets in the instance environment or SSM Parameter Store, and a nightly snapshot or `aws s3 sync` of `backend/data`.
Reach the private dashboard only over SSH port-forward or Tailscale.

## Two servers at once?
Do NOT run two independent copies and let phones use either: each has its own `data/`, so a person could capture the same spot
once per server, and sessions, passports and sponsors would differ. For a standby, keep ONE primary and sync `backend/data` to the
second machine every minute; to fail over, point the domain/tunnel at the standby. The in-app "Server" list is for people who
cannot reach the primary from their network, and says plainly that each server keeps its own sign-in and stamps.
