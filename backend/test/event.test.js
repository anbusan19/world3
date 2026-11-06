import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { EventClock } from '../src/event.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const H = { 'x-requested-with': 'world3-dashboard', 'content-type': 'application/json' };

test('the clock says when the event is over, can be moved, can have no end, and survives a restart', async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'world3-ev-'));
  const c = new EventClock(d, { endsAt: '2026-11-07T12:30:00Z' });
  await c.init();
  assert.equal(c.over(Date.parse('2026-11-07T12:29:59Z')), false);
  assert.equal(c.over(Date.parse('2026-11-07T12:30:00Z')), true);
  await c.set({ endsAt: '2026-11-08T00:00:00Z' });
  assert.equal(c.over(Date.parse('2026-11-07T13:00:00Z')), false);
  await assert.rejects(() => c.set({ endsAt: 'not a date' }), /valid date/);
  const again = new EventClock(d); await again.init();
  assert.equal(again.endsAt, '2026-11-08T00:00:00.000Z');
  await again.set({ endsAt: null });
  assert.equal(again.over(Date.parse('2030-01-01')), false, 'no end time means no end');
  await rm(d, { recursive: true, force: true });
});

let dir, server, base, clock;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-event-'));
  clock = { t: Date.parse('2026-11-06T10:00:00Z') };
  ({ server } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public'), capture: { now: () => clock.t, event: { endsAt: '2026-11-07T12:30:00Z' } } }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); });
const j = async (p, init) => { const r = await fetch(base + p, init); return { status: r.status, body: await r.json() }; };

test('before the end the app gets the spots; after it the feed is empty and capture is refused', async () => {
  const before = await j('/api/v1/spots');
  assert.ok(before.body.spots.length >= 1);
  assert.equal(before.body.event.over, false);
  clock.t = Date.parse('2026-11-07T12:30:01Z');
  const after = await j('/api/v1/spots');
  assert.equal(after.body.spots.length, 0, 'the spots disappear for users');
  assert.equal(after.body.event.over, true);
  const nonce = await j('/api/v1/capture/nonce', { method: 'POST', headers: H, body: JSON.stringify({ spotId: '01' }) });
  assert.equal(nonce.status, 410);
  assert.equal(nonce.body.code ?? 'event_over', 'event_over');
  const verify = await j('/api/v1/capture/verify', { method: 'POST', headers: H, body: '{}' });
  assert.equal(verify.status, 410);
});

test('the organizer can move the end time and the spots come back', async () => {
  const moved = await j('/api/event', { method: 'PUT', headers: H, body: JSON.stringify({ endsAt: '2026-11-08T12:30:00Z' }) });
  assert.equal(moved.body.over, false);
  assert.ok((await j('/api/v1/spots')).body.spots.length >= 1);
  assert.equal((await j('/api/event', { method: 'PUT', headers: H, body: JSON.stringify({ endsAt: 'garbage' }) })).status, 400);
});
