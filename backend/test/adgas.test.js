import test from 'node:test';
import assert from 'node:assert/strict';
import { gasForCreative, BLOCK_GAS_LIMIT } from '../src/adgas.js';

// Gas really used by writes on Arkiv Rabdi (1 gwei), measured on 2026-11-07: [bytes, days kept, gas used].
const MEASURED = [
  [40 * 1024, 1, 1_724_784], [40 * 1024, 9, 1_938_989], [40 * 1024, 37, 2_684_329], [40 * 1024, 97, 4_284_812],
  [100 * 1024, 1, 4_213_423], [100 * 1024, 9, 4_723_010],
];

test('the limit always covers what the chain really used, for every measured write', () => {
  for (const [bytes, days, used] of MEASURED) {
    const limit = gasForCreative(bytes, days);
    assert.ok(limit > BigInt(used), `${bytes} bytes for ${days} days: limit ${limit} must exceed ${used}`);
  }
});

test('and it is not wasteful: within 25% of the real cost (only gas used is paid, but a huge limit needs a big balance)', () => {
  for (const [bytes, days, used] of MEASURED) assert.ok(Number(gasForCreative(bytes, days)) < used * 1.25, `${bytes}/${days}`);
});

test('a longer campaign gets a higher limit, and so does a bigger image', () => {
  assert.ok(gasForCreative(40_000, 37) > gasForCreative(40_000, 9));
  assert.ok(gasForCreative(100_000, 9) > gasForCreative(40_000, 9));
});

test('what the sponsor page can ask for (up to 100 KB kept 97 days) stays under one block', () => {
  assert.ok(gasForCreative(100 * 1024, 97) < BLOCK_GAS_LIMIT);
  assert.ok(gasForCreative(10 ** 9, 10_000) < BLOCK_GAS_LIMIT); // nonsense input cannot ask for more than a block either
});

test('odd input still gives a sane number', () => {
  assert.ok(gasForCreative(0, 0) > 0n);
  assert.ok(gasForCreative(undefined, undefined) > 0n);
});
