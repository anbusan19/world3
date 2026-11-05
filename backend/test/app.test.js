import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSampleGlb } from '../scripts/make-sample-glb.mjs';
import { createApp } from '../src/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let dir, server, store, base, port;
const H = { 'x-requested-with': 'world3-dashboard' };
const json = (extra = {}) => ({ ...H, 'content-type': 'application/json', ...extra });

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-test-'));
  ({ server, store } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public') }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

// fetch cannot set the Host header, so the Host test uses the raw http client
const raw = (opts) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, ...opts }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });

test('starts with the three spots from the app, all published', async () => {
  const feed = await (await fetch(`${base}/api/v1/spots`)).json();
  assert.equal(feed.spots.length, 3);
  assert.deepEqual(feed.spots[0].coord, [72.8347, 18.922]); // [lng, lat]
  assert.equal(feed.spots[0].model, null);
});

test('rejects bad input with a message per field', async () => {
  const r = await fetch(`${base}/api/spots`, { method: 'POST', headers: json(), body: JSON.stringify({ name: 'x', lat: 120, lng: 0 }) });
  assert.equal(r.status, 400);
  const { issues } = await r.json();
  assert.deepEqual(issues.map((i) => i.field).sort(), ['lat', 'name']);
});

test('a new spot starts as a draft and stays out of the app feed', async () => {
  const r = await fetch(`${base}/api/spots`, { method: 'POST', headers: json(), body: JSON.stringify({ name: 'Taj Mahal', lat: 27.1751, lng: 78.0421, city: 'Agra' }) });
  assert.equal(r.status, 201);
  const { spot } = await r.json();
  assert.equal(spot.id, '04');
  assert.equal(spot.published, false);
  assert.equal(spot.label, 'TAJ');
  const feed = await (await fetch(`${base}/api/v1/spots`)).json();
  assert.ok(!feed.spots.some((s) => s.id === '04'));
});

test('the approach radius must stay bigger than the capture radius', async () => {
  const r = await fetch(`${base}/api/spots/04`, { method: 'PUT', headers: json(), body: JSON.stringify({ captureRadiusM: 150 }) }); // saved approach radius is 100
  assert.equal(r.status, 400);
  assert.equal((await r.json()).issues[0].field, 'approachRadiusM');
});

test('upload a model, publish, and the app feed serves it with a forever-cacheable file', async () => {
  const up = await fetch(`${base}/api/spots/04/model`, { method: 'PUT', headers: { ...H, 'content-type': 'application/octet-stream', 'x-filename': 'arch.glb' }, body: buildSampleGlb() });
  assert.equal(up.status, 200);
  const { spot } = await up.json();
  assert.equal(spot.model.stats.triangles, 84);
  assert.equal(spot.model.originalName, 'arch.glb');

  await fetch(`${base}/api/spots/04`, { method: 'PUT', headers: json(), body: JSON.stringify({ published: true, scale: 2, heading: 90 }) });
  const feed = await (await fetch(`${base}/api/v1/spots`)).json();
  const pub = feed.spots.find((s) => s.id === '04');
  assert.equal(pub.model.scale, 2);
  assert.equal(pub.model.heading, 90);

  const file = await fetch(`${base}${pub.model.url}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'model/gltf-binary');
  assert.match(file.headers.get('cache-control'), /immutable/);
  assert.equal(file.headers.get('access-control-allow-origin'), '*');
  assert.equal(Buffer.from(await file.arrayBuffer()).length, spot.model.bytes);
});

test('the feed supports conditional requests so the app can skip unchanged downloads', async () => {
  const first = await fetch(`${base}/api/v1/spots`);
  const again = await fetch(`${base}/api/v1/spots`, { headers: { 'if-none-match': first.headers.get('etag') } });
  assert.equal(again.status, 304);
});

test('rejects a file that is not a model, and keeps the old one', async () => {
  const bad = await fetch(`${base}/api/spots/04/model`, { method: 'PUT', headers: { ...H, 'content-type': 'application/octet-stream' }, body: 'this is not a glb file at all' });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /not a \.glb/i);
  assert.ok(store.get('04').model);
});

test('replacing a model deletes the old file from disk', async () => {
  const before = store.get('04').model.file;
  const glb = buildSampleGlb();
  glb[glb.length - 1] ^= 0xff; // a different file, so a different hash
  await fetch(`${base}/api/spots/04/model`, { method: 'PUT', headers: { ...H, 'content-type': 'application/octet-stream' }, body: glb });
  const after = store.get('04').model.file;
  assert.notEqual(before, after);
  assert.ok(!existsSync(path.join(store.modelsDir, before)));
  assert.ok(existsSync(path.join(store.modelsDir, after)));
});

test('stamp images must really be images', async () => {
  const bad = await fetch(`${base}/api/spots/04/image`, { method: 'PUT', headers: { ...H, 'content-type': 'image/png' }, body: 'not an image' });
  assert.equal(bad.status, 400);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const ok = await fetch(`${base}/api/spots/04/image`, { method: 'PUT', headers: { ...H, 'content-type': 'image/png' }, body: png });
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).spot.image.file, /\.png$/);
});

test('blocks edits that do not come from the dashboard itself', async () => {
  const noHeader = await fetch(`${base}/api/spots/04`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"name":"Hacked"}' });
  assert.equal(noHeader.status, 403);
  const otherSite = await fetch(`${base}/api/spots/04`, { method: 'PUT', headers: json({ origin: 'https://evil.example' }), body: '{"name":"Hacked"}' });
  assert.equal(otherSite.status, 403);
  assert.equal(store.get('04').name, 'Taj Mahal');
});

test('refuses requests with an unexpected Host header (DNS rebinding)', async () => {
  const r = await raw({ path: '/api/spots', headers: { host: 'evil.example' } });
  assert.equal(r.status, 403);
});

test('cannot read files outside the dashboard folder', async () => {
  const r = await raw({ path: '/..%2f..%2fpackage.json' });
  assert.ok([403, 404].includes(r.status));
  const r2 = await raw({ path: '/files/models/..%2f..%2fspots.json' });
  assert.ok([400, 404].includes(r2.status));
});

test('deleting a spot removes its files', async () => {
  const model = store.get('04').model.file;
  const del = await fetch(`${base}/api/spots/04`, { method: 'DELETE', headers: H });
  assert.equal(del.status, 200);
  assert.ok(!existsSync(path.join(store.modelsDir, model)));
  assert.equal((await fetch(`${base}/api/spots/04`)).status, 404);
});
