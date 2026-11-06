import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { checkLabel, createPassports } from '../src/ens/passports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = 'test-seed-never-real';

// An in-memory stand-in for the ENS wallet: same calls, records what happened, can be told to fail.
function fakeEns({ taken = [], gas = 10n ** 18n } = {}) {
  const log = [];
  const f = {
    parent: 'wrld3.eth', log, failNext: null, taken: new Set(taken), written: null, gas,
    async isLabelFree(l) { return !f.taken.has(l); },
    async balance() { return f.gas; },
    async deployResolver(owner) { await f.maybeFail('deployResolver'); log.push(['deployResolver', owner]); return '0x' + '11'.repeat(20); },
    async restrictBackend(r) { await f.maybeFail('restrictBackend'); log.push(['restrictBackend', r]); },
    async registerName({ label, owner }) { await f.maybeFail('registerName'); f.taken.add(label); log.push(['registerName', label, owner]); },
    async setStamps({ name, value }) { await f.maybeFail('setStamps'); f.written = value; log.push(['setStamps', name, value]); },
    async maybeFail(step) { if (f.failNext === step) { f.failNext = null; throw Object.assign(new Error('x'), { shortMessage: 'boom at https://rpc.example/ark_live_SECRET1 now' }); } },
    count: (name) => log.filter((l) => l[0] === name).length,
  };
  return f;
}
const caps = (...pairs) => ({ items: pairs.map(([userId, spotId]) => ({ userId, spotId })) });
async function make(over = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wrld3-pp-'));
  const ens = over.ens ?? fakeEns();
  const captures = over.captures ?? caps(['u1', '06'], ['u1', '05']);
  const svc = await createPassports({ dataDir: dir, ens, ownerSeed: SEED, captures, publicBase: 'https://w3.example/', random: over.random });
  return { svc, ens, captures, dir, done: () => rm(dir, { recursive: true, force: true }) };
}

test('nothing is public until a person asks, and capturing alone publishes nothing', async () => {
  const { svc, ens, done } = await make();
  assert.deepEqual(svc.get('u1'), { status: 'none' });
  svc.onCapture('u1');
  await svc.idle();
  assert.equal(ens.log.length, 0, 'no on-chain action for someone without a passport');
  await done();
});

test('asking creates the name, restricts the backend, and publishes the stamps in order', async () => {
  const { svc, ens, done } = await make();
  const first = await svc.start('u1');
  assert.equal(first.status, 'creating');
  await svc.idle();
  const p = svc.get('u1');
  assert.equal(p.status, 'ready');
  assert.match(p.name, /^[a-z2-9]{6}\.wrld3\.eth$/);
  assert.equal(p.path, `/p/${p.label}`);
  assert.equal(p.url, `https://w3.example/p/${p.label}`);
  assert.equal(p.published, true);
  assert.equal(ens.written, '05,06', 'stamps are sorted by spot');
  assert.deepEqual(ens.log.map((l) => l[0]), ['deployResolver', 'restrictBackend', 'registerName', 'setStamps'], 'the backend is restricted before the name exists');
  await done();
});

test('asking twice never makes two passports', async () => {
  const { svc, ens, done } = await make();
  svc.start('u1'); svc.start('u1'); svc.start('u1');
  await svc.idle();
  svc.start('u1');
  await svc.idle();
  assert.equal(ens.count('deployResolver'), 1);
  assert.equal(ens.count('registerName'), 1);
  await done();
});

test('a new capture is published, an unchanged list costs nothing, and the order stays tidy', async () => {
  const { svc, ens, captures, done } = await make({ captures: caps(['u1', '06']) });
  svc.start('u1'); await svc.idle();
  assert.equal(ens.written, '06');
  captures.items.push({ userId: 'u1', spotId: '02' }, { userId: 'u2', spotId: '99' });
  svc.onCapture('u1'); await svc.idle();
  assert.equal(ens.written, '02,06', "another person's captures never appear");
  const writes = ens.count('setStamps');
  svc.onCapture('u1'); await svc.idle();
  assert.equal(ens.count('setStamps'), writes, 'no transaction when nothing changed');
  await done();
});

