import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { distanceMeters } from '../src/capture.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const KEY = '0x' + randomBytes(32).toString('hex'); // a throwaway signing key, never a real one
let dir, server, store, base, spot, worldCalls, worldAnswer, clock;
const H = { 'x-requested-with': 'world3-app', 'content-type': 'application/json' };

// stands in for World's verify endpoint, so the tests never touch the network
const fakeWorld = async (url, init) => {
  worldCalls.push({ url, body: JSON.parse(init.body) });
  return { json: async () => worldAnswer };
};

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-capture-'));
  clock = Date.now();
  ({ server, store } = await createApp({
    dataDir: dir,
    publicDir: path.join(here, '..', 'public'),
    capture: { config: { appId: 'app_test', rpId: 'rp_test', signingKey: KEY, environment: 'staging' }, fetchImpl: fakeWorld, now: () => clock },
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  spot = store.list()[0];
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

const post = async (p, body) => {
  const r = await fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const nearPose = (over = {}) => ({ lat: spot.lat, lng: spot.lng, accuracyM: 8, timestamp: clock, ...over });
const proof = (nonce, nullifier = '0xabc123') => ({ protocol_version: '4.0', nonce, action: 'capture', environment: 'staging', responses: [{ identifier: 'proof_of_human', nullifier }] });
const ok = (nullifier = '0xabc123') => ({ success: true, environment: 'staging', nullifier });
async function start(spotId = spot.id) {
  const r = await post('/api/v1/capture/nonce', { spotId });
  assert.equal(r.status, 200);
  return r.body;
}
const attempt = async ({ pose = nearPose(), nullifier, answer = ok(nullifier), skipProof = false } = {}) => {
  worldAnswer = answer;
  const req = await start();
  return post('/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose, idkitResponse: skipProof ? null : proof(req.rp_context.nonce, nullifier) });
};

test('the nonce request returns a signed World ID request for the spot', async () => {
  const r = await start();
  assert.equal(r.app_id, 'app_test');
  assert.equal(r.action, 'capture');
  assert.equal(r.rp_context.rp_id, 'rp_test');
  assert.match(r.rp_context.signature, /^0x[0-9a-f]{130}$/i);
  assert.ok(r.rp_context.expires_at > r.rp_context.created_at);
  assert.equal(JSON.stringify(r).includes(KEY), false, 'the signing key must never leave the server');
});

test('an unknown spot gets no request', async () => {
  const r = await post('/api/v1/capture/nonce', { spotId: '999' });
  assert.equal(r.status, 404);
});

test('a valid capture is accepted and World is asked to verify it server-side', async () => {
  worldCalls = [];
  const r = await attempt({ nullifier: '0x01' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.capture.spotId, spot.id);
  assert.equal(worldCalls.length, 1);
  assert.ok(worldCalls[0].url.endsWith('/api/v4/verify/rp_test'));
  assert.equal(worldCalls[0].body.environment, 'staging');
});

test('refusal: World does not accept the proof -> not_verified, nothing stored', async () => {
  const before = (await import('node:fs')).readFileSync(path.join(dir, 'captures.json'), 'utf8');
  const r = await attempt({ nullifier: '0x02', answer: { success: false, code: 'all_verifications_failed' } });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'not_verified');
  assert.equal((await import('node:fs')).readFileSync(path.join(dir, 'captures.json'), 'utf8'), before);
});

test('refusal: no proof at all -> not_verified, and World is never called', async () => {
  worldCalls = [];
  const r = await attempt({ skipProof: true });
  assert.equal(r.body.code, 'not_verified');
  assert.equal(worldCalls.length, 0);
});

test('refusal: the same human capturing the same spot twice -> already_captured', async () => {
  const first = await attempt({ nullifier: '0xAAAA' });
  assert.equal(first.status, 200);
  const second = await attempt({ nullifier: '0xaaaa' }); // same number, different casing
  assert.equal(second.status, 422);
  assert.equal(second.body.code, 'already_captured');
});

test('a different human can still capture that spot', async () => {
  const r = await attempt({ nullifier: '0xBBBB' });
  assert.equal(r.status, 200);
});

test('a nonce can only be used once', async () => {
  worldAnswer = ok('0x77');
  const req = await start();
  const body = { spotId: spot.id, nonce: req.rp_context.nonce, pose: nearPose(), idkitResponse: proof(req.rp_context.nonce, '0x77') };
  assert.equal((await post('/api/v1/capture/verify', body)).status, 200);
  assert.equal((await post('/api/v1/capture/verify', body)).body.code, 'nonce');
});

test('a nonce issued for one spot cannot capture another', async () => {
  const other = store.list()[1];
  const req = await start(other.id);
  const r = await post('/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose: nearPose(), idkitResponse: proof(req.rp_context.nonce) });
  assert.equal(r.body.code, 'nonce');
});

test('an invented nonce is refused', async () => {
  const r = await post('/api/v1/capture/verify', { spotId: spot.id, nonce: '0x1234', pose: nearPose(), idkitResponse: proof('0x1234') });
  assert.equal(r.body.code, 'nonce');
});

test('refusal: too far away, checked on the server', async () => {
  const r = await attempt({ nullifier: '0x03', pose: nearPose({ lat: spot.lat + 0.01 }) }); // ~1.1 km
  assert.equal(r.body.code, 'too_far');
});

test('refusal: poor accuracy and a stale reading', async () => {
  assert.equal((await attempt({ nullifier: '0x04', pose: nearPose({ accuracyM: 80 }) })).body.code, 'poor_accuracy');
  assert.equal((await attempt({ nullifier: '0x05', pose: nearPose({ timestamp: clock - 10 * 60_000 }) })).body.code, 'stale');
});

test('a malformed pose is a 400, not a crash', async () => {
  const r = await attempt({ nullifier: '0x06', pose: { lat: 'x' } });
  assert.equal(r.status, 400);
});

test('an expired nonce is refused', async () => {
  worldAnswer = ok('0x08');
  const req = await start();
  clock += 10 * 60_000;
  const r = await post('/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose: nearPose({ timestamp: clock }), idkitResponse: proof(req.rp_context.nonce, '0x08') });
  assert.equal(r.body.code, 'nonce');
});

test('capture writes need the app or dashboard header', async () => {
  const r = await fetch(base + '/api/v1/capture/nonce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('distance helper is in metres', () => {
  const d = distanceMeters({ lat: 18.9220, lng: 72.8347 }, { lat: 18.9220, lng: 72.8357 });
  assert.ok(d > 100 && d < 120, String(d));
});
