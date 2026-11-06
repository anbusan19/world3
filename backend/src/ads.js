import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CampaignError, LIMITS, checkClickUrl, inspectImage, sha256Hex } from './campaign.js';

// Ad serving. Campaigns live on Arkiv (written by sponsors); this module decides which ones are safe to show and keeps the
// numbers. A campaign is shown only if ALL of these hold, checked here and never taken on trust:
//   - its owner wallet is on our approved list (anyone can copy the schema name, so the tag proves nothing),
//   - it is active and inside its start/end window,
//   - the image is a real PNG/JPEG/WebP/GIF of the declared type and size, under the limit, and matches its digest,
//   - its link is a plain https address.
// An ad is served only to a signed-in person who has already made a VERIFIED capture at that spot, so a sponsor pays for
// attention from a real, verified human who really was there, never for anonymous views. Impressions are counted once per person.

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const toNum = (v) => { try { return Number(BigInt(String(v))); } catch { return NaN; } };

export async function createAds({ dataDir, arkiv, allowedOwners = [], hasCaptured, captureCount = () => 0, now = () => Date.now(), ttlMs = 30_000 }) {
  const dir = path.join(dataDir, 'ads');
  const file = path.join(dataDir, 'impressions.json');
  await mkdir(dir, { recursive: true });
  let impressions = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).impressions ?? [] : []; // { key, userId, at }
  let saving = Promise.resolve();
  const save = () => {
    const data = JSON.stringify({ version: 1, impressions }, null, 2);
    saving = saving.then(async () => { const tmp = `${file}.tmp`; await writeFile(tmp, data); await rename(tmp, file); });
    return saving;
  };

  let active = [];
  let rejected = [];
  let loadedAt = 0;
  let loading = null;
  // `allowedOwners` may be a function, so the organizer's approvals apply without a restart
  const owners = () => [...new Set([arkiv.owner, ...(typeof allowedOwners === 'function' ? allowedOwners() : allowedOwners)].filter(Boolean).map((a) => a.toLowerCase()))];

  async function check(raw) {
    const owner = String(raw.$owner ?? '').toLowerCase();
    if (raw.$owner && !owners().includes(owner)) throw new CampaignError('owner is not approved');
    if (raw.status !== 'active') throw new CampaignError('not active');
    const t = Math.floor(now() / 1000);
    if (!(toNum(raw.startsAt) <= t && t < toNum(raw.endsAt))) throw new CampaignError('outside its dates');
    if (typeof raw.creative !== 'string' || !/^0x([0-9a-f]{2})*$/i.test(raw.creative)) throw new CampaignError('creative is not bytes');
    const buf = Buffer.from(raw.creative.slice(2), 'hex');
    if (buf.length > LIMITS.creativeBytes) throw new CampaignError('image is over the size limit');
    if (sha256Hex(buf) !== String(raw.sha256).toLowerCase()) throw new CampaignError('image does not match its digest');
    const img = inspectImage(buf);
    if (img.mime !== raw.mime || !EXT[img.mime]) throw new CampaignError('image type does not match');
    if (img.width !== Number(raw.width) || img.height !== Number(raw.height) || img.width > LIMITS.maxSide || img.height > LIMITS.maxSide) throw new CampaignError('image size does not match');
    const clickUrl = checkClickUrl(raw.clickUrl);
    const name = `${raw.sha256.slice(2, 26)}${EXT[img.mime]}`;
    await writeFile(path.join(dir, name), buf);
    return {
      key: raw.$key, owner: raw.$owner ?? null, spotId: String(raw.spotId), sponsor: String(raw.sponsor), headline: String(raw.headline), alt: String(raw.alt),
      clickUrl, file: name, mime: img.mime, width: img.width, height: img.height, endsAt: toNum(raw.endsAt),
    };
  }

  async function refresh() {
    if (!arkiv.enabled) { active = []; rejected = []; return; }
    const raws = await arkiv.readCampaigns(owners());
    const ok = [], no = [];
    for (const raw of raws) {
      try { ok.push(await check(raw)); } catch (e) { no.push({ key: raw.$key, reason: e instanceof CampaignError ? e.message : 'unreadable' }); }
    }
    active = ok; rejected = no; loadedAt = now();
  }

  // at most one read from Arkiv per `ttlMs`, however many phones ask
  async function fresh() {
    if (now() - loadedAt < ttlMs && loadedAt) return;
    loading ??= refresh().finally(() => { loading = null; });
    try { await loading; } catch (e) { if (!loadedAt) throw e; /* keep serving the last good list if Arkiv hiccups */ }
  }

  const countFor = (key) => impressions.filter((i) => i.key === key).length;

  return {
    refresh: fresh,
    // the ad for this person at this spot, or null. Fewest impressions first, so sponsors share the spot fairly.
    async pick(spotId, user) {
      if (!user || !hasCaptured(user.id, String(spotId))) return null;
      await fresh();
      const list = active.filter((c) => c.spotId === String(spotId));
      if (!list.length) return null;
      const c = [...list].sort((a, b) => countFor(a.key) - countFor(b.key) || a.key.localeCompare(b.key))[0];
      return { key: c.key, sponsor: c.sponsor, headline: c.headline, alt: c.alt, clickUrl: c.clickUrl, creativeUrl: `/files/ads/${c.file}`, width: c.width, height: c.height };
    },
    // one count per person per campaign, and only from someone who really captured at that spot
    async record(user, key) {
      await fresh();
      const c = active.find((x) => x.key === key);
      if (!user || !c || !hasCaptured(user.id, c.spotId)) return { counted: false };
      if (impressions.some((i) => i.key === key && i.userId === user.id)) return { counted: false, impressions: countFor(key) };
      impressions.push({ key, userId: user.id, at: new Date(now()).toISOString() });
      await save();
      return { counted: true, impressions: countFor(key) };
    },
    // aggregate numbers a sponsor can check (no people, no ids)
    async stats() {
      await fresh();
      return active.map((c) => ({ campaign: c.key, spotId: c.spotId, sponsor: c.sponsor, headline: c.headline, impressions: countFor(c.key), captures: captureCount(c.spotId), endsAt: c.endsAt }));
    },
    rejected: () => rejected,
    // what is true of one campaign right now: is it being shown, and if an approved sponsor's campaign is not, why not
    async statusOf(key) {
      await fresh();
      const c = active.find((x) => x.key === key);
      if (c) return { shown: true, impressions: countFor(key), captures: captureCount(c.spotId) };
      return { shown: false, reason: rejected.find((r) => r.key === key)?.reason ?? null, impressions: countFor(key), captures: null };
    },
    isApprovedOwner: (address) => owners().includes(String(address).toLowerCase()),
    dir,
  };
}
