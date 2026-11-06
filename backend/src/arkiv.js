import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ExpirationTime, createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { and, eq } from '@arkiv-network/sdk/query';
import { bool, defineSchema, i32, str } from '@arkiv-network/sdk/schema';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CampaignSchema } from './campaign.js';

// Spots as public Arkiv entities, so anyone can discover them without asking the World3 backend, and they disappear on
// their own when the event is over. The organizer's wallet owns and writes them; this server only reads them back.
//
// What is public: the name, type, rounded location (about 100 m) and radii. What is NOT: exact coordinates, the 3D model,
// captures, people. Exact coordinates and models stay on our server and reach the app only through the app's feed.
//
// Arkiv facts this relies on (docs.arkiv.network): every entity needs an expiry (max ~182 days); only the owner can change
// or delete it; anyone can write entities with the same schema name, so reads are filtered by owner.

export const SPOT_SCHEMA_NAME = 'world3.spot';
export const SpotSchema = defineSchema(SPOT_SCHEMA_NAME, {
  eventSlug: str().indexed(),
  spotId: str().indexed(),
  name: str(),
  label: str(),
  city: str().optional(),
  type: str().indexed(), // LANDMARK | EVENT
  kind: str(), // geospatial | anchor
  latE3: i32().indexed(), // latitude  x 1000, rounded: about 110 m
  lngE3: i32().indexed(), // longitude x 1000
  captureRadiusM: i32(),
  approachRadiusM: i32(),
  theme: str(),
  icon: str(),
  art: str().optional(),
  hasModel: bool(),
});

// The SDK puts the RPC access key inside the URL path, and viem error text can include that URL, so nothing from a transport
// error is ever shown or logged as it is: keys and URLs are removed, and only a short, fixed-shape message is kept.
export const redact = (text) => String(text ?? '').replace(/ark_live_[A-Za-z0-9_-]+/g, '[key]').replace(/https?:\/\/[^\s"')]+/g, '[url]');
export const safeMessage = (e) => redact(e?.shortMessage ?? e?.name ?? 'Arkiv did not accept the write').slice(0, 160);

// Rabdi writes carry an explicit gas limit (1,000,000 is the documented floor for a single operation). Gas not used is not charged.
const TX = { gas: 1_000_000n };

const E3 = (deg) => Math.round(Number(deg) * 1000);
const plain = (v) => (typeof v === 'bigint' ? v.toString() : v); // 64-bit numbers do not survive JSON
const flat = (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, plain(v && typeof v === 'object' && 'value' in v ? v.value : v)]));

// the public form of a spot (no exact coordinates, no model, nothing personal)
export function toEntityValues(spot, eventSlug) {
  const v = {
    eventSlug,
    spotId: String(spot.id),
    name: String(spot.name).slice(0, 40),
    label: String(spot.label ?? '').slice(0, 20),
    type: String(spot.type),
    kind: String(spot.kind),
    latE3: E3(spot.lat),
    lngE3: E3(spot.lng),
    captureRadiusM: Math.round(spot.captureRadiusM),
    approachRadiusM: Math.round(spot.approachRadiusM),
    theme: String(spot.theme),
    icon: String(spot.icon),
    hasModel: !!spot.model,
  };
  if (spot.city) v.city = String(spot.city).slice(0, 40);
  if (spot.art) v.art = String(spot.art);
  return v;
}

export function arkivConfigFromEnv(env = process.env) {
  return {
    privateKey: env.ARKIV_PRIVATE_KEY,
    accessKey: env.ARKIV_ACCESS_KEY ?? '',
    eventSlug: env.ARKIV_EVENT_SLUG || 'ethglobal-mumbai-2026',
    ttlDays: Number(env.ARKIV_TTL_DAYS) || 30,
  };
}

// A tiny record of what we published (entity key, transaction, expiry), so the dashboard and README can show it.
class Ledger {
  #queue = Promise.resolve();
  constructor(dir) { this.file = path.join(dir, 'arkiv.json'); this.items = {}; }
  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) this.items = JSON.parse(await readFile(this.file, 'utf8')).spots ?? {};
  }
  get(id) { return this.items[id] ?? null; }
  set(id, rec) { if (rec) this.items[id] = rec; else delete this.items[id]; return this.#save(); }
  #save() {
    const data = JSON.stringify({ version: 1, spots: this.items }, null, 2);
    this.#queue = this.#queue.then(async () => { const tmp = `${this.file}.tmp`; await writeFile(tmp, data); await rename(tmp, this.file); });
    return this.#queue;
  }
}

