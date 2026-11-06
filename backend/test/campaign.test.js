import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAds } from '../src/ads.js';
import { CampaignError, LIMITS, campaignValues, checkClickUrl, inspectImage, sha256Hex } from '../src/campaign.js';

// tiny files with real headers (enough for the checks, which read type and size from the bytes themselves)
const pad = (b, n = 40) => Buffer.concat([b, Buffer.alloc(Math.max(0, n - b.length))]);
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const gif = (w, h) => { const b = Buffer.alloc(30); b.write('GIF89a', 0, 'ascii'); b.writeUInt16LE(w, 6); b.writeUInt16LE(h, 8); return b; };
const jpeg = (w, h) => { const b = Buffer.alloc(40); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4); b[6] = 8; b.writeUInt16BE(h, 7); b.writeUInt16BE(w, 9); return b; };
const webp = (w, h) => { const b = Buffer.alloc(40); b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii'); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };

const OWNER = '0x00000000000000000000000000000000000a11ce';
const SPONSOR = '0x00000000000000000000000000000000000b0b0b';
const STRANGER = '0x00000000000000000000000000000000000dEaD1';
const T0 = 1_800_000_000; // seconds

const good = (over = {}) => ({ eventSlug: 'evt', spotId: '05', sponsor: 'Acme', headline: 'Free coffee', clickUrl: 'https://acme.example/coffee', alt: 'A coffee cup', startsAt: T0 - 100, endsAt: T0 + 3600, creative: png(640, 360), ...over });
// what Arkiv hands back for a campaign entity (plain values, creative as hex)
const row = (key, owner, v, over = {}) => ({ $key: key, $owner: owner, spotId: v.spotId, status: v.status, startsAt: String(v.startsAt), endsAt: String(v.endsAt), sponsor: v.sponsor, headline: v.headline, clickUrl: v.clickUrl, alt: v.alt, mime: v.mime, sha256: v.sha256, width: v.width, height: v.height, creative: '0x' + v.creative.toString('hex'), ...over });
const asRow = (key, owner, over = {}, raw = {}) => { const v = campaignValues(good(over)); return row(key, owner, { ...v, startsAt: over.startsAt ?? T0 - 100, endsAt: over.endsAt ?? T0 + 3600 }, raw); };

// ---------------------------------------------------------------------------------------------------- what a sponsor may write
test('image type and size come from the file itself, whatever it claims to be', () => {
  assert.deepEqual(inspectImage(png(640, 360)), { mime: 'image/png', width: 640, height: 360 });
  assert.deepEqual(inspectImage(gif(300, 250)), { mime: 'image/gif', width: 300, height: 250 });
  assert.deepEqual(inspectImage(jpeg(728, 90)), { mime: 'image/jpeg', width: 728, height: 90 });
  assert.deepEqual(inspectImage(webp(640, 360)), { mime: 'image/webp', width: 640, height: 360 });
  assert.throws(() => inspectImage(pad(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))), CampaignError);
  assert.throws(() => inspectImage(pad(Buffer.from('MZ\x90\x00 an executable'))), CampaignError);
});

test('a good campaign becomes the values to write; the digest is of the exact bytes', () => {
  const v = campaignValues(good());
  assert.equal(v.mime, 'image/png');
  assert.equal(v.width, 640);
  assert.equal(v.sha256, sha256Hex(png(640, 360)));
  assert.equal(v.status, 'active');
});

test('too big, wrong type, bad dates, long text and unsafe links are all refused before anything is signed', () => {
  assert.throws(() => campaignValues(good({ creative: Buffer.concat([png(640, 360), Buffer.alloc(LIMITS.creativeBytes)]) })), /KB; the limit is/);
  assert.throws(() => campaignValues(good({ creative: pad(Buffer.from('not an image at all!!')) })), /PNG, JPEG, WebP or GIF/);
  assert.throws(() => campaignValues(good({ creative: png(4000, 3000) })), /pixels/);
  assert.throws(() => campaignValues(good({ startsAt: T0, endsAt: T0 })), /end after/);
  assert.throws(() => campaignValues(good({ headline: 'x'.repeat(61) })), /too long/);
  assert.throws(() => campaignValues(good({ sponsor: '  ' })), /required/);
  for (const url of ['http://acme.example', 'javascript:alert(1)', 'https://user:pw@acme.example', 'https://192.168.1.5/x', 'https://localhost/x', 'ftp://acme.example', 'not a url', 'https://acme.example/' + 'a'.repeat(200)]) {
    assert.throws(() => checkClickUrl(url), CampaignError, url);
  }
  assert.equal(checkClickUrl('https://acme.example/coffee?ref=wrld3'), 'https://acme.example/coffee?ref=wrld3');
});

// ---------------------------------------------------------------------------------------------------- what the server shows
async function setup({ rows, now = () => T0 * 1000, captured = () => true, allowed = [SPONSOR], leaky = false }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wrld3-ads-'));
  const arkiv = { enabled: true, owner: OWNER, readCampaigns: async (owners) => (leaky ? rows : rows.filter((r) => owners.includes(r.$owner.toLowerCase()))) };
  const ads = await createAds({ dataDir: dir, arkiv, allowedOwners: allowed, hasCaptured: captured, captureCount: () => 7, now, ttlMs: 0 });
  return { ads, dir, done: () => rm(dir, { recursive: true, force: true }) };
}
const U1 = { id: 'u_1' }, U2 = { id: 'u_2' };
const rejection = async (r) => { const s = await setup({ rows: [r] }); await s.ads.refresh(); const out = { shown: await s.ads.pick('05', U1), why: s.ads.rejected()[0]?.reason }; await s.done(); return out; };

