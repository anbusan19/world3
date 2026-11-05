import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/app.js';
import { VOUCHER_TYPES, domainFor } from '../src/voucher.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORLD_KEY = '0x' + randomBytes(32).toString('hex');
const VOUCHER_KEY = '0x' + randomBytes(32).toString('hex');
const CONTRACT = '0x00000000000000000000000000000000000057a4';
const ALICE = '0x00000000000000000000000000000000000a11ce';
let dir, server, store, base, spot, worldAnswer, clock;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-voucher-'));
  clock = Date.now();
  ({ server, store } = await createApp({
    dataDir: dir,
    publicDir: path.join(here, '..', 'public'),
    capture: {
      worldConfig: { appId: 'app_test', rpId: 'rp_test', signingKey: WORLD_KEY, environment: 'staging' },
      voucher: { privateKey: VOUCHER_KEY, chainId: 11155111, contract: CONTRACT },
      fetchImpl: async () => ({ json: async () => worldAnswer }),
      now: () => clock,
    },
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  spot = store.list()[0];
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

const call = async (method, p, body, tok) => {
  const r = await fetch(base + p, { method, headers: { 'x-requested-with': 'world3-app', 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const proofFor = (nonce, action, nullifier) => ({ protocol_version: '4.0', nonce, action, environment: 'staging', responses: [{ identifier: 'proof_of_human', nullifier }] });
async function signIn(human) {
  worldAnswer = { success: true, environment: 'staging', nullifier: human };
  const req = (await call('POST', '/api/v1/auth/nonce', {})).body;
  return (await call('POST', '/api/v1/auth/verify', { nonce: req.rp_context.nonce, idkitResponse: proofFor(req.rp_context.nonce, 'signin', human) })).body.token;
}
const pose = () => ({ lat: spot.lat, lng: spot.lng, accuracyM: 5, timestamp: clock });
async function capture(tok, human, extra = {}) {
  worldAnswer = { success: true, environment: 'staging', nullifier: human };
  const req = (await call('POST', '/api/v1/capture/nonce', { spotId: spot.id }, tok)).body;
  return call('POST', '/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose: pose(), idkitResponse: proofFor(req.rp_context.nonce, `capture-${spot.id}`, human), ...extra }, tok);
}

test('an accepted capture returns a voucher signed for that wallet and spot', async () => {
  const tok = await signIn('0x1');
  const r = await capture(tok, '0x1', { recipient: ALICE });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const v = r.body.capture.voucher;
  assert.equal(v.spotId, String(Number(spot.id)));
  assert.equal(v.contract, '0x00000000000000000000000000000000000057A4');
  const who = await recoverTypedDataAddress({
    domain: domainFor({ chainId: v.chainId, contract: v.contract }),
    types: VOUCHER_TYPES,
    primaryType: 'Voucher',
    message: { recipient: v.recipient, spotId: BigInt(v.spotId), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) },
    signature: v.signature,
  });
  assert.equal(who, privateKeyToAccount(VOUCHER_KEY).address);
});

test('the person can fetch their own vouchers again, and only theirs', async () => {
  const tok = await signIn('0x1');
  const mine = await call('GET', '/api/v1/vouchers', null, tok);
  assert.equal(mine.body.vouchers.length, 1);
  assert.equal(mine.body.chainId, 11155111);
  const other = await signIn('0x2');
  assert.equal((await call('GET', '/api/v1/vouchers', null, other)).body.vouchers.length, 0);
  assert.equal((await call('GET', '/api/v1/vouchers')).status, 401);
});

test('a missing or mistyped wallet address is refused up front, and the request is not burned', async () => {
  const tok = await signIn('0x3');
  worldAnswer = { success: true, environment: 'staging', nullifier: '0x3' };
  const req = (await call('POST', '/api/v1/capture/nonce', { spotId: spot.id }, tok)).body;
  const body = { spotId: spot.id, nonce: req.rp_context.nonce, pose: pose(), idkitResponse: proofFor(req.rp_context.nonce, `capture-${spot.id}`, '0x3') };
  const bad = await call('POST', '/api/v1/capture/verify', { ...body, recipient: '0xnope' }, tok);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'bad_recipient');
  const good = await call('POST', '/api/v1/capture/verify', { ...body, recipient: ALICE }, tok); // the same request still works
  assert.equal(good.status, 200);
});

test('a refused capture issues no voucher', async () => {
  const tok = await signIn('0x4');
  worldAnswer = { success: false };
  const req = (await call('POST', '/api/v1/capture/nonce', { spotId: spot.id }, tok)).body;
  const r = await call('POST', '/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose: pose(), idkitResponse: proofFor(req.rp_context.nonce, `capture-${spot.id}`, '0x4'), recipient: ALICE }, tok);
  assert.equal(r.body.code, 'not_verified');
  assert.equal(r.body.capture, undefined);
  assert.equal((await call('GET', '/api/v1/vouchers', null, tok)).body.vouchers.length, 0);
});
