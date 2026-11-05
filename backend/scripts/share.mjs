// Starts the read-only proxy and a Cloudflare quick tunnel to it, and prints the public https URL for the app.
// Needs: the spots server running (npm start) and `cloudflared` installed. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { createProxy } from '../src/proxy.js';

const PORT = Number(process.env.PROXY_PORT ?? 3001);
const proxy = createProxy();
proxy.listen(PORT, '127.0.0.1');

const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let shown = false;
const onData = (d) => {
  const m = !shown && String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m) {
    shown = true;
    console.log(`\n  Public feed URL (paste into the app: Profile > Settings > Spot server):\n\n    ${m[0]}\n\n  Test:  curl ${m[0]}/api/v1/spots\n  Only the feed and model files are exposed. The dashboard stays on this Mac.\n`);
  }
};
cf.stdout.on('data', onData);
cf.stderr.on('data', onData);
cf.on('exit', (c) => { console.log('cloudflared exited', c); process.exit(c ?? 0); });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { cf.kill(); proxy.close(); process.exit(0); });
