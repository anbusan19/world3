import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { Accounts, createAuthService } from './auth.js';
import { createAds } from './ads.js';
import { createEns } from './ens/passport.js';
import { PassportError, createPassports } from './ens/passports.js';
import { Sponsors } from './sponsors.js';
import { createArkiv, safeMessage } from './arkiv.js';
import { Captures, captureConfigFromEnv, createCaptureService } from './capture.js';
import { CaptureError, createWorld, worldConfigFromEnv } from './world.js';
import { createVoucherSigner, voucherConfigFromEnv } from './voucher.js';
import { GlbError, LIMITS, parseGlb } from './glb.js';
import { SEED } from './seed.js';
import { explore } from './explorer.js';
import { Events } from './events.js';
import { createStampChain } from './stampchain.js';
import { adCardSvg, sharePage, stampCardSvg, toPng } from './share.js';
import { FaucetError, createFaucet } from './faucet.js';
import { Store, toPublic } from './store.js';
import { validateSpot } from './validate.js';

// The whole server: the dashboard's admin API, the read-only feed the phone app uses, uploaded files, and the
// dashboard pages themselves. No dependencies, and no login, so it only listens on this computer by default.
//
//   GET  /api/v1/spots            the app's feed: published spots only
//   GET  /files/models/<file>     model files (cacheable forever: the name contains the file's hash)
//   *    /api/spots...            admin API used by the dashboard (same-origin only)

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const IMAGE_MAGIC = [
  { ext: '.png', test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
  { ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];
const MAX_IMAGE = 2 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, { 'content-type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(payload);
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        reject(new HttpError(413, `That upload is larger than the ${Math.round(max / 1048576)} MB limit.`));
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const restoreFails = new Map(); // address -> recent wrong recovery-code times
async function readJson(req) {
  const raw = await readBody(req, 1024 * 1024);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

const sanitizeName = (s) => String(s ?? '').replace(/[^\w .()-]/g, '').slice(0, 80);

export async function createApp({ dataDir, publicDir, host = '127.0.0.1', log = () => {}, capture: captureOpts = {}, arkiv: arkivOpts = {}, ens: ensOpts = {}, stamp: stampOpts = {} }) {
  const store = new Store(dataDir);
  await store.init(SEED);
  const arkiv = await createArkiv({ dataDir, ...arkivOpts });
  const faucet = arkiv.enabled && arkiv.fundOps ? await createFaucet({ dataDir, chain: arkiv.fundOps, ...(arkivOpts.faucet ? { config: arkivOpts.faucet } : {}) }) : null;
  const captures = new Captures(dataDir);
  await captures.init();
  const accounts = new Accounts(dataDir);
  await accounts.init();
  const world = createWorld({ config: captureOpts.worldConfig ?? worldConfigFromEnv(), fetchImpl: captureOpts.fetchImpl, now: captureOpts.now });
  const events = new Events(dataDir, { endsAt: process.env.EVENT_ENDS_AT || null, ...(captureOpts.event ?? {}) });
  await events.init();
  const nowMs = () => (captureOpts.now ? captureOpts.now() : Date.now());
  const live = (spot) => events.live(spot, nowMs()); // is this spot's event running?
  const spotLive = (spotId) => { const sp = store.get(String(spotId)); return !sp || live(sp); }; // a spot we do not know is not blocked here
  const eventGate = (spotId) => { const sp = store.get(String(spotId)); if (!sp) return null; const ev = events.of(sp); const st = events.status(ev, nowMs()); return st === 'ended' ? new CaptureError('event_over', `${ev.name} has ended. This stamp can no longer be collected.`, 410) : st === 'upcoming' ? new CaptureError('not_started', `${ev.name} has not started yet.`, 425) : null; };
  const sponsors = new Sponsors(dataDir, (arkivOpts.sponsors ?? (process.env.ARKIV_SPONSORS ?? '').split(',')).map((a) => a.trim()).filter(Boolean));
  await sponsors.init();
  const ads = await createAds({
    dataDir, arkiv,
    allowedOwners: () => sponsors.addresses(),
    hasCaptured: (userId, spotId) => captures.items.some((c) => c.userId === userId && c.spotId === spotId),
    captureCount: (spotId) => captures.items.filter((c) => c.spotId === spotId).length,
    now: captureOpts.now,
  });
  // opt-in public passports on ENS (off unless the ENS wallet and the owner seed are configured)
  const ensClient = ensOpts.client ?? (process.env.ENS_PRIVATE_KEY ? await createEns({ privateKey: process.env.ENS_PRIVATE_KEY, rpcUrl: process.env.SEPOLIA_RPC_URL, dataDir }) : null);
  const ownerSeed = ensOpts.ownerSeed ?? process.env.PASSPORT_OWNER_SEED;
  const passports = ensClient && ownerSeed ? await createPassports({ dataDir, ens: ensClient, ownerSeed, captures, publicBase: ensOpts.publicBase ?? process.env.PUBLIC_BASE_URL ?? '', blockedWords: ensOpts.blockedWords ?? (process.env.PASSPORT_BLOCKED_WORDS ?? '').split(',') }) : null;
  const voucherSigner = createVoucherSigner(captureOpts.voucher ?? voucherConfigFromEnv());
  const gate = (spot, user) => {
    const ev = events.of(spot); const st = events.status(ev, nowMs());
    if (st === 'ended') return new CaptureError('event_over', `${ev.name} has ended. This stamp can no longer be collected.`, 410);
    if (st === 'upcoming') return new CaptureError('not_started', `${ev.name} has not started yet.`, 425);
    if (spot.requires && user) {
      const have = new Set(captures.items.filter((c) => c.userId === user.id).map((c) => c.spotId));
      const n = spot.requires.from.filter((id) => have.has(id)).length;
      if (n < spot.requires.min) return new CaptureError('locked', `Quest locked: collect ${spot.requires.min} of the ${spot.requires.from.length} stamps first (you have ${n}).`, 403);
    }
    return null;
  };
  const capture = createCaptureService({ store, captures, world, accounts, voucherSigner, config: captureOpts.config ?? captureConfigFromEnv(), now: captureOpts.now, gate });
  const auth = createAuthService({ world, accounts, action: captureOpts.signinAction ?? process.env.WORLD_ID_SIGNIN_ACTION ?? 'signin', now: captureOpts.now });
  const bearer = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  const hostOk = (h) => !loopback || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h ?? ''); // blocks DNS-rebinding

  // The Stamp contract's registry: a published spot is written on chain so anyone can list it and mint it. A failure never blocks saving.
  const chain = await createStampChain({ dataDir, privateKey: process.env.STAMP_OWNER_KEY || process.env.ENS_PRIVATE_KEY, rpcUrl: process.env.SEPOLIA_RPC_URL, contract: process.env.STAMP_CONTRACT, chainId: Number(process.env.CHAIN_ID) || 11155111, ...stampOpts });
  const chainBusy = new Set(); const chainErr = new Map();
  const chainMsg = (e) => String(e?.shortMessage ?? e?.message ?? 'failed').replace(/https?:\/\/\S+/g, '[url]').slice(0, 120);
  // Mint a capture's stamp on chain through the relayer. A public RPC can fail now and then, and a failed mint must not leave a stamp
  // "minting" forever, so it is retried (up to 6 tries) and a sweep every minute picks up any capture that still has no mint.
  const mintTries = new Map(); const minting = new Set();
  function relayMint(c) {
    if (!chain.enabled || !c?.voucher || c.mintTx || minting.has(c.id) || (mintTries.get(c.id) ?? 0) >= 6) return;
    minting.add(c.id); mintTries.set(c.id, (mintTries.get(c.id) ?? 0) + 1);
    chain.mint(c.voucher).then((tx) => captures.setMint(c.id, tx)).catch((e) => console.error(`mint relay failed (try ${mintTries.get(c.id)}):`, chainMsg(e))).finally(() => minting.delete(c.id));
  }
  const mintSweep = () => { for (const c of captures.items) relayMint(c); };
  if (chain.enabled) { setTimeout(mintSweep, 5_000).unref(); setInterval(mintSweep, 60_000).unref(); }
  function syncChain(spot) {
    if (!chain.enabled || !spot.published) return;
    chainBusy.add(spot.id); chainErr.delete(spot.id);
    chain.sync(spot, events.of(spot)).catch((e) => { chainErr.set(spot.id, chainMsg(e)); console.error('chain sync failed:', chainMsg(e)); }).finally(() => chainBusy.delete(spot.id));
  }
  function syncChainEvent(eventId) {
    if (!chain.enabled) return;
    const list = store.list().filter((x) => x.published && (x.eventId ?? 'ethmumbai') === eventId);
    if (list.length) chain.syncMany(list.map((spot) => ({ spot, ev: events.of(spot) }))).catch((e) => console.error('chain event sync failed:', chainMsg(e)));
  }
  const chainInfo = (id) => (chain.enabled ? { contract: chain.address, status: chain.status(id), pending: chainBusy.has(id), error: chainErr.get(id) ?? null, txUrl: chain.status(id)?.tx ? chain.txUrl(chain.status(id).tx) : null } : null);

  // Arkiv: a spot is public there only when it is published AND the organizer ticked "On Arkiv". A failure never blocks saving.
  const arkivInfo = (id) => (arkiv.enabled ? arkiv.status(id) : null);
  const withArkiv = (spot) => ({ ...spot, arkivInfo: arkivInfo(spot.id), arkivEnabled: arkiv.enabled, chain: chainInfo(spot.id) });
  async function syncArkiv(spot) {
    if (!arkiv.enabled) return null;
    try {
      if (spot.onArkiv && spot.published) await arkiv.publish(spot);
      else if (arkiv.status(spot.id)) await arkiv.unpublish(spot.id);
      return null;
    } catch (e) {
      console.error('arkiv sync failed:', safeMessage(e));
      return safeMessage(e);
    }
  }

  const needSpot = (id) => {
    const spot = store.get(id);
    if (!spot) throw new HttpError(404, 'There is no spot with that id.');
    return spot;
  };

  async function route(req, res, url) {
    const p = url.pathname;
    const method = req.method;
    const isPublicRead = (method === 'GET' || method === 'HEAD') && (p === '/api/v1/spots' || p.startsWith('/files/'));
    const cors = isPublicRead ? { 'access-control-allow-origin': '*' } : {};

    if (!hostOk(req.headers.host)) throw new HttpError(403, 'Unexpected Host header.');
    if (method === 'OPTIONS') {
      return send(res, 204, '', { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD', 'access-control-max-age': '86400' });
    }

    // Anything that changes data must come from the dashboard itself, never from another website open in your browser.
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).host; } catch { /* handled below */ }
        if (originHost !== req.headers.host) throw new HttpError(403, 'Cross-site requests are not allowed.');
      }
      // the dashboard and the phone app each send their own marker; a web page on another site cannot set it without a CORS preflight
      if (!['wrld3-dashboard', 'wrld3-app'].includes(req.headers['x-requested-with'])) throw new HttpError(403, 'Missing X-Requested-With header.');
    }

    if (p === '/api/health') return send(res, 200, { ok: true, spots: store.list().length });

    // ---- the app's feed -----------------------------------------------------------------------------------------
    if (p === '/api/v1/spots' && method === 'GET') {
      // NOTE: the README wants the app to see only coarse locations and the server to decide capture, so exact
      // coordinates here are a prototype shortcut. Round them (or drop them) before a real launch.
      const body = JSON.stringify({ event: events.snapshot(events.main, nowMs()), events: events.list(nowMs()), archive: store.list().filter((x) => x.published && events.status(events.of(x), nowMs()) === 'ended').map((x) => ({ id: x.id, name: x.name, label: x.label, city: x.city, type: x.type, theme: x.theme, art: x.art, icon: x.icon, eventId: x.eventId ?? 'ethmumbai' })), spots: store.list().filter((x) => x.published && live(x)).map((x) => { const a = arkivInfo(x.id); return { ...toPublic(x), ...(a && x.onArkiv ? { arkiv: { entityKey: a.entityKey, owner: a.owner, expiresOn: a.expiresOn } } : {}) }; }) });
      const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
      if (req.headers['if-none-match'] === etag) return send(res, 304, '', { etag, ...cors });
      return send(res, 200, body, { 'content-type': 'application/json; charset=utf-8', etag, 'cache-control': 'no-cache', ...cors });
    }

    // what is public on Arkiv right now, read back from the chain (anyone can run the same query without this server)
    if (p === '/api/v1/arkiv/spots' && method === 'GET') {
      if (!arkiv.enabled) throw new HttpError(503, 'Arkiv is not configured on this server.');
      return send(res, 200, { owner: arkiv.owner, eventSlug: arkiv.eventSlug, schema: 'world3.spot', events: events.list(nowMs()), spots: (await arkiv.list()).filter((x) => spotLive(x.spotId ?? x.id)) }, cors);
    }

    // testnet faucet: a sponsor gets a little tGLM to run an ad (worthless test token; limited per wallet and per day)
    if (p === '/api/v1/faucet/info' && method === 'GET') return send(res, 200, faucet ? { ...faucet.info(), owner: arkiv.owner } : { enabled: false }, cors);
    if (p === '/api/v1/faucet' && method === 'POST') {
      if (!faucet) throw new HttpError(503, 'The faucet is not set up on this server.');
      const { address } = await readJson(req);
      const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const ip = (loop ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';
      try { return send(res, 200, await faucet.drip(address, ip), cors); }
      catch (e) { if (e instanceof FaucetError) throw new HttpError(e.status, e.message); console.error('faucet', e?.shortMessage ?? e?.name); throw new HttpError(502, 'The faucet could not send right now. Try again in a minute.'); }
    }

    // ---- share cards: a picture and a small page whose tags make X show it (public, read-only, nothing personal) ----------
    const shareRoute = p.match(/^\/share\/(ad|stamp)\/([A-Za-z0-9._-]{1,80}?)(\.png)?$/);
    if (shareRoute && method === 'GET') {
      const [, kind, id, png] = shareRoute;
      const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const fwdHost = loop ? req.headers['x-forwarded-host'] : null;
      // SHARE_BASE_URL (for example https://wrld3.vercel.app) makes the page and its picture name the public website, which forwards /share here
      const base = (process.env.SHARE_BASE_URL || process.env.PUBLIC_BASE_URL || (fwdHost ? `${req.headers['x-forwarded-proto'] || 'https'}://${fwdHost}` : `http://${req.headers.host}`)).replace(/\/+$/, '');
      let eventName = events.name;
      let svg, title, description;
      if (kind === 'ad') {
        const c = await ads.get(id).catch(() => null);
        if (!c) throw new HttpError(404, 'This campaign is not live (yet).');
        let creative = null; try { creative = await readFile(path.join(ads.dir, c.file)); } catch { /* no picture */ }
        eventName = events.of(store.get(c.spotId)).name;
        svg = adCardSvg({ sponsor: c.sponsor, headline: c.headline, creative, mime: c.mime, eventName });
        title = `${c.sponsor} is live on WRLD³`; description = `${c.headline} · Seen by verified humans at ${eventName}.`;
      } else {
        const spot = store.list().find((x) => x.id === id && x.published);
        if (!spot) throw new HttpError(404, 'No such spot.');
        eventName = events.of(spot).name;
        svg = stampCardSvg({ spot, eventName });
        title = `I collected ${spot.name} on WRLD³`; description = `A stamp you can only get by being there, proved with World ID. ${eventName}.`;
      }
      if (png) return send(res, 200, toPng(svg), { 'content-type': 'image/png', 'cache-control': 'public, max-age=300', ...cors });
      return send(res, 200, sharePage({ title, description, image: `${base}/share/${kind}/${id}.png`, url: `${base}/share/${kind}/${id}` }), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', ...cors });
    }

    // the Stamp contract, for anyone who wants to read the registry or mint with a voucher themselves
    if (p === '/api/v1/chain' && method === 'GET') return send(res, 200, chain.enabled ? { enabled: true, chainId: chain.chainId, contract: chain.address, explorer: chain.explorer, registered: chain.count() } : { enabled: false }, cors);
    if (p === '/api/chain/sync' && method === 'POST') {
      if (!chain.enabled) throw new HttpError(503, 'The stamp contract is not configured (STAMP_CONTRACT).');
      const list = store.list().filter((x) => x.published);
      const out = await chain.syncMany(list.map((spot) => ({ spot, ev: events.of(spot) }))).catch((e) => { throw new HttpError(502, chainMsg(e)); });
      return send(res, 200, out);
    }

    // ERC-1155 metadata for a stamp (the contract's URI is .../stamp/{id}.json, with {id} as 64 hex digits)
    const metaRoute = p.match(/^\/stamp\/([0-9a-f]{64})\.json$/);
    if (metaRoute && method === 'GET') {
      const id = String(parseInt(metaRoute[1], 16));
      const spot = store.list().find((x) => x.published && String(Number(x.id)) === id);
      if (!spot) throw new HttpError(404, 'No such stamp.');
      const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const fwd = loop ? req.headers['x-forwarded-host'] : null;
      const base = (process.env.PUBLIC_BASE_URL || (fwd ? `${req.headers['x-forwarded-proto'] || 'https'}://${fwd}` : `http://${req.headers.host}`)).replace(/\/+$/, '');
      return send(res, 200, { name: spot.name, description: `A wrld3 stamp: proof that a verified human was at ${spot.name}${spot.city ? `, ${spot.city}` : ''}. Non-transferable.`, image: `${base}/share/stamp/${spot.id}.png`, external_url: `${base}/share/stamp/${spot.id}`, attributes: [{ trait_type: 'Place', value: spot.name }, { trait_type: 'City', value: spot.city || '' }, { trait_type: 'Event', value: events.of(spot).name }] }, cors);
    }

    // the public explorer: recent stamps across everyone (no personal data), searchable
    if (p === '/api/v1/explorer' && method === 'GET') {
      const q = url.searchParams;
      return send(res, 200, explore({ captures: captures.items, spots: store.list().filter((s) => s.published), walletOf: (id) => passports?.ownerFor(id) ?? null }, { limit: q.get('limit'), offset: q.get('offset'), q: q.get('q') ?? '', spotId: q.get('spot') ?? '' }), cors);
    }

    // the person's own captures (so the app can show their stamps again after a restart or on a new phone)
    if (p === '/api/v1/me/captures' && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { captures: captures.items.filter((c) => c.userId === user.id).map((c) => ({ spotId: c.spotId, at: c.at, mintTx: c.mintTx ?? null, mintUrl: c.mintTx && chain.enabled ? chain.txUrl(c.mintTx) : null })) });
    }

    // ---- the person's own public passport (opt-in) --------------------------------------------------------------------
    if (p === '/api/v1/passport/name' && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      if (!passports) throw new HttpError(503, 'Public passports are not set up on this server.');
      const r = await passports.available(url.searchParams.get('label')).catch(() => ({ ok: false, reason: 'Could not check right now. Try again.' }));
      return send(res, 200, { ok: r.ok, ...(r.ok ? { label: r.label } : { reason: r.reason }) });
    }
    if (p === '/api/v1/passport' || p === '/api/v1/passport/public') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      if (!passports) throw new HttpError(503, 'Public passports are not set up on this server.');
      if (p === '/api/v1/passport' && method === 'GET') return send(res, 200, { passport: passports.get(user.id), parent: ensClient.parent });
      if (p === '/api/v1/passport' && method === 'POST') {
        const { label } = await readJson(req);
        try { return send(res, 202, { passport: await passports.start(user.id, label), parent: ensClient.parent }); }
        catch (e) { if (e instanceof PassportError) throw new HttpError(409, e.message); throw e; }
      }
      if (p === '/api/v1/passport/public' && method === 'POST') {
        const { public: flag } = await readJson(req);
        if (typeof flag !== 'boolean') throw new HttpError(400, 'public must be true or false.');
        const out = passports.setPublic(user.id, flag);
        if (!out) throw new HttpError(409, 'You do not have a passport yet.');
        return send(res, 200, { passport: out, parent: ensClient.parent });
      }
    }

    // ---- the advertiser page: public, read-only facts --------------------------------------------------------------
    if (p === '/api/v1/sponsors/info' && method === 'GET') {
      const addr = url.searchParams.get('address');
      if (addr) await sponsors.autoAdd(addr);
      return send(res, 200, {
        eventSlug: arkiv.eventSlug ?? process.env.ARKIV_EVENT_SLUG ?? 'ethglobal-mumbai-2026',
        arkivEnabled: arkiv.enabled,
        event: events.snapshot(events.main, nowMs()),
        events: events.list(nowMs()),
        organizer: arkiv.owner ?? null,
        approved: addr ? sponsors.isApproved(addr) || (!!arkiv.owner && addr.toLowerCase() === arkiv.owner.toLowerCase()) : null,
        spots: store.list().filter((s) => s.published).map((s) => ({ id: s.id, name: s.name, label: s.label, city: s.city, eventId: s.eventId ?? 'ethmumbai' })),
      });
    }
    if (p === '/api/v1/sponsors/campaigns' && method === 'GET') {
      const owner = url.searchParams.get('owner') ?? '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new HttpError(400, 'owner must be a wallet address.');
      if (!arkiv.enabled) return send(res, 200, { campaigns: [], approved: false });
      await sponsors.autoAdd(owner);
      const approved = sponsors.isApproved(owner) || owner.toLowerCase() === arkiv.owner.toLowerCase();
      const rows = await arkiv.readCampaignsFor(owner).catch(() => { throw new HttpError(502, 'Arkiv could not be read right now.'); });
      const campaigns = [];
      for (const r of rows) {
        const st = !spotLive(r.spotId) ? { shown: false, reason: 'the event has ended', impressions: 0, captures: null } : approved ? await ads.statusOf(r.$key) : { shown: false, reason: 'waiting for the organizer to approve this wallet', impressions: 0, captures: null };
        campaigns.push({ key: r.$key, spotId: r.spotId, status: r.status, startsAt: r.startsAt, endsAt: r.endsAt, sponsor: r.sponsor, headline: r.headline, clickUrl: r.clickUrl, width: r.width, height: r.height, expiresAtBlock: r.$expiresAt, ...st });
      }
      return send(res, 200, { approved, campaigns });
    }

    // ---- organizer: when the event ends (dashboard only) -------------------------------------------------------------
    if (p === '/api/event') {
      if (method === 'GET') return send(res, 200, events.snapshot(events.main, nowMs()));
      if (method === 'PUT') {
        const body = await readJson(req);
        try { await events.upsert({ ...events.main, ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}), ...(body.name ? { name: body.name } : {}) }); syncChainEvent(events.main.id); return send(res, 200, events.snapshot(events.main, nowMs())); } catch (e) { throw new HttpError(400, e.message); }
      }
    }
    if (p === '/api/events') {
      if (method === 'GET') return send(res, 200, { events: events.list(nowMs()), spots: store.list().reduce((m, x) => ({ ...m, [x.eventId ?? 'ethmumbai']: (m[x.eventId ?? 'ethmumbai'] ?? 0) + 1 }), {}) });
      if (method === 'POST') { try { const ev = await events.upsert(await readJson(req)); syncChainEvent(ev.id); return send(res, 201, { event: events.snapshot(ev, nowMs()) }); } catch (e) { throw new HttpError(400, e.message); } }
    }
    const evRoute = p.match(/^\/api\/events\/([a-z0-9-]+)$/);
    if (evRoute && method === 'DELETE') { try { return send(res, 200, { removed: await events.remove(evRoute[1]) }); } catch (e) { throw new HttpError(400, e.message); } }

    // ---- organizer: approve sponsor wallets (same-origin dashboard only) ------------------------------------------------
    if (p === '/api/sponsors') {
      if (method === 'GET') {
        const out = [];
        for (const sp of sponsors.list()) out.push({ ...sp, campaigns: arkiv.enabled ? await arkiv.readCampaignsFor(sp.address).then((r) => r.length).catch(() => null) : null });
        return send(res, 200, { sponsors: out, organizer: arkiv.owner ?? null, open: sponsors.isOpen(), openMax: sponsors.openMax });
      }
      if (method === 'POST') {
        const { address, name } = await readJson(req);
        try { return send(res, 201, { sponsor: await sponsors.add(address, name) }); } catch (e) { throw new HttpError(400, e.message); }
      }
    }
    if (p === '/api/sponsors/open' && method === 'PUT') {
      const { open } = await readJson(req);
      if (typeof open !== 'boolean') throw new HttpError(400, 'open must be true or false.');
      return send(res, 200, { open: await sponsors.setOpen(open) });
    }
    const spRoute = p.match(/^\/api\/sponsors\/(0x[0-9a-fA-F]{40})$/);
    if (spRoute && method === 'DELETE') return send(res, 200, { removed: await sponsors.remove(spRoute[1]) });

    // ---- sponsor ads: shown only after a verified capture at that spot ----------------------------------------------
    const adRoute = p.match(/^\/api\/v1\/spots\/([^/]+)\/ad$/);
    if (adRoute && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      if (!spotLive(adRoute[1])) return send(res, 200, { ad: null }); // ads end with their spot's event
      return send(res, 200, { ad: await ads.pick(adRoute[1], user).catch(() => null) });
    }
    if (p === '/api/v1/ads/impression' && method === 'POST') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      const { campaign } = await readJson(req);
      { const c = await ads.get(String(campaign ?? '')).catch(() => null); if (c && !spotLive(c.spotId)) return send(res, 200, { counted: false }); }
      return send(res, 200, await ads.record(user, String(campaign ?? '')));
    }
    if (p === '/api/v1/ads/stats' && method === 'GET') return send(res, 200, { campaigns: await ads.stats().catch(() => []), rejected: ads.rejected() }, cors);

    // ---- sign in with World ID ----------------------------------------------------------------------------------
    if (p === '/api/v1/auth/nonce' && method === 'POST') return send(res, 200, auth.request());
    if (p === '/api/v1/auth/verify' && method === 'POST') return send(res, 200, { ok: true, ...(await auth.verify(await readJson(req))) });
    if (p === '/api/v1/me' && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { user: { id: user.id } });
    }
    if (p === '/api/v1/auth/recovery' && method === 'POST') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { code: await auth.recoveryCode(user) });
    }
    if (p === '/api/v1/auth/restore' && method === 'POST') {
      // guesses are limited per address: 8 wrong tries in 10 minutes locks that address out for the rest of the window
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
      const now = Date.now();
      const log = (restoreFails.get(ip) ?? []).filter((t) => now - t < 600_000);
      if (log.length >= 8) throw new CaptureError('slow_down', 'Too many tries. Wait a few minutes and try again.', 429);
      const out = await auth.restore((await readJson(req)).code);
      if (!out) { log.push(now); restoreFails.set(ip, log); throw new CaptureError('bad_recovery', 'That recovery code was not recognised.', 400); }
      return send(res, 200, { ok: true, ...out });
    }
    if (p === '/api/v1/auth/signout' && method === 'POST') {
      await auth.signOut(bearer(req));
      return send(res, 200, { ok: true });
    }

    if (p === '/api/v1/vouchers' && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { vouchers: capture.vouchersFor(user), contract: voucherSigner?.contract ?? null, chainId: voucherSigner?.chainId ?? null });
    }

    // ---- capture: the backend decides (a signed-in person, a fresh World ID proof, evidence checked here) -----------
    if (p === '/api/v1/capture/nonce' && method === 'POST') {
      const { spotId } = await readJson(req);
      { const closed = eventGate(spotId); if (closed) throw closed; }
      return send(res, 200, capture.issue(auth.user(bearer(req)), spotId));
    }
    if (p === '/api/v1/capture/verify' && method === 'POST') {
      const who = auth.user(bearer(req));
      const body = await readJson(req);
      { const closed = eventGate(body?.spotId); if (closed) throw closed; }
      // a person has no wallet in the app yet: the server holds one for them (the same address that owns their passport name)
      const accepted = await capture.verify(who, { ...body, recipient: body?.recipient ?? (who && passports ? passports.ownerFor(who.id) : undefined) });
      if (chain.enabled && accepted.voucher) relayMint(accepted);
      passports?.onCapture(who.id); // a person with a public passport gets the new stamp published (in the background)
      return send(res, 200, { ok: true, capture: accepted });
    }

    // ---- uploaded files -----------------------------------------------------------------------------------------
    let m = p.match(/^\/files\/(models|images|ads)\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!SAFE_NAME.test(m[2])) throw new HttpError(400, 'Bad file name.');
      const dir = m[1] === 'models' ? store.modelsDir : m[1] === 'ads' ? ads.dir : store.imagesDir;
      let buf;
      try { buf = await readFile(path.join(dir, m[2])); } catch { throw new HttpError(404, 'No such file.'); }
      return send(res, 200, buf, { 'content-type': MIME[path.extname(m[2])] ?? 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', ...cors });
    }

    // ---- admin API ----------------------------------------------------------------------------------------------
    if (p === '/api/spots') {
      if (method === 'GET') return send(res, 200, { spots: store.list().map(withArkiv) });
      if (method === 'POST') {
        const { value, errors } = validateSpot(await readJson(req));
        if (errors.length) throw new HttpError(400, 'Some fields need fixing.', { issues: errors });
        const created = await store.create(value);
        syncChain(created);
        return send(res, 201, { spot: withArkiv(created) });
      }
    }
    m = p.match(/^\/api\/spots\/(\d+)$/);
    if (m) {
      const spot = needSpot(m[1]);
      if (method === 'GET') return send(res, 200, { spot: withArkiv(spot) });
      if (method === 'PUT') {
        const body = await readJson(req);
        const { value, errors } = validateSpot(body, { partial: true });
        // the radii are checked as a pair, so use the saved value for whichever one was not sent
        const cap = value.captureRadiusM ?? spot.captureRadiusM;
        const app = value.approachRadiusM ?? spot.approachRadiusM;
        if (app <= cap && !errors.some((e) => e.field === 'approachRadiusM')) errors.push({ field: 'approachRadiusM', message: 'The approach radius must be bigger than the capture radius.' });
        if (errors.length) throw new HttpError(400, 'Some fields need fixing.', { issues: errors });
        const saved = await store.update(spot.id, value);
        const arkivError = await syncArkiv(saved);
        syncChain(saved);
        return send(res, 200, { spot: withArkiv(saved), arkivError });
      }
      if (method === 'DELETE') {
        if (arkiv.enabled && arkiv.status(spot.id)) await arkiv.unpublish(spot.id).catch((e) => console.error('arkiv unpublish failed:', safeMessage(e)));
        if (chain.enabled && chain.status(spot.id)) chain.close(spot.id).catch((e) => console.error('chain close failed:', chainMsg(e))); // new stamps stop; minted ones stay
        await store.remove(spot.id);
        return send(res, 200, { ok: true });
      }
    }

    m = p.match(/^\/api\/spots\/(\d+)\/model$/);
    if (m) {
      const spot = needSpot(m[1]);
      if (method === 'PUT') {
        const buf = await readBody(req, LIMITS.maxBytes);
        let stats;
        try { stats = parseGlb(buf); } catch (e) { throw e instanceof GlbError ? new HttpError(400, e.message) : e; }
        const { warnings, sha256, bytes, ...rest } = stats;
        const info = { file: `${spot.id}-${sha256.slice(0, 10)}.glb`, bytes, sha256, uploadedAt: new Date().toISOString(), originalName: sanitizeName(req.headers['x-filename']), stats: rest, warnings };
        const withModel = await store.setFile(spot.id, 'model', info, buf);
        const arkivError = await syncArkiv(withModel);
        return send(res, 200, { spot: withArkiv(withModel), arkivError });
      }
      if (method === 'DELETE') {
        const without = await store.setFile(spot.id, 'model', null);
        const arkivError = await syncArkiv(without);
        return send(res, 200, { spot: withArkiv(without), arkivError });
      }
    }

    m = p.match(/^\/api\/spots\/(\d+)\/image$/);
    if (m) {
      const spot = needSpot(m[1]);
      if (method === 'PUT') {
        const buf = await readBody(req, MAX_IMAGE);
        const kind = IMAGE_MAGIC.find((k) => k.test(buf));
        if (!kind) throw new HttpError(400, 'The stamp image must be a PNG, JPEG or WebP file.');
        const info = { file: `${spot.id}-${createHash('sha256').update(buf).digest('hex').slice(0, 10)}${kind.ext}`, bytes: buf.length, uploadedAt: new Date().toISOString() };
        return send(res, 200, { spot: await store.setFile(spot.id, 'image', info, buf) });
      }
      if (method === 'DELETE') return send(res, 200, { spot: await store.setFile(spot.id, 'image', null) });
    }

    if (p.startsWith('/api/') || p.startsWith('/files/')) throw new HttpError(404, 'Not found.');

    // ---- the public passport page: /p/<label> is the share link; the page reads ENS itself
    if ((method === 'GET' || method === 'HEAD') && /^\/p\/[a-z0-9-]{1,32}\/?$/i.test(p)) {
      return send(res, 200, await readFile(path.join(publicDir, 'passport.html')), { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
    }

    // ---- the dashboard pages ------------------------------------------------------------------------------------
    if (method === 'GET' || method === 'HEAD') {
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
      const full = path.resolve(publicDir, rel);
      if (!full.startsWith(path.resolve(publicDir) + path.sep)) throw new HttpError(403, 'Forbidden.');
      let buf;
      try { buf = await readFile(full); } catch { throw new HttpError(404, 'Not found.'); }
      return send(res, 200, buf, { 'content-type': MIME[path.extname(full)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    }
    throw new HttpError(405, 'Method not allowed.');
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      await route(req, res, new URL(req.url, 'http://localhost'));
    } catch (e) {
      if (e instanceof CaptureError) send(res, e.status, { ok: false, code: e.code, error: e.message });
      else if (e instanceof HttpError) send(res, e.status, { error: e.message, ...(e.extra ?? {}) }, e.status === 413 ? { connection: 'close' } : {});
      else {
        console.error(e);
        send(res, 500, { error: 'Something went wrong on the server.' });
      }
    }
    log(`${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`);
  });

  return { server, store, captures, voucherSigner, arkiv, ads, sponsors, passports };
}
