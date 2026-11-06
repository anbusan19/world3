import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFaucet } from '../src/faucet.js';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const C = '0x' + 'c'.repeat(40);
const cfg = { amount: 5n * 10n ** 16n, dailyCap: 10n ** 17n, cooldownMs: 86_400_000 };
async function make(over = {}) {
  const sent = [];
  let t = 1_000_000;
  const chain = { send: async (to, v) => { sent.push([to, v]); return '0xtx' + sent.length; }, balanceOf: async () => 0n, ownBalance: async () => 10n ** 19n, ...over };
  const f = await createFaucet({ dataDir: await mkdtemp(path.join(os.tmpdir(), 'faucet-')), chain, config: cfg, now: () => t });
  return { f, sent, tick: (ms) => { t += ms; } };
}

test('sends a small drip once per wallet and per network address per day', async () => {
  const { f, sent, tick } = await make();
  const r = await f.drip(A, '1.1.1.1');
  assert.equal(r.tx, '0xtx1');
  assert.equal(sent.length, 1);
  await assert.rejects(f.drip(A, '2.2.2.2'), /already got tGLM/); // same wallet
  await assert.rejects(f.drip(B, '1.1.1.1'), /network already/); // same network address
  tick(86_400_001);
  assert.equal((await f.drip(A, '1.1.1.1')).tx, '0xtx2'); // next day it works again
});
test('refuses bad addresses, wallets that have enough, an empty faucet and the daily cap', async () => {
  await assert.rejects((await make()).f.drip('nope'), /not a wallet address/);
  await assert.rejects((await make({ balanceOf: async () => 10n ** 18n })).f.drip(A), /already has enough/);
  await assert.rejects((await make({ ownBalance: async () => 0n })).f.drip(A), /empty/);
  const { f } = await make();
  await f.drip(A, '1.1.1.1'); await f.drip(B, '2.2.2.2'); // 2 x 0.05 = the 0.1 cap
  await assert.rejects(f.drip(C, '3.3.3.3'), /out of tGLM for today/);
});
test('a failed send is not counted against the wallet', async () => {
  let fail = true;
  const { f } = await make({ send: async () => { if (fail) throw new Error('rpc down'); return '0xok'; } });
  await assert.rejects(f.drip(A, '1.1.1.1'), /rpc down/);
  fail = false;
  assert.equal((await f.drip(A, '1.1.1.1')).tx, '0xok');
});