test('making it private clears the record, stops publishing, and public again republishes', async () => {
  const { svc, ens, captures, done } = await make();
  svc.start('u1'); await svc.idle();
  svc.setPublic('u1', false); await svc.idle();
  assert.equal(ens.written, '');
  assert.equal(svc.get('u1').published, false);
  captures.items.push({ userId: 'u1', spotId: '01' });
  svc.onCapture('u1'); await svc.idle();
  assert.equal(ens.written, '', 'a private passport publishes nothing, even after a new capture');
  svc.setPublic('u1', true); await svc.idle();
  assert.equal(ens.written, '01,05,06');
  assert.equal(svc.setPublic('nobody', true), null);
  await done();
});

test('a failure part-way resumes where it stopped, with no duplicates and no secrets in the message', async () => {
  const ens = fakeEns();
  const { svc, done } = await make({ ens });
  ens.failNext = 'registerName';
  svc.start('u1'); await svc.idle();
  const failed = svc.get('u1');
  assert.equal(failed.status, 'error');
  assert.equal(failed.error.includes('SECRET1'), false);
  assert.equal(failed.error.includes('https://'), false);
  svc.start('u1'); await svc.idle();
  assert.equal(svc.get('u1').status, 'ready');
  assert.equal(ens.count('deployResolver'), 1, 'the resolver from the first attempt is reused');
  assert.equal(ens.count('registerName'), 1);
  await done();
});

test('a name registered just before a crash is recognised, not registered twice', async () => {
  const ens = fakeEns();
  const { svc, dir, done } = await make({ ens });
  ens.failNext = 'setStamps';
  svc.start('u1'); await svc.idle(); // name registered, then the first publish failed after the name was saved
  assert.equal(ens.count('registerName'), 1);
  assert.equal(svc.get('u1').status, 'ready', 'the passport exists even if the first publish failed');
  svc.onCapture('u1'); await svc.idle();
  assert.equal(ens.written, '05,06', 'the next capture publishes what was missed');
  await done();
});

test('too little gas is reported plainly and nothing is spent', async () => {
  const ens = fakeEns({ gas: 1000n });
  const { svc, done } = await make({ ens });
  svc.start('u1'); await svc.idle();
  assert.equal(svc.get('u1').status, 'error');
  assert.match(svc.get('u1').error, /out of gas/);
  assert.equal(ens.log.length, 0);
  await done();
});

test('a person can choose their own name, within the rules', async () => {
  const { svc, ens, done } = await make();
  await svc.start('u1', 'Anna-Travels');
  await svc.idle();
  assert.equal(svc.get('u1').name, 'anna-travels.wrld3.eth');
  assert.equal(svc.get('u1').status, 'ready');
  assert.deepEqual(ens.log.find((l) => l[0] === 'registerName').slice(0, 2), ['registerName', 'anna-travels']);
  await done();
});

test('bad, reserved and taken names are refused with a reason, and nothing is spent', async () => {
  const { svc, ens, done } = await make({ ens: fakeEns({ taken: ['anna'] }) });
  for (const [label, why] of [['ab', /at least 3/], ['x'.repeat(21), /at most 20/], ['has space', /lowercase letters/], ['-start', /lowercase letters/], ['end-', /lowercase letters/], ['dou--ble', /lowercase letters/], ['émoji', /lowercase letters/], ['wrld3', /reserved/], ['World', /reserved/], ['admin', /reserved/], ['anna', /taken/]]) {
    await assert.rejects(() => svc.start('u1', label), (e) => why.test(e.message), label);
  }
  assert.equal(ens.log.length, 0);
  assert.deepEqual(svc.get('u1'), { status: 'none' }, 'a refused name leaves no half-made passport');
  await done();
});

test('profane names are refused, including disguised ones, and the reason never says which word matched', async () => {
  const { svc, ens, done } = await make();
  for (const label of ['sh1t', 'f-u-c-k', 'annashit', 'b00bs', 'shitty-name', 'fuckyou']) {
    await assert.rejects(() => svc.start('u1', label), (e) => e.message === 'That name is not allowed. Please pick another.', label);
  }
  assert.equal(ens.log.length, 0);
  await done();
});

test('innocent words that merely contain a bad one are still allowed', () => {
  for (const label of ['classic', 'grass', 'assassin', 'scunthorpe', 'analyst', 'therapist', 'anna-travels', 'k7m2qx', 'hello-there']) assert.equal(checkLabel(label).ok, true, label);
});

test('the organizer can block more words, in any language, and they match anywhere in a name', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wrld3-pp-'));
  const svc = await createPassports({ dataDir: dir, ens: fakeEns(), ownerSeed: SEED, captures: caps(), blockedWords: [' Mango ', ''] });
  assert.equal((await svc.available('my-mango-trip')).ok, false);
  assert.equal((await svc.available('MANGO')).ok, false);
  assert.equal((await svc.available('apple-trip')).ok, true);
  await rm(dir, { recursive: true, force: true });
});

