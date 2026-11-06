import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStampChain, recordFor } from '../src/stampchain.js';

const CONTRACT = '0x489D88266FF1ED2022B1Abc9F575ca0C9e4f3E19';
function fake() {
  const calls = [];
  const wallet = { writeContract: async (c) => { calls.push(c); return `0xhash${calls.length}`; } };
  const pub = { waitForTransactionReceipt: async () => ({ status: 'success' }), readContract: async () => ['n', 'l', 0n, 0n, true] };
  return { calls, clients: { pub, wallet, owner: '0x138007281281606016bd2cAd2F4De56e862F35b6' } };
}
const spot = (id, name = 'Taj Mahal') => ({ id, name, label: 'TAJMAHAL' });
const ev = { startsAt: '2026-10-16T00:00:00Z', endsAt: '2026-11-07T12:30:00Z' };

test('a spot is written to the contract once, again only when its name or window changes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'chain-')); const { calls, clients } = fake();
  const c = await createStampChain({ dataDir: dir, contract: CONTRACT, clients });
  await c.sync(spot('07'), ev);
  await c.sync(spot('07'), ev);
  assert.equal(calls.length, 1, 'unchanged: no second transaction');
  assert.equal(calls[0].functionName, 'registerSpot');
  assert.equal(calls[0].args[0], 7n, 'the spot id "07" is the number 7 on chain');
  assert.equal(calls[0].args[3], BigInt(Date.parse(ev.startsAt) / 1000));
  await c.sync(spot('07', 'Taj Mahal, Agra'), ev);
  await c.sync(spot('07', 'Taj Mahal, Agra'), { ...ev, endsAt: '2026-12-31T00:00:00Z' });
  assert.equal(calls.length, 3);
  const again = await createStampChain({ dataDir: dir, contract: CONTRACT, clients }); // the ledger survives a restart
  await again.sync(spot('07', 'Taj Mahal, Agra'), { ...ev, endsAt: '2026-12-31T00:00:00Z' });
  assert.equal(calls.length, 3);
  await rm(dir, { recursive: true, force: true });
});
test('a batch registers only what is new, in chunks, and delete closes a spot once', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'chain-')); const { calls, clients } = fake();
  const c = await createStampChain({ dataDir: dir, contract: CONTRACT, clients });
  const items = Array.from({ length: 60 }, (_, i) => ({ spot: spot(String(i + 1)), ev }));
  assert.deepEqual(await c.syncMany(items), { registered: 60, skipped: 0 });
  assert.equal(calls.length, 3, '60 spots go out as 25 + 25 + 10');
  assert.deepEqual(await c.syncMany(items), { registered: 0, skipped: 60 });
  assert.equal(c.count(), 60);
  await c.close('5'); await c.close('5');
  assert.equal(calls.filter((x) => x.functionName === 'closeSpot').length, 1);
  assert.equal(c.count(), 59);
  await rm(dir, { recursive: true, force: true });
});
test('a voucher is submitted as the contract expects it, and nothing is configured without a contract', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'chain-')); const { calls, clients } = fake();
  const c = await createStampChain({ dataDir: dir, contract: CONTRACT, clients });
  const tx = await c.mint({ recipient: '0x00000000000000000000000000000000000A11cE', spotId: '6', nonce: '123', deadline: '4102444800', signature: '0xabcd' });
  assert.equal(tx, 'hash'.length ? calls[0] && '0xhash1' : '');
  assert.equal(calls[0].functionName, 'mint');
  assert.equal(calls[0].args[0].spotId, 6n);
  assert.equal((await createStampChain({ dataDir: dir, contract: '', clients })).enabled, false);
  assert.equal(recordFor({ id: '03', name: 'x'.repeat(100), label: 'y'.repeat(30) }, null).name.length, 60);
  await rm(dir, { recursive: true, force: true });
});
