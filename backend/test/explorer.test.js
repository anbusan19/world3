import test from 'node:test';
import assert from 'node:assert/strict';
import { explore } from '../src/explorer.js';

const spots = [{ id: '01', name: 'Gateway of India', city: 'Mumbai', label: 'GATEWAY', theme: 'coral' }, { id: '02', name: 'ETHGlobal Mumbai', city: 'Mumbai', label: 'ETHGLOBAL', theme: 'sky' }];
const caps = [
  { spotId: '01', userId: 'u_a', at: '2026-11-05T10:00:00Z' },
  { spotId: '02', userId: 'u_b', at: '2026-11-05T12:00:00Z' },
  { spotId: '99', userId: 'u_c', at: '2026-11-05T13:00:00Z' }, // spot no longer public: hidden
];

test('explorer lists newest first, hides unknown spots and never shows user ids', () => {
  const r = explore({ captures: caps, spots }, { limit: 10 });
  assert.equal(r.total, 2);
  assert.deepEqual(r.items.map((i) => i.spotId), ['02', '01']);
  assert.match(r.items[0].who, /^human-[0-9a-f]{4}$/);
  assert.ok(!JSON.stringify(r).includes('u_b'));
});
test('people are shown by wallet address (never an ENS name); search matches the address', () => {
  const W = '0x' + 'ab12'.repeat(10);
  const walletOf = (id) => (id === 'u_a' ? W : null);
  const r = explore({ captures: caps, spots, walletOf }, {});
  const a = r.items.find((i) => i.spotId === '01');
  assert.equal(a.who, `${W.slice(0, 6)}…${W.slice(-4)}`);
  assert.equal(a.wallet, W);
  assert.ok(!JSON.stringify(r).includes('.eth'));
  assert.match(r.items.find((i) => i.spotId === '02').who, /^human-/); // no wallet known: anonymous handle
  assert.equal(explore({ captures: caps, spots, walletOf }, { q: 'ab12ab' }).total, 1);
  assert.equal(explore({ captures: caps, spots }, { q: 'gateway' }).total, 1);
  assert.equal(explore({ captures: caps, spots }, { spotId: '02' }).total, 1);
  assert.equal(explore({ captures: caps, spots }, { limit: 1, offset: 1 }).items.length, 1);
});
