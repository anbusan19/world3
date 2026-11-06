import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { createArkiv, redact, safeMessage, toEntityValues } from '../src/arkiv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OWNER = '0x00000000000000000000000000000000000a11ce';

// An in-memory stand-in for Arkiv: same call shapes as the SDK clients, nothing touches the network.
function fakeChain() {
  const rows = new Map(); // key -> values
  let n = 0;
  const calls = [];
  const query = () => {
    const q = { _f: {} };
    q.select = () => q;
    q.from = () => q;
    q.ownedBy = () => q;
    q.limit = () => q;
    q.where = (pred) => { q._pred = pred; return q; };
    q.fetch = async () => {
      let found = [...rows].map(([k, v]) => ({ $key: k, $expiresAt: 1565066n, ...Object.fromEntries(Object.entries(v).map(([a, b]) => [a, { type: typeof b, value: b }])) }));
      // evaluate the SDK's real predicate objects: and([...comparisons of name = value])
      const terms = q._pred?.kind === 'and' ? q._pred.expressions : q._pred ? [q._pred] : [];
      for (const t of terms) found = found.filter((e) => e[t.name]?.value === t.value.value);
      return { entities: found };
    };
    return q;
  };
  return {
    rows, calls, owner: OWNER,
    publicClient: query(),
    walletClient: {
      createEntity: async (_s, values, opts) => { const k = `0xkey${++n}`; rows.set(k, { ...values }); calls.push(['create', k, opts]); return { entityKey: k, txHash: `0xtx${n}`, expiresAt: 1565066n }; },
      patchEntity: async (_s, k, { set }) => { rows.set(k, { ...rows.get(k), ...set }); calls.push(['patch', k]); return { txHash: `0xpatch${++n}` }; },
      extendEntity: async ({ entityKey }) => { calls.push(['extend', entityKey]); return { expiresAt: 1565099n }; },
      deleteEntity: async ({ entityKey }) => { rows.delete(entityKey); calls.push(['delete', entityKey]); },
    },
  };
}

const SPOT = { id: '07', name: 'Gateway of India', label: 'GATEWAY', city: 'Mumbai', type: 'LANDMARK', kind: 'geospatial', lat: 18.9220123, lng: 72.8347456, captureRadiusM: 20, approachRadiusM: 100, theme: 'coral', icon: 'business', art: 'gateway', model: null, published: true, onArkiv: true };

test('the public form rounds the location to about 100 m and leaves out everything private', () => {
  const v = toEntityValues({ ...SPOT, model: { file: 'x.glb' }, heightOffsetM: 3, scale: 2, secret: 'x' }, 'evt');
  assert.equal(v.latE3, 18922);
  assert.equal(v.lngE3, 72835);
  assert.equal(v.hasModel, true);
  for (const bad of ['lat', 'lng', 'scale', 'heightOffsetM', 'model', 'secret', 'file']) assert.equal(bad in v, false, `${bad} must not be published`);
  assert.equal(JSON.stringify(v).includes('18.9220123'), false, 'the exact coordinate must not appear');
});

test('without a wallet key the adapter is simply off', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'world3-arkiv-'));
  const a = await createArkiv({ dataDir: dir, config: { eventSlug: 'e', ttlDays: 1 } });
  assert.equal(a.enabled, false);
  await rm(dir, { recursive: true, force: true });
});

test('publishing creates once, then updates and renews instead of duplicating; unpublishing deletes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'world3-arkiv-'));
  const chain = fakeChain();
  const a = await createArkiv({ dataDir: dir, config: { eventSlug: 'evt', ttlDays: 30 }, clients: chain, now: () => 1_800_000_000_000 });
  const first = await a.publish(SPOT);
  assert.equal(first.entityKey, '0xkey1');
  assert.equal(first.expiresOn, '2027-02-14');
  assert.equal(chain.rows.size, 1);
  await a.publish({ ...SPOT, name: 'Gateway (renamed)' });
  assert.equal(chain.rows.size, 1, 'a second publish must not create a second entity');
  assert.deepEqual(chain.calls.map((c) => c[0]), ['create', 'patch', 'extend']);
  assert.equal(chain.rows.get('0xkey1').name, 'Gateway (renamed)');
  assert.equal(a.status('07').entityKey, '0xkey1');
  assert.equal(await a.unpublish('07'), true);
  assert.equal(chain.rows.size, 0);
  assert.equal(a.status('07'), undefined ?? null);
  await rm(dir, { recursive: true, force: true });
});

