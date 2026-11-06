import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createProxy } from '../src/proxy.js';

function listen(srv) { return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port))); }
const post = (port, path, headers = {}) => new Promise((resolve, reject) => {
  const q = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
  q.on('error', reject); q.end('{"address":"0x0"}');
});
const get = (port, path, method = 'GET') => new Promise((resolve, reject) => {
  const q = http.request({ host: '127.0.0.1', port, path, method }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
  q.on('error', reject); q.end();
});

test('proxy forwards the feed and files only, read-only', async () => {
  const seen = [];
  const up = http.createServer((req, res) => { seen.push(req.method + ' ' + req.url + ' ' + req.headers.host); res.end('ok'); });
  const upPort = await listen(up);
  const proxy = createProxy({ upstreamHost: '127.0.0.1', upstreamPort: upPort });
  const port = await listen(proxy);
  assert.equal((await get(port, '/api/v1/spots')).status, 200);
  assert.equal((await get(port, '/files/models/04-abc.glb')).status, 200);
  assert.equal((await get(port, '/')).status, 404); // dashboard
  assert.equal((await get(port, '/api/spots')).status, 404); // admin list
  assert.equal((await get(port, '/files/models/../../x')).status, 404);
  assert.equal((await get(port, '/api/sponsors')).status, 404); // the organizer's approval list must never be on the public tunnel
  assert.equal((await get(port, '/sponsors.html')).status, 404); // the organizer page either
  assert.equal((await get(port, '/api/v1/sponsors/info')).status, 200); // but the advertiser page's read-only facts are
  assert.equal((await get(port, '/sponsor.html')).status, 200);
  assert.equal((await get(port, '/p/a7k2')).status, 200); // the public passport page
  assert.equal((await get(port, '/passport.html')).status, 200);
  assert.equal((await get(port, '/share/stamp/01')).status, 200); // share cards are public
  assert.equal((await get(port, '/share/stamp/01.png')).status, 200);
  assert.equal((await get(port, '/explorer.html')).status, 200); // the public explorer page
  assert.equal((await get(port, '/api/v1/explorer')).status, 200);
  assert.equal((await get(port, '/api/v1/spots', 'PUT')).status, 405);
  assert.equal((await get(port, '/api/spots', 'POST')).status, 405);
  assert.equal(seen.length, 10); // the feed, a model file, the advertiser page's two read-only requests, the two passport page requests, the two share-card requests and the two explorer requests
  // the faucet is the one POST the public front forwards, and only from its own page
  const before = seen.length;
  assert.equal((await post(port, '/api/v1/faucet', { origin: `http://127.0.0.1:${port}` })).status, 200);
  assert.equal((await post(port, '/api/v1/faucet', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(port, '/api/v1/faucet')).status, 403); // no origin at all
  assert.equal((await post(port, '/api/spots', { origin: `http://127.0.0.1:${port}` })).status, 405); // nothing else
  assert.equal(seen.length, before + 1);
  // the phone app's own API goes through, with its marker and bearer token; the organizer's routes still do not
  const seenBefore = seen.length;
  const sendApp = (m, path, headers = {}, body = '{}') => new Promise((resolve, reject) => {
    const q = http.request({ host: '127.0.0.1', port, path, method: m, headers: { 'content-type': 'application/json', ...headers } }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => resolve({ status: r.statusCode, body: b })); });
    q.on('error', reject); q.end(m === 'POST' ? body : undefined);
  });
  assert.equal((await sendApp('POST', '/api/v1/auth/nonce')).status, 200);
  assert.equal((await sendApp('POST', '/api/v1/capture/verify', { authorization: 'Bearer abc' })).status, 200);
  assert.equal((await sendApp('GET', '/api/v1/me', { authorization: 'Bearer abc' })).status, 200);
  assert.equal(seen.length, seenBefore + 3);
  assert.match(seen[seen.length - 2], /^POST \/api\/v1\/capture\/verify/);
  assert.equal((await sendApp('POST', '/api/v1/auth/nonce', { origin: 'https://evil.example' })).status, 403); // browsers are refused
  for (const p of ['/api/spots', '/api/sponsors', '/api/chain/sync', '/api/events']) assert.equal((await sendApp('POST', p)).status, 405); // organizer routes stay closed
  // a sponsor's ad shows after a capture: the app asks for the ad (signed in) and then loads its picture
  assert.equal((await sendApp('GET', '/api/v1/spots/02/ad', { authorization: 'Bearer abc' })).status, 200);
  assert.equal((await get(port, '/files/ads/abc123.webp')).status, 200);
  assert.match(seen[seen.length - 2], /^GET \/api\/v1\/spots\/02\/ad /);
  seen.length -= 2; // not counted below
  assert.equal((await sendApp('GET', '/api/v1/ads/stats')).status, 404);
  assert.equal((await sendApp('GET', '/api/spots')).status, 404);
  assert.equal(seen.length, seenBefore + 3); // none of the refused ones reached the server
  // query strings reach the server (the passport name check and the explorer search depend on them)
  await sendApp('GET', '/api/v1/passport/name?label=taco', { authorization: 'Bearer abc' });
  assert.match(seen[seen.length - 1], /^GET \/api\/v1\/passport\/name\?label=taco /);
  proxy.close(); up.close();
});