// `clients` can be injected (tests use a fake); otherwise real ones are built from the config.
export async function createArkiv({ dataDir, config = arkivConfigFromEnv(), clients = null, now = () => Date.now() }) {
  const ledger = new Ledger(dataDir);
  await ledger.init();
  if (!clients && !config.privateKey) return { enabled: false, ledger, status: () => ledger.items };

  let publicClient, walletClient, owner;
  if (clients) ({ publicClient, walletClient, owner } = clients);
  else {
    const chain = rabdi({ accessKey: config.accessKey });
    const account = privateKeyToAccount(config.privateKey);
    owner = account.address;
    publicClient = createPublicClient({ chain, transport: http() });
    walletClient = createWalletClient({ chain, transport: http(), account });
  }

  const expiration = () => ExpirationTime.fromDays(config.ttlDays);
  const expiresOn = () => new Date(now() + config.ttlDays * 86_400_000).toISOString().slice(0, 10);
  const where = (spotId) => and(eq('eventSlug', config.eventSlug), eq('spotId', String(spotId)));

  // Our own record of the entity key comes first: right after a write the index can lag, and "query then create" is not a
  // uniqueness check. The query is only the fallback (a fresh install, or a ledger that was lost).
  async function find(spotId) {
    const known = ledger.get(String(spotId));
    if (known?.entityKey) return { $key: known.entityKey };
    const { entities } = await publicClient.select({ $key: true, $expiresAt: true }).from(SpotSchema).ownedBy(owner).where(where(spotId)).limit(1).fetch();
    return entities[0] ?? null;
  }

  // One writer at a time: the same wallet signs every write, and two at once can collide on the transaction nonce.
  let tail = Promise.resolve();
  const serial = (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };

  return {
    enabled: true,
    owner,
    eventSlug: config.eventSlug,
    ledger,
    status: (id) => (id ? ledger.get(id) : ledger.items),

    // create the spot's entity, or update it (and renew its life) if it is already there
    publish: (spot) => serial(async () => {
      const values = toEntityValues(spot, config.eventSlug);
      const existing = await find(spot.id);
      let rec;
      if (existing) {
        const { txHash } = await walletClient.patchEntity(SpotSchema, existing.$key, { set: values }, TX);
        const ext = await walletClient.extendEntity({ entityKey: existing.$key, expiration: expiration() }, TX);
        rec = { entityKey: existing.$key, txHash, expiresAt: String(ext?.expiresAt ?? ''), expiresOn: expiresOn(), updatedAt: new Date(now()).toISOString() };
      } else {
        const { entityKey, txHash, expiresAt } = await walletClient.createEntity(SpotSchema, values, { expiration: expiration() }, TX);
        rec = { entityKey, txHash, expiresAt: String(expiresAt ?? ''), expiresOn: expiresOn(), updatedAt: new Date(now()).toISOString() };
      }
      await ledger.set(String(spot.id), { ...rec, owner });
      return ledger.get(String(spot.id));
    }),

    // take the spot's entity off Arkiv (the owner may delete it any time)
    unpublish: (spotId) => serial(async () => {
      const existing = await find(spotId);
      if (existing) await walletClient.deleteEntity({ entityKey: existing.$key }, TX);
      await ledger.set(String(spotId), null);
      return !!existing;
    }),

    // every campaign entity from the given owners (sponsors write them from their own wallets). Values are returned as
    // plain objects with the creative as hex; the caller validates everything before showing any of it.
    async readCampaigns(owners, eventSlug = config.eventSlug) {
      const out = [];
      for (const o of owners) {
        const { entities } = await publicClient
          .select({ $key: true, $owner: true, $expiresAt: true, spotId: true, status: true, startsAt: true, endsAt: true, sponsor: true, headline: true, clickUrl: true, alt: true, mime: true, sha256: true, width: true, height: true, creative: true })
          .from(CampaignSchema)
          .ownedBy(o)
          .where(eq('eventSlug', eventSlug))
          .limit(100)
          .fetch();
        out.push(...entities.map(flat));
      }
      return out;
    },

    // one sponsor's own campaigns, without the image bytes (the advertiser page lists these)
    async readCampaignsFor(ownerAddress, eventSlug = config.eventSlug) {
      const { entities } = await publicClient
        .select({ $key: true, $expiresAt: true, spotId: true, status: true, startsAt: true, endsAt: true, sponsor: true, headline: true, clickUrl: true, mime: true, width: true, height: true, sha256: true })
        .from(CampaignSchema)
        .ownedBy(ownerAddress)
        .where(eq('eventSlug', eventSlug))
        .limit(100)
        .fetch();
      return entities.map(flat);
    },

    // the public list, read back from the chain (the part of the app that "reads from Arkiv")
    async list() {
      const { entities } = await publicClient
        .select({ $key: true, $expiresAt: true, spotId: true, name: true, label: true, city: true, type: true, kind: true, latE3: true, lngE3: true, captureRadiusM: true, approachRadiusM: true, theme: true, icon: true, art: true, hasModel: true })
        .from(SpotSchema)
        .ownedBy(owner)
        .where(eq('eventSlug', config.eventSlug))
        .limit(100)
        .fetch();
      return entities.map(flat);
    },
  };
}
