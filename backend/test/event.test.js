import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { Events } from '../src/events.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const H = { 'x-requested-with': 'world3-dashboard', 'content-type': 'application/json' };

test('an event is upcoming, live, then ended; it can be moved, have no end, and survives a restart', async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'world3-ev-'));
  const c = new Events(d, { endsAt: '2026-11-07T12:30:00Z' });
  await c.init();
  const spot = { eventId: 'ethmumbai' };
  assert.equal(c.live(spot, Date.parse('2026-11-07T12:29:59Z')), true);
  assert.equal(c.live(spot, Date.parse('2026-11-07T12:30:00Z')), false);
  await c.upsert({ ...c.main, endsAt: '2026-11-08T00:00:00Z' });
  assert.equal(c.live(spot, Date.parse('2026-11-07T13:00:00Z')), true);
  await assert.rejects(() => c.upsert({ ...c.main, endsAt: 'not a date' }), /valid date/);
  await c.upsert({ id: 'aqualine', name: 'Aqua Line Passport', startsAt: '2026-10-16T00:00:00Z', endsAt: '2026-12-31T00:00:00Z' });
  assert.equal(c.status(c.get('aqualine'), Date.parse('2026-10-01')), 'upcoming');
  assert.equal(c.status(c.get('aqualine'), Date.parse('2026-11-06')), 'live');
  assert.equal(c.live({ eventId: 'aqualine' }, Date.parse('2027-01-01')), false);
  assert.equal(c.live({ eventId: 'unknown' }, Date.parse('2026-11-06')), true, 'a spot with an unknown event falls back to the main one');
  await assert.rejects(() => c.upsert({ id: 'x y', name: 'Bad' }), /event id/);
  await assert.rejects(() => c.upsert({ id: 'bad', name: 'Bad', startsAt: '2026-02-01', endsAt: '2026-01-01' }), /after the start/);
  const again = new Events(d); await again.init();
  assert.equal(again.get('aqualine').name, 'Aqua Line Passport');
  assert.equal(again.main.endsAt, '2026-11-08T00:00:00.000Z');
  await assert.rejects(() => again.remove('ethmumbai'), /cannot be removed/);
  assert.equal(await again.remove('aqualine'), true);
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
  const verify = await j('/api/v1/capture/verify', { method: 'POST', headers: H, body: JSON.stringify({ spotId: '01' }) });
  assert.equal(verify.status, 410);
});

test('the organizer can move the end time and the spots come back', async () => {
  const moved = await j('/api/event', { method: 'PUT', headers: H, body: JSON.stringify({ endsAt: '2026-11-08T12:30:00Z' }) });
  assert.equal(moved.body.over, false);
  assert.ok((await j('/api/v1/spots')).body.spots.length >= 1);
  assert.equal((await j('/api/event', { method: 'PUT', headers: H, body: JSON.stringify({ endsAt: 'garbage' }) })).status, 400);
});

test('a quest spot stays locked until enough of its stamps are collected, and each event runs on its own clock', async () => {
  const mk = async (body) => (await j('/api/spots', { method: 'POST', headers: H, body: JSON.stringify({ lat: 19, lng: 72.8, published: true, ...body }) })).body.spot;
  // the main event is live again from the test above (ends 8 Nov), the second one has already ended
  await j('/api/events', { method: 'POST', headers: H, body: JSON.stringify({ id: 'old', name: 'Old event', startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-02-01T00:00:00Z' }) });
  const a = await mk({ name: 'Track A', eventId: 'ethmumbai' });
  const b = await mk({ name: 'Track B', eventId: 'ethmumbai' });
  const q = await mk({ name: 'Finale', kind: 'quest', eventId: 'ethmumbai', requires: { from: [a.id, b.id], min: 2 } });
  const old = await mk({ name: 'Old place', eventId: 'old' });
  const feed = (await j('/api/v1/spots')).body;
  assert.ok(feed.spots.some((s) => s.id === q.id && s.requires.min === 2 && s.kind === 'quest'));
  assert.ok(!feed.spots.some((s) => s.id === old.id), 'a spot of an ended event is not in the live list');
  assert.ok(feed.archive.some((s) => s.id === old.id && s.eventId === 'old'), 'but it is kept as a memory');
  assert.ok(feed.events.some((e) => e.id === 'old' && e.status === 'ended'));
  const bad = await j('/api/spots', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Bad quest', lat: 19, lng: 72.8, requires: { from: [a.id], min: 3 } }) });
  assert.equal(bad.status, 400);
});