test('a random name that happens to be profane is skipped', async () => {
  // 'sh1t' is not a legal 6-character name, so make the first candidate a word the filter rejects: "fuck" + 2 letters
  const seq = [...'fucker'].map((c) => 'abcdefghjkmnpqrstuvwxyz23456789'.indexOf(c));
  let i = 0;
  const { svc, ens, done } = await make({ random: () => ((i < 6 ? (seq[i++] ?? 0) : 7) + 0.1) / 31 });
  await svc.start('u1'); await svc.idle();
  assert.notEqual(svc.get('u1').label, 'fucker');
  assert.equal(svc.get('u1').status, 'ready');
  await done();
});

test('the name check is the same one used while typing, and accepts a pasted full name', async () => {
  const { svc, done } = await make({ ens: fakeEns({ taken: ['anna'] }) });
  assert.deepEqual(await svc.available('Zed-9.wrld3.eth'), { ok: true, label: 'zed-9' });
  assert.equal((await svc.available('anna')).reason, 'That name is taken.');
  assert.equal(checkLabel('a1b').ok, true);
  assert.equal(checkLabel('1-2').ok, true);
  assert.equal(checkLabel('xnfoo').ok, false);
  await done();
});

test('a retry after a failure keeps the name already chosen, whatever is typed the second time', async () => {
  const ens = fakeEns();
  const { svc, done } = await make({ ens });
  ens.failNext = 'registerName';
  await svc.start('u1', 'first-pick'); await svc.idle();
  assert.equal(svc.get('u1').status, 'error');
  await svc.start('u1', 'different'); await svc.idle();
  assert.equal(svc.get('u1').name, 'first-pick.wrld3.eth');
  assert.equal(svc.get('u1').status, 'ready');
  await done();
});

test('a taken name is skipped and another is picked', async () => {
  let n = 0;
  const ens = fakeEns({ taken: ['aaaaaa'] });
  const { svc, done } = await make({ ens, random: () => (n++ < 6 ? 0 : 0.5) }); // first label is "aaaaaa" (taken), then another
  svc.start('u1'); await svc.idle();
  assert.notEqual(svc.get('u1').label, 'aaaaaa');
  assert.equal(svc.get('u1').status, 'ready');
  await done();
});

test('each person gets their own owner address, derived from a secret the server keeps', async () => {
  const { svc, done } = await make();
  assert.match(svc.ownerFor('u1'), /^0x[0-9a-fA-F]{40}$/);
  assert.equal(svc.ownerFor('u1'), svc.ownerFor('u1'));
  assert.notEqual(svc.ownerFor('u1'), svc.ownerFor('u2'));
  svc.start('u1'); await svc.idle();
  assert.equal(JSON.stringify(svc.get('u1')).includes(SEED), false);
  await done();
});

test('state survives a restart', async () => {
  const a = await make();
  a.svc.start('u1'); await a.svc.idle();
  const name = a.svc.get('u1').name;
  const b = await createPassports({ dataDir: a.dir, ens: a.ens, ownerSeed: SEED, captures: a.captures });
  assert.equal(b.get('u1').name, name);
  assert.equal(b.get('u1').status, 'ready');
  await a.done();
});