test('error text never carries the access key or the RPC URL', () => {
  const nasty = new Error('HTTP request failed. URL: https://rpc.rabdi.db-chain.testnet.arkiv.network/ark_live_SECRET123abc Request body: {}');
  assert.equal(redact(nasty.message).includes('SECRET123'), false);
  assert.equal(redact(nasty.message).includes('https://'), false);
  assert.equal(safeMessage({ shortMessage: 'bad: https://x.test/ark_live_ZZZ999' }).includes('ZZZ'), false);
  assert.ok(safeMessage({}).length > 0);
});

test('every write carries an explicit gas limit and writes never overlap', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'world3-arkiv-'));
  const chain = fakeChain();
  let running = 0, overlapped = false;
  for (const k of ['createEntity', 'patchEntity', 'extendEntity', 'deleteEntity']) {
    const f = chain.walletClient[k];
    chain.walletClient[k] = async (...args) => {
      running++; if (running > 1) overlapped = true;
      const last = args[args.length - 1];
      assert.equal(last?.gas, 1_000_000n, `${k} must carry the explicit gas limit`);
      await new Promise((r) => setTimeout(r, 5));
      try { return await f(...args); } finally { running--; }
    };
  }
  const a = await createArkiv({ dataDir: dir, config: { eventSlug: 'evt', ttlDays: 30 }, clients: chain });
  await Promise.all([a.publish(SPOT), a.publish({ ...SPOT, id: '08' }), a.publish(SPOT)]); // three at once, two of them for the same spot
  assert.equal(overlapped, false);
  assert.equal(chain.rows.size, 2, 'the same spot published twice at once must still be one entity');
  await rm(dir, { recursive: true, force: true });
});

// ---- through the dashboard API --------------------------------------------------------------------------------------
let dir, server, store, base, chain;
const H = { 'x-requested-with': 'world3-dashboard', 'content-type': 'application/json' };
const put = async (id, body) => (await fetch(`${base}/api/spots/${id}`, { method: 'PUT', headers: H, body: JSON.stringify(body) })).json();

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'world3-arkiv-api-'));
  chain = fakeChain();
  ({ server, store } = await createApp({ dataDir: dir, publicDir: path.join(here, '..', 'public'), arkiv: { clients: chain, config: { eventSlug: 'evt', ttlDays: 30 } } }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

test('ticking "On Arkiv" on a published spot puts it on Arkiv, and the feed says so', async () => {
  const id = store.list()[0].id;
  const r = await put(id, { onArkiv: true });
  assert.equal(r.arkivError, null);
  assert.ok(r.spot.arkivInfo.entityKey);
  const feed = await (await fetch(`${base}/api/v1/spots`)).json();
  assert.ok(feed.spots.find((s) => s.id === id).arkiv.entityKey);
  assert.equal(chain.rows.size, 1);
});

test('a draft is never listed, even when On Arkiv is ticked', async () => {
  const before = chain.rows.size;
  const id = store.list()[1].id;
  await put(id, { published: false, onArkiv: true });
  assert.equal(chain.rows.size, before);
});

test('unticking it, or unpublishing, takes the spot off Arkiv', async () => {
  const id = store.list()[0].id;
  await put(id, { onArkiv: false });
  assert.equal(chain.rows.size, 0);
});

test('the public Arkiv list never contains exact coordinates', async () => {
  const id = store.list()[2].id;
  await put(id, { onArkiv: true });
  const body = await (await fetch(`${base}/api/v1/arkiv/spots`)).text();
  const spot = store.get(id);
  assert.equal(body.includes(String(spot.lat)), false);
  assert.equal(body.includes(String(spot.lng)), false);
  assert.ok(JSON.parse(body).spots.length >= 1);
});

test('if Arkiv fails, the spot still saves and the dashboard is told why', async () => {
  const id = store.list()[0].id;
  const real = chain.walletClient.createEntity;
  chain.walletClient.createEntity = async () => { throw Object.assign(new Error('out of gas'), { shortMessage: 'out of gas' }); };
  const r = await put(id, { onArkiv: true, name: 'Renamed while Arkiv is down' });
  chain.walletClient.createEntity = real;
  assert.equal(r.spot.name, 'Renamed while Arkiv is down');
  assert.match(r.arkivError, /out of gas/);
});

test('deleting a spot removes it from Arkiv too', async () => {
  const id = store.list()[2].id;
  assert.ok(chain.rows.size >= 1);
  await fetch(`${base}/api/spots/${id}`, { method: 'DELETE', headers: H });
  assert.equal(chain.rows.size, 0);
});
