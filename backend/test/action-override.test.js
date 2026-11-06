import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureConfigFromEnv, createCaptureService } from '../src/capture.js';

test('a spot can be pointed at a fresh World ID action when its own was already used', () => {
  const asked = [];
  const world = { sign: (action) => { asked.push(action); return { action }; } };
  const store = { get: (id) => ({ id, published: true, kind: 'geospatial' }) };
  const config = captureConfigFromEnv({ WORLD_ID_ACTION_OVERRIDES: '{"02":"capture-02b"}' });
  const svc = createCaptureService({ store, captures: {}, world, accounts: {}, voucherSigner: null, config, now: () => 0, gate: () => null });
  svc.issue({ id: 'u1' }, '02');
  svc.issue({ id: 'u1' }, '03');
  assert.deepEqual(asked, ['capture-02b', 'capture-03']); // only the overridden spot changes
  assert.deepEqual(captureConfigFromEnv({ WORLD_ID_ACTION_OVERRIDES: 'not json' }).actionOverrides, {}); // a typo does not break capturing
});