// ---- through the HTTP API, with a real capture ----------------------------------------------------------------------
let dir, server, store, base, ens, clock, passportsSvc;
const WORLD_KEY = '0x' + randomBytes(32).toString('hex');
let worldAnswer;
const H = { 'x-requested-with': 'wrld3-app', 'content-type': 'application/json' };
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'wrld3-pp-api-'));
  ens = fakeEns(); clock = Date.now();
  ({ server, store, passports: passportsSvc } = await createApp({
    dataDir: dir, publicDir: path.join(here, '..', 'public'),
    capture: { worldConfig: { appId: 'app_t', rpId: 'rp_t', signingKey: WORLD_KEY, environment: 'staging' }, fetchImpl: async () => ({ json: async () => worldAnswer }), now: () => clock },
    ens: { client: ens, ownerSeed: SEED, publicBase: 'https://w3.example' },
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await passportsSvc.idle(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });
const call = async (method, p, body, tok) => { const r = await fetch(base + p, { method, headers: { ...H, ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
const proofFor = (nonce, action, n) => ({ protocol_version: '4.0', nonce, action, environment: 'staging', responses: [{ identifier: 'proof_of_human', nullifier: n }] });
async function signIn(h) { worldAnswer = { success: true, environment: 'staging', nullifier: h }; const r = (await call('POST', '/api/v1/auth/nonce', {})).body; return (await call('POST', '/api/v1/auth/verify', { nonce: r.rp_context.nonce, idkitResponse: proofFor(r.rp_context.nonce, 'signin', h) })).body.token; }
async function capture(tok, h, spot) {
  worldAnswer = { success: true, environment: 'staging', nullifier: h };
  const r = (await call('POST', '/api/v1/capture/nonce', { spotId: spot.id }, tok)).body;
  return call('POST', '/api/v1/capture/verify', { spotId: spot.id, nonce: r.rp_context.nonce, pose: { lat: spot.lat, lng: spot.lng, accuracyM: 5, timestamp: clock }, idkitResponse: proofFor(r.rp_context.nonce, `capture-${spot.id}`, h) }, tok);
}
const settle = async () => { for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 10)); if (ens.log.length && (await call('GET', '/api/v1/passport', null, settle.tok)).body.passport.status !== 'creating') break; } };

test('the passport endpoints need a signed-in person, and they only appear once asked for', async () => {
  assert.equal((await call('GET', '/api/v1/passport')).status, 401);
  assert.equal((await call('POST', '/api/v1/passport')).status, 401);
  const tok = await signIn('0xA1'); settle.tok = tok;
  assert.equal((await call('GET', '/api/v1/passport', null, tok)).body.passport.status, 'none');
  assert.equal((await call('POST', '/api/v1/passport/public', { public: true }, tok)).status, 409, 'no passport yet');
  const spot = store.list()[0];
  await capture(tok, '0xA1', spot);
  assert.equal(ens.log.length, 0, 'a capture alone puts nothing on ENS');
});

test('opting in creates the passport; a later capture is published automatically', async () => {
  const tok = await signIn('0xA1'); settle.tok = tok;
  const started = await call('POST', '/api/v1/passport', null, tok);
  assert.equal(started.status, 202);
  await settle();
  const p = (await call('GET', '/api/v1/passport', null, tok)).body;
  assert.equal(p.passport.status, 'ready');
  assert.equal(p.parent, 'wrld3.eth');
  assert.equal(ens.written, store.list()[0].id, 'the earlier capture is published when the passport is created');
  await capture(tok, '0xA1', store.list()[1]);
  for (let i = 0; i < 50 && ens.written.split(',').length < 2; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(ens.written.split(',').length, 2, 'the new capture was published without the person doing anything');
});

test('a person can fetch their own captures, and only theirs', async () => {
  assert.equal((await call('GET', '/api/v1/me/captures')).status, 401);
  const tok = await signIn('0xA1');
  const mine = (await call('GET', '/api/v1/me/captures', null, tok)).body.captures;
  assert.ok(mine.length >= 2);
  assert.ok(mine.every((c) => c.spotId && c.at) && mine.every((c) => !('nullifier' in c) && !('userId' in c)), 'no identifiers are returned');
  const other = await signIn('0xB2');
  assert.deepEqual((await call('GET', '/api/v1/me/captures', null, other)).body.captures, []);
});

test('the name check and a chosen name work through the API, and a taken name is a 409', async () => {
  const tok = await signIn('0xC3');
  assert.equal((await call('GET', '/api/v1/passport/name?label=anna-api')).status, 401);
  assert.deepEqual((await call('GET', '/api/v1/passport/name?label=anna-api', null, tok)).body, { ok: true, label: 'anna-api' });
  assert.equal((await call('GET', '/api/v1/passport/name?label=wrld3', null, tok)).body.ok, false);
  ens.taken.add('taken-one');
  const clash = await call('POST', '/api/v1/passport', { label: 'taken-one' }, tok);
  assert.equal(clash.status, 409);
  assert.match(clash.body.error, /taken/);
  const ok = await call('POST', '/api/v1/passport', { label: 'anna-api' }, tok);
  assert.equal(ok.status, 202);
  assert.equal(ok.body.passport.name, 'anna-api.wrld3.eth');
  await passportsSvc.idle();
});

test('public must be true or false', async () => {
  const tok = await signIn('0xA1');
  assert.equal((await call('POST', '/api/v1/passport/public', { public: 'yes' }, tok)).status, 400);
  assert.equal((await call('POST', '/api/v1/passport/public', { public: false }, tok)).body.passport.published, false);
});
