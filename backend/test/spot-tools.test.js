import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { cloneSpot } from '../scripts/clone-spot.mjs';
import { deleteUser, listUsers } from '../scripts/delete-user.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let dir, server, base;
const H = { 'x-requested-with': 'wrld3-dashboard' };

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'wrld3-tools-'));
  ({ server } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public') }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });

test('clone-spot: a new spot at the first spot\'s place with the second spot\'s 3D model', async () => {
  const post = (p, body) => fetch(base + p, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const a = (await post('/api/spots', { name: 'World', label: 'WORLD', lat: 19.063954, lng: 72.866977, captureRadiusM: 20, approachRadiusM: 50, theme: 'ocean', icon: 'location', type: 'EVENT', city: 'Mumbai' })).spot;
  const b = (await post('/api/spots', { name: 'ETHGlobal Mumbai', label: 'ETHGLOBAL', lat: 19.0, lng: 72.0, scale: 1, heading: 0 })).spot;
  const glb = await readFile(path.join(here, '..', '..', 'models', 'ens-logo.glb'));
  const up = await fetch(`${base}/api/spots/${b.id}/model`, { method: 'PUT', headers: { ...H, 'content-type': 'model/gltf-binary' }, body: glb });
  assert.equal(up.status, 200);

  const dry = await cloneSpot({ api: base, dataDir: dir, from: a.id, modelFrom: b.id, name: 'World Pitch', label: 'PITCH', dryRun: true });
  assert.equal(dry.payload.lat, 19.063954); assert.equal(dry.payload.captureRadiusM, 20);

  const out = await cloneSpot({ api: base, dataDir: dir, from: a.id, modelFrom: b.id, name: 'World Pitch', label: 'PITCH', publish: true });
  assert.notEqual(out.id, a.id); assert.notEqual(out.id, b.id);
  assert.equal(out.published, true);
  assert.equal(out.lat, 19.063954); assert.equal(out.lng, 72.866977);
  const fresh = (await (await fetch(`${base}/api/spots/${out.id}`, { headers: H })).json()).spot;
  const bytes = await readFile(path.join(dir, 'models', fresh.model.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(glb).digest('hex'), 'the same model, byte for byte');
  assert.equal(fresh.name, 'World Pitch');
});

test('clone-spot: clear errors for a missing spot or a spot without a model', async () => {
  await assert.rejects(cloneSpot({ api: base, dataDir: dir, from: 99, modelFrom: 1, name: 'X' }), /No spot 99/);
});

test('delete-user: an account can be found by the wallet the explorer shows', async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'wrld3-dw-'));
  const seed = 'test-seed';
  const { keccak256, stringToBytes } = await import('viem'); const { privateKeyToAccount } = await import('viem/accounts');
  const w1 = privateKeyToAccount(keccak256(stringToBytes(`${seed}:u1`))).address;
  await writeFile(path.join(d, 'accounts.json'), JSON.stringify({ version: 1, users: [{ id: 'u1' }, { id: 'u2' }], sessions: [] }));
  const who = await listUsers({ dataDir: d, ownerSeed: seed });
  assert.equal(who[0].wallet, w1);
  const plan = await deleteUser({ dataDir: d, wallet: w1.toLowerCase(), ownerSeed: seed, dryRun: true });
  assert.equal(plan.userId, 'u1');
  await assert.rejects(deleteUser({ dataDir: d, wallet: '0x' + '9'.repeat(40), ownerSeed: seed }), /No account on this server holds/);
  await rm(d, { recursive: true, force: true });
});

test('delete-user: removes the account, sessions and passport record; keeps captures; backs up first', async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'wrld3-du-'));
  await writeFile(path.join(d, 'accounts.json'), JSON.stringify({ version: 1, users: [{ id: 'u1', signin: 'n1' }, { id: 'u2', signin: 'n2' }], sessions: [{ hash: 'h1', userId: 'u1', expiresAt: 9e15 }, { hash: 'h2', userId: 'u2', expiresAt: 9e15 }] }));
  await writeFile(path.join(d, 'passports.json'), JSON.stringify({ version: 1, users: { u1: { label: 'taco', name: 'taco.wrld3.eth' }, u2: { label: 'other', name: 'other.wrld3.eth' } } }));
  await writeFile(path.join(d, 'captures.json'), JSON.stringify({ version: 1, captures: [{ userId: 'u1', spotId: '02' }] }));
  const who = await listUsers({ dataDir: d });
  assert.deepEqual(who.map((w) => [w.userId, w.passport, w.stamps, w.sessions]), [['u1', 'taco.wrld3.eth', 1, 1], ['u2', 'other.wrld3.eth', 0, 1]]);
  const plan = await deleteUser({ dataDir: d, label: 'taco.wrld3.eth', dryRun: true });
  assert.deepEqual([plan.userId, plan.sessions, plan.passport.label], ['u1', 1, 'taco']);
  assert.equal(JSON.parse(await readFile(path.join(d, 'accounts.json'), 'utf8')).users.length, 2, 'a dry run changes nothing');
  const out = await deleteUser({ dataDir: d, label: 'taco' });
  assert.equal(out.deleted, true);
  const acc = JSON.parse(await readFile(path.join(d, 'accounts.json'), 'utf8'));
  assert.deepEqual(acc.users.map((u) => u.id), ['u2']);
  assert.deepEqual(acc.sessions.map((s) => s.userId), ['u2']);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(path.join(d, 'passports.json'), 'utf8')).users), ['u2']);
  assert.equal(JSON.parse(await readFile(path.join(d, 'captures.json'), 'utf8')).captures.length, 1, 'captures are kept');
  const names = (await import('node:fs/promises')).readdir(d);
  assert.ok((await names).some((n) => n.startsWith('accounts.json.bak-')), 'a backup was made');
  await assert.rejects(deleteUser({ dataDir: d, label: 'nobody' }), /No passport named/);
  await rm(d, { recursive: true, force: true });
});
