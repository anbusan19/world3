import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld } from '../src/world.js';

const cfg = { appId: 'app_x', rpId: 'rp_x', signingKey: '0x' + '11'.repeat(32), environment: 'production' };
const okFetch = async () => ({ json: async () => ({ success: true, environment: 'production', nullifier: '123' }) });
const proof = (nonce, identifier) => ({ protocol_version: '4.0', nonce, action: 'signin', environment: 'production', responses: [{ identifier, nullifier: '123' }] });

test('an Orb, passport, national ID or selfie proof signs in; a credential we do not accept does not', async () => {
  const world = createWorld({ config: cfg, fetchImpl: okFetch });
  for (const id of ['proof_of_human', 'passport', 'mnc', 'selfie']) {
    const req = world.sign('signin', {});
    assert.equal(await world.verifyProof(proof(req.rp_context.nonce, id), req.rp_context.nonce, 'signin'), '123', id);
  }
  const req = world.sign('signin', {});
  await assert.rejects(() => world.verifyProof(proof(req.rp_context.nonce, 'device'), req.rp_context.nonce, 'signin'), /not_verified|verif/i);
});

test('the strictest setting accepts the Orb credential only', async () => {
  const world = createWorld({ config: { ...cfg, credentials: ['proof_of_human'] }, fetchImpl: okFetch });
  const a = world.sign('signin', {});
  assert.equal(await world.verifyProof(proof(a.rp_context.nonce, 'proof_of_human'), a.rp_context.nonce, 'signin'), '123');
  const b = world.sign('signin', {});
  await assert.rejects(() => world.verifyProof(proof(b.rp_context.nonce, 'passport'), b.rp_context.nonce, 'signin'));
});