test('an approved sponsor campaign is shown, and its image is stored under its digest', async () => {
  const s = await setup({ rows: [asRow('0xk1', SPONSOR)] });
  const ad = await s.ads.pick('05', U1);
  assert.equal(ad.sponsor, 'Acme');
  assert.equal(ad.headline, 'Free coffee');
  assert.match(ad.creativeUrl, /^\/files\/ads\/[0-9a-f]{24}\.png$/);
  assert.deepEqual(await readFile(path.join(s.dir, 'ads', ad.creativeUrl.split('/').pop())), png(640, 360));
  await s.done();
});

test('the organizer wallet is approved too; a stranger copying the schema name is never shown', async () => {
  const rows = [asRow('0xk1', OWNER), asRow('0xk2', STRANGER, { headline: 'Send me crypto' })];
  // 1. the reader only asks Arkiv for approved owners, so the stranger's entity is never even fetched
  const s = await setup({ rows });
  assert.equal((await s.ads.pick('05', U1)).headline, 'Free coffee');
  assert.deepEqual(await s.ads.stats().then((x) => x.map((c) => c.headline)), ['Free coffee']);
  await s.done();
  // 2. and if a reader ever did return it, it is still rejected
  const leaky = await setup({ rows, leaky: true });
  await leaky.ads.refresh();
  assert.deepEqual(leaky.ads.rejected().map((r) => r.reason), ['owner is not approved']);
  assert.equal((await leaky.ads.pick('05', U1)).headline, 'Free coffee');
  await leaky.done();
});

test('every unsafe or stale campaign is rejected, with a reason', async () => {
  const cases = [
    ['paused', asRow('0xa', SPONSOR, {}, { status: 'paused' }), 'not active'],
    ['not started', asRow('0xb', SPONSOR, { startsAt: T0 + 10, endsAt: T0 + 99 }), 'outside its dates'],
    ['expired', asRow('0xc', SPONSOR, { startsAt: T0 - 99, endsAt: T0 - 1 }), 'outside its dates'],
    ['tampered image', asRow('0xd', SPONSOR, {}, { sha256: '0x' + '00'.repeat(32) }), 'image does not match its digest'],
    ['wrong type', asRow('0xe', SPONSOR, {}, { mime: 'image/gif' }), 'image type does not match'],
    ['wrong size', asRow('0xf', SPONSOR, {}, { width: 1 }), 'image size does not match'],
    ['unsafe link', asRow('0xg', SPONSOR, {}, { clickUrl: 'javascript:alert(1)' }), 'The link must start with https://'],
    ['not bytes', asRow('0xh', SPONSOR, {}, { creative: '<script>' }), 'creative is not bytes'],
  ];
  for (const [name, r, why] of cases) {
    const out = await rejection(r);
    assert.equal(out.shown, null, `${name} must not be shown`);
    assert.equal(out.why, why, name);
  }
});

test('nobody sees an ad until they have a verified capture at that spot', async () => {
  const s = await setup({ rows: [asRow('0xk1', SPONSOR)], captured: (u) => u === 'u_1' });
  assert.ok(await s.ads.pick('05', U1));
  assert.equal(await s.ads.pick('05', U2), null);
  assert.equal(await s.ads.pick('05', null), null);
  assert.equal(await s.ads.pick('06', U1), null, 'an ad for spot 05 is not shown for another spot');
  await s.done();
});

test('two sponsors on one spot share it: the one with fewer views goes first', async () => {
  const s = await setup({ rows: [asRow('0xa', SPONSOR, { sponsor: 'A' }), asRow('0xb', SPONSOR, { sponsor: 'B' })] });
  const first = await s.ads.pick('05', U1);
  await s.ads.record(U1, first.key);
  const second = await s.ads.pick('05', U2);
  assert.notEqual(second.key, first.key);
  await s.done();
});

test('an impression counts once per person, and only for someone who really captured', async () => {
  const s = await setup({ rows: [asRow('0xk1', SPONSOR)], captured: (u) => u === 'u_1' });
  assert.deepEqual(await s.ads.record(U1, '0xk1'), { counted: true, impressions: 1 });
  assert.equal((await s.ads.record(U1, '0xk1')).counted, false);
  assert.equal((await s.ads.record(U2, '0xk1')).counted, false);
  assert.equal((await s.ads.record(U1, '0xmissing')).counted, false);
  const [st] = await s.ads.stats();
  assert.deepEqual({ impressions: st.impressions, captures: st.captures, sponsor: st.sponsor }, { impressions: 1, captures: 7, sponsor: 'Acme' });
  assert.equal(JSON.stringify(st).includes('u_1'), false, 'stats never name a person');
  await s.done();
});

test('if Arkiv is switched off, no ads and no crash', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wrld3-ads-'));
  const ads = await createAds({ dataDir: dir, arkiv: { enabled: false }, hasCaptured: () => true, ttlMs: 0 });
  assert.equal(await ads.pick('05', U1), null);
  assert.deepEqual(await ads.stats(), []);
  await rm(dir, { recursive: true, force: true });
});
