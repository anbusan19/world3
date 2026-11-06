// Read-only public front for the spots server. It is the ONLY thing meant to be exposed to the internet
// (through a tunnel): it forwards just the app feed and the model/image files, and refuses everything else, so the
// dashboard and its edit API stay private on 127.0.0.1:3000.
import http from 'node:http';

const UP_HOST = process.env.UPSTREAM_HOST ?? '127.0.0.1';
const UP_PORT = Number(process.env.UPSTREAM_PORT ?? 3000);
const PORT = Number(process.env.PROXY_PORT ?? 3001);
// websites (hostnames) allowed to call the faucet from a browser, e.g. the advertiser page on Vercel: PUBLIC_SITE_HOSTS=sponsors.example.vercel.app
const SITE_HOSTS = String(process.env.PUBLIC_SITE_HOSTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const ALLOWED = [
  /^\/api\/health$/,
  /^\/api\/v1\/spots$/,
  /^\/files\/(models|images)\/[A-Za-z0-9._-]+$/,
  // the advertiser page and the two read-only facts it needs. The organizer's approval routes (/api/sponsors) are deliberately not here.
  /^\/(sponsor\.html|sponsor\.css|skin\.css|sponsor\.bundle\.js|tour\.js|hero-globe\.bundle\.js|logo\.png|title-light\.png|title-dark\.png)$/,
  /^\/api\/v1\/sponsors\/(info|campaigns)$/,
  // the public passport page (it reads ENS itself; only the spots' names and art come from us)
  /^\/(passport\.html|passport\.css|skin\.css|passport\.bundle\.js|title-light\.png|title-dark\.png)$/,
  /^\/p\/[a-z0-9-]{1,32}\/?$/i,
  // the explorer: recent stamps across everyone, no personal data
  /^\/(explorer\.html|skin\.css|hero-globe\.bundle\.js|logo\.png|title-light\.png|title-dark\.png)$/,
  /^\/share\/(ad|stamp)\/[A-Za-z0-9._-]{1,80}$/, // share cards (picture + the page X reads)
  /^\/stamp\/[0-9a-f]{64}\.json$/, // ERC-1155 metadata
  /^\/api\/v1\/chain$/,
  /^\/api\/v1\/explorer$/,
  /^\/api\/v1\/faucet\/info$/,
];

// The phone app's own API. These are the only non-public routes the front forwards, and only with the method listed.
// The organizer dashboard's routes (/api/spots, /api/events, /api/sponsors, /api/chain/sync, ads stats ...) are NOT here.
const APP_GET = [/^\/api\/v1\/me$/, /^\/api\/v1\/me\/captures$/, /^\/api\/v1\/passport$/, /^\/api\/v1\/passport\/name$/, /^\/api\/v1\/vouchers$/];
const APP_POST = [/^\/api\/v1\/auth\/(nonce|verify|signout)$/, /^\/api\/v1\/capture\/(nonce|verify)$/, /^\/api\/v1\/passport(\/public)?$/, /^\/api\/v1\/ads\/impression$/];
const APP_BODY_MAX = 512 * 1024;

// a small per-address limit, since this front faces the internet: reads 1500 a minute, writes 300 a minute (a venue puts many phones behind one address)
function limiter() {
  const hits = new Map();
  setInterval(() => hits.clear(), 60_000).unref();
  return (ip, write) => { const k = `${ip}|${write ? 'w' : 'r'}`; const n = (hits.get(k) ?? 0) + 1; hits.set(k, n); return n <= (write ? 300 : 1500); };
}
const clientIp = (req) => String(req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();

export function createProxy({ upstreamHost = UP_HOST, upstreamPort = UP_PORT } = {}) {
  const allow = limiter();
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const deny = (code, msg) => { res.writeHead(code, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end(msg); };
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD' }); return res.end(); }
    // the one write the public front allows: asking the testnet faucet for tGLM
    if (req.method === 'POST' && url.pathname === '/api/v1/faucet') {
      try { const oh = new URL(req.headers.origin ?? '').host; if (oh !== req.headers.host && !SITE_HOSTS.includes(oh)) return deny(403, 'Cross-site requests are not allowed.'); } catch { return deny(403, 'Cross-site requests are not allowed.'); }
      let size = 0;
      const up = http.request({ host: upstreamHost, port: upstreamPort, method: 'POST', path: url.pathname, headers: {
        host: `${upstreamHost}:${upstreamPort}`, 'content-type': 'application/json', 'x-requested-with': 'wrld3-dashboard',
        'x-forwarded-for': String(req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim(),
      } }, (r) => { res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] ?? 'application/json', 'access-control-allow-origin': '*' }); r.pipe(res); });
      up.on('error', () => deny(502, 'The spots server is not running.'));
      req.on('data', (c) => { size += c.length; if (size > 1024) { up.destroy(); deny(413, 'Too large.'); req.destroy(); } else up.write(c); });
      req.on('end', () => up.end());
      return undefined;
    }
    if (req.method === 'POST' && APP_POST.some((re) => re.test(url.pathname))) {
      if (!allow(clientIp(req), true)) return deny(429, 'Slow down.');
      if (req.headers.origin) return deny(403, 'Not for browsers.'); // the phone app sends no Origin header
      let size = 0; let dead = false;
      const up = http.request({ host: upstreamHost, port: upstreamPort, method: 'POST', path: url.pathname, headers: {
        host: `${upstreamHost}:${upstreamPort}`, 'content-type': req.headers['content-type'] ?? 'application/json', 'x-requested-with': 'wrld3-app',
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}), 'x-forwarded-for': clientIp(req),
      } }, (r) => { res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] ?? 'application/json' }); r.pipe(res); });
      up.on('error', () => !dead && deny(502, 'The spots server is not running.'));
      up.setTimeout(30000, () => up.destroy());
      req.on('data', (c) => { size += c.length; if (size > APP_BODY_MAX) { dead = true; up.destroy(); deny(413, 'Too large.'); req.destroy(); } else up.write(c); });
      req.on('end', () => !dead && up.end());
      return undefined;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'Read-only.');
    const appRead = APP_GET.some((re) => re.test(url.pathname));
    if (!allow(clientIp(req), false)) return deny(429, 'Slow down.');
    if (!appRead && !ALLOWED.some((re) => re.test(url.pathname))) return deny(404, 'Not found.');

    const headers = { host: `${upstreamHost}:${upstreamPort}`, 'x-forwarded-host': String(req.headers['x-forwarded-host'] ?? req.headers.host ?? ''), 'x-forwarded-proto': String(req.headers['x-forwarded-proto'] ?? 'https').split(',')[0] };
    for (const h of ['if-none-match', 'accept', 'range', ...(appRead ? ['authorization'] : [])]) if (req.headers[h]) headers[h] = req.headers[h];
    const up = http.request({ host: upstreamHost, port: upstreamPort, method: req.method, path: url.pathname, headers }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    up.on('error', () => deny(502, 'The spots server is not running.'));
    up.setTimeout(15000, () => up.destroy());
    req.on('close', () => up.destroy());
    up.end();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createProxy().listen(PORT, '127.0.0.1', () => console.log(`Read-only proxy on http://127.0.0.1:${PORT} -> ${UP_HOST}:${UP_PORT}`));
}
