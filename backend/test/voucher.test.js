import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAddress, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { VOUCHER_TYPES, createVoucherSigner, domainFor } from '../src/voucher.js';

const KEY = '0x' + '22'.repeat(32); // a throwaway test key
const CONTRACT = '0x00000000000000000000000000000000000057a4';
const ALICE = '0x00000000000000000000000000000000000a11ce';
const make = (over = {}) => createVoucherSigner({ privateKey: KEY, chainId: 11155111, contract: CONTRACT, now: () => 1_800_000_000_000, ...over });

const recover = (v, over = {}) =>
  recoverTypedDataAddress({
    domain: domainFor({ chainId: over.chainId ?? v.chainId, verifyingContract: over.contract ?? v.contract, contract: over.contract ?? v.contract }),
    types: VOUCHER_TYPES,
    primaryType: 'Voucher',
    message: { recipient: v.recipient, spotId: BigInt(v.spotId), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) },
    signature: v.signature,
  });

test('a voucher is signed by the backend key and bound to the recipient, spot, nonce and deadline', async () => {
  const s = make();
  const v = await s.sign({ recipient: ALICE, spotId: '06' });
  assert.equal(v.spotId, '6'); // "06" in the app is token 6 on chain
  assert.equal(v.recipient, getAddress(ALICE));
  assert.equal(v.deadline, String(1_800_000_000 + 7 * 24 * 3600));
  assert.equal(await recover(v), privateKeyToAccount(KEY).address);
});

test('every voucher gets a fresh 256-bit nonce, returned as a string', async () => {
  const s = make();
  const a = await s.sign({ recipient: ALICE, spotId: 1 });
  const b = await s.sign({ recipient: ALICE, spotId: 1 });
  assert.notEqual(a.nonce, b.nonce);
  assert.match(a.nonce, /^\d+$/);
});

test('a signature does not verify for another chain or another contract', async () => {
  const v = await make().sign({ recipient: ALICE, spotId: 1 });
  assert.notEqual(await recover(v, { chainId: 1 }), privateKeyToAccount(KEY).address);
  assert.notEqual(await recover(v, { contract: '0x00000000000000000000000000000000000000bb' }), privateKeyToAccount(KEY).address);
});

test('a malformed or mistyped address is refused', async () => {
  const s = make();
  await assert.rejects(() => s.sign({ recipient: '0x123', spotId: 1 }));
  await assert.rejects(() => s.sign({ recipient: '0x00000000000000000000000000000000000A11CE', spotId: 1 }), /not an address/); // wrong checksum casing
});

test('with no key or contract configured, no signer exists (captures just do not get a voucher)', () => {
  assert.equal(createVoucherSigner({ chainId: 1 }), null);
  assert.equal(createVoucherSigner({ privateKey: KEY, chainId: 1 }), null);
});
