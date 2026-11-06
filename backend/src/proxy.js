// Read-only public front for the spots server. It is the ONLY thing meant to be exposed to the internet
// (through a tunnel): it forwards just the app feed and the model/image files, and refuses everything else, so the
// dashboard and its edit API stay private on 127.0.0.1:3000.
import http from 'node:http';

const UP_HOST = process.env.UPSTREAM_HOST ?? '127.0.0.1';
const UP_PORT = Number(process.env.UPSTREAM_PORT ?? 3000);
const PORT = Number(process.env.PROXY_PORT ?? 3001);

const ALLOWED = [
  /^\/api\/health$/,
  /^\/api\/v1\/spots$/,
  /^\/files\/(models|images)\/[A-Za-z0-9._-]+$/,
  // the advertiser page and the two read-only facts it needs. The organizer's approval routes (/api/sponsors) are deliberately not here.
  /^\/(sponsor\.html|sponsor\.css|sponsor\.bundle\.js|logo\.png)$/,
  /^\/api\/v1\/sponsors\/(info|campaigns)$/,
];

export function createProxy({ upstreamHost = UP_HOST, upstreamPort = UP_PORT } = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const deny = (code, msg) => { res.writeHead(code, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end(msg); };
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD' }); return res.end(); }
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'Read-only.');
    if (!ALLOWED.some((re) => re.test(url.pathname))) return deny(404, 'Not found.');

    const headers = { host: `${upstreamHost}:${upstreamPort}` };
    for (const h of ['if-none-match', 'accept', 'range']) if (req.headers[h]) headers[h] = req.headers[h];
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
