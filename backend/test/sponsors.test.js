import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { Sponsors } from '../src/sponsors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORG = '0x00000000000000000000000000000000000a11ce';
const ACME = '0x00000000000000000000000000000000000b0b0b';
const NOBODY = '0x00000000000000000000000000000000000dead1';
const H = { 'x-requested-with': 'world3-dashboard', 'content-type': 'application/json' };

// a fake Arkiv whose campaign read returns one row for ACME and nothing for anyone else
const row = { $key: '0xcamp1', $expiresAt: '1565066', spotId: '05', status: 'active', startsAt: '1', endsAt: '9999999999', sponsor: 'Acme', headline: 'Free coffee', clickUrl: 'https://acme.example', mime: 'image/png', width: 640, height: 360, sha256: '0x00' };
function fakeClients() {
  let owner;
  const q = { select: () => q, from: () => q, ownedBy: (o) => { owner = o; return q; }, where: () => q, limit: () => q, fetch: async () => ({ entities: String(owner).toLowerCase() === ACME ? [{ ...row }] : [] }) };
  return { owner: ORG, publicClient: q, walletClient: {} };
}

let dir, server, store, base, sponsors;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-sponsors-'));
  ({ server, store, sponsors } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public'), arkiv: { clients: fakeClients(), config: { eventSlug: 'evt', ttlDays: 30 }, sponsors: [] } }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});
const j = async (p, init) => { const r = await fetch(base + p, init); return { status: r.status, body: await r.json() }; };

test('the store accepts real addresses only, in any case, and approvals apply immediately', async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'world3-sp-'));
  const s = new Sponsors(d, [NOBODY]);
  await s.init();
  await assert.rejects(() => s.add('0x123', 'x'), /not a wallet address/);
  await s.add(ACME.toUpperCase().replace('0X', '0x'), 'Acme');
  assert.ok(s.isApproved(ACME));
  assert.ok(s.isApproved(NOBODY), 'an address from the environment counts');
  assert.equal(s.isApproved('0x0000000000000000000000000000000000000001'), false);
  assert.equal(await s.remove(ACME), true);
  assert.equal(s.isApproved(ACME), false);
  const again = new Sponsors(d); await again.init(); // survives a restart
  assert.equal(again.list().length, 0);
  await rm(d, { recursive: true, force: true });
});

test('the advertiser page can read the event, the spots to choose from, and whether its wallet is approved', async () => {
  const anon = await j('/api/v1/sponsors/info');
  assert.equal(anon.body.eventSlug, 'evt');
  assert.equal(anon.body.approved, null);
  assert.ok(anon.body.spots.length >= 1);
  assert.ok(anon.body.spots.every((s) => s.id && s.name), 'only published spots, with a name');
  assert.equal((await j(`/api/v1/sponsors/info?address=${ACME}`)).body.approved, false);
  assert.equal((await j(`/api/v1/sponsors/info?address=${ORG}`)).body.approved, true, 'the organizer wallet is always approved');
});

test('only the organizer dashboard can approve a sponsor, and it takes effect at once', async () => {
  const noHeader = await fetch(`${base}/api/sponsors`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: ACME }) });
  assert.equal(noHeader.status, 403);
  const bad = await j('/api/sponsors', { method: 'POST', headers: H, body: JSON.stringify({ address: 'nope' }) });
  assert.equal(bad.status, 400);
  const ok = await j('/api/sponsors', { method: 'POST', headers: H, body: JSON.stringify({ address: ACME, name: 'Acme Coffee' }) });
  assert.equal(ok.status, 201);
  assert.equal((await j(`/api/v1/sponsors/info?address=${ACME}`)).body.approved, true);
  const list = await j('/api/sponsors');
  assert.equal(list.body.sponsors[0].name, 'Acme Coffee');
  assert.equal(list.body.sponsors[0].campaigns, 1);
});

test('a sponsor sees their own campaigns; before approval they are told they are waiting', async () => {
  await j(`/api/sponsors/${ACME}`, { method: 'DELETE', headers: H });
  const waiting = await j(`/api/v1/sponsors/campaigns?owner=${ACME}`);
  assert.equal(waiting.body.approved, false);
  assert.equal(waiting.body.campaigns[0].shown, false);
  assert.match(waiting.body.campaigns[0].reason, /approve/);
  await j('/api/sponsors', { method: 'POST', headers: H, body: JSON.stringify({ address: ACME }) });
  const approved = await j(`/api/v1/sponsors/campaigns?owner=${ACME}`);
  assert.equal(approved.body.approved, true);
  assert.equal(approved.body.campaigns[0].headline, 'Free coffee');
  assert.equal('creative' in approved.body.campaigns[0], false, 'the list never carries the image bytes');
});

test('a wallet with no campaigns gets an empty list, and a malformed owner is a 400', async () => {
  assert.deepEqual((await j(`/api/v1/sponsors/campaigns?owner=${NOBODY}`)).body.campaigns, []);
  assert.equal((await j('/api/v1/sponsors/campaigns?owner=bogus')).status, 400);
  assert.equal((await j('/api/v1/sponsors/campaigns')).status, 400);
});

test('removing a sponsor stops their ads from being eligible straight away', async () => {
  await j(`/api/sponsors/${ACME}`, { method: 'DELETE', headers: H });
  assert.equal((await j(`/api/v1/sponsors/info?address=${ACME}`)).body.approved, false);
});

test('open mode approves wallets that show up, up to a cap, and can be switched off', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sp-'));
  const sp = new Sponsors(dir); await sp.init();
  sp.openMax = 2;
  const w = (n) => '0x' + String(n).repeat(40);
  assert.equal(await sp.autoAdd(w(1)), false); // closed by default
  await sp.setOpen(true);
  assert.equal(await sp.autoAdd(w(1)), true);
  assert.equal(await sp.autoAdd(w(1)), true); // already approved, not counted twice
  assert.equal(await sp.autoAdd(w(2)), true);
  assert.equal(await sp.autoAdd(w(3)), false); // cap reached
  assert.equal(await sp.autoAdd('nope'), false);
  const again = new Sponsors(dir); await again.init(); // survives a restart
  assert.equal(again.isOpen(), true);
  assert.ok(again.isApproved(w(2)));
  await sp.setOpen(false);
  assert.equal(await sp.autoAdd(w(4)), false);
});
