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

export async function createApp({ dataDir, publicDir, host = '127.0.0.1', log = () => {}, capture: captureOpts = {}, arkiv: arkivOpts = {}, ens: ensOpts = {} }) {
  const store = new Store(dataDir);
  await store.init(SEED);
  const arkiv = await createArkiv({ dataDir, ...arkivOpts });
  const captures = new Captures(dataDir);
  await captures.init();
  const accounts = new Accounts(dataDir);
  await accounts.init();
  const world = createWorld({ config: captureOpts.worldConfig ?? worldConfigFromEnv(), fetchImpl: captureOpts.fetchImpl, now: captureOpts.now });
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
  const capture = createCaptureService({ store, captures, world, accounts, voucherSigner, config: captureOpts.config ?? captureConfigFromEnv(), now: captureOpts.now });
  const auth = createAuthService({ world, accounts, action: captureOpts.signinAction ?? process.env.WORLD_ID_SIGNIN_ACTION ?? 'signin', now: captureOpts.now });
  const bearer = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  const hostOk = (h) => !loopback || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h ?? ''); // blocks DNS-rebinding

  // Arkiv: a spot is public there only when it is published AND the organizer ticked "On Arkiv". A failure never blocks saving.
  const arkivInfo = (id) => (arkiv.enabled ? arkiv.status(id) : null);
  const withArkiv = (spot) => ({ ...spot, arkivInfo: arkivInfo(spot.id), arkivEnabled: arkiv.enabled });
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
      if (!['world3-dashboard', 'world3-app'].includes(req.headers['x-requested-with'])) throw new HttpError(403, 'Missing X-Requested-With header.');
    }

    if (p === '/api/health') return send(res, 200, { ok: true, spots: store.list().length });

    // ---- the app's feed -----------------------------------------------------------------------------------------
    if (p === '/api/v1/spots' && method === 'GET') {
      // NOTE: the README wants the app to see only coarse locations and the server to decide capture, so exact
      // coordinates here are a prototype shortcut. Round them (or drop them) before a real launch.
      const body = JSON.stringify({ spots: store.list().filter((s) => s.published).map((s) => { const a = arkivInfo(s.id); return { ...toPublic(s), ...(a && s.onArkiv ? { arkiv: { entityKey: a.entityKey, owner: a.owner, expiresOn: a.expiresOn } } : {}) }; }) });
      const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
      if (req.headers['if-none-match'] === etag) return send(res, 304, '', { etag, ...cors });
      return send(res, 200, body, { 'content-type': 'application/json; charset=utf-8', etag, 'cache-control': 'no-cache', ...cors });
    }

    // what is public on Arkiv right now, read back from the chain (anyone can run the same query without this server)
    if (p === '/api/v1/arkiv/spots' && method === 'GET') {
      if (!arkiv.enabled) throw new HttpError(503, 'Arkiv is not configured on this server.');
      return send(res, 200, { owner: arkiv.owner, eventSlug: arkiv.eventSlug, schema: 'world3.spot', spots: await arkiv.list() }, cors);
    }

    // the person's own captures (so the app can show their stamps again after a restart or on a new phone)
    if (p === '/api/v1/me/captures' && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { captures: captures.items.filter((c) => c.userId === user.id).map((c) => ({ spotId: c.spotId, at: c.at })) });
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
      return send(res, 200, {
        eventSlug: arkiv.eventSlug ?? process.env.ARKIV_EVENT_SLUG ?? 'ethglobal-mumbai-2026',
        arkivEnabled: arkiv.enabled,
        organizer: arkiv.owner ?? null,
        approved: addr ? sponsors.isApproved(addr) || (!!arkiv.owner && addr.toLowerCase() === arkiv.owner.toLowerCase()) : null,
        spots: store.list().filter((s) => s.published).map((s) => ({ id: s.id, name: s.name, label: s.label, city: s.city })),
      });
    }
    if (p === '/api/v1/sponsors/campaigns' && method === 'GET') {
      const owner = url.searchParams.get('owner') ?? '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new HttpError(400, 'owner must be a wallet address.');
      if (!arkiv.enabled) return send(res, 200, { campaigns: [], approved: false });
      const approved = sponsors.isApproved(owner) || owner.toLowerCase() === arkiv.owner.toLowerCase();
      const rows = await arkiv.readCampaignsFor(owner).catch(() => { throw new HttpError(502, 'Arkiv could not be read right now.'); });
      const campaigns = [];
      for (const r of rows) {
        const st = approved ? await ads.statusOf(r.$key) : { shown: false, reason: 'waiting for the organizer to approve this wallet', impressions: 0, captures: null };
        campaigns.push({ key: r.$key, spotId: r.spotId, status: r.status, startsAt: r.startsAt, endsAt: r.endsAt, sponsor: r.sponsor, headline: r.headline, clickUrl: r.clickUrl, width: r.width, height: r.height, expiresAtBlock: r.$expiresAt, ...st });
      }
      return send(res, 200, { approved, campaigns });
    }

    // ---- organizer: approve sponsor wallets (same-origin dashboard only) ------------------------------------------------
    if (p === '/api/sponsors') {
      if (method === 'GET') {
        const out = [];
        for (const sp of sponsors.list()) out.push({ ...sp, campaigns: arkiv.enabled ? await arkiv.readCampaignsFor(sp.address).then((r) => r.length).catch(() => null) : null });
        return send(res, 200, { sponsors: out, organizer: arkiv.owner ?? null });
      }
      if (method === 'POST') {
        const { address, name } = await readJson(req);
        try { return send(res, 201, { sponsor: await sponsors.add(address, name) }); } catch (e) { throw new HttpError(400, e.message); }
      }
    }
    const spRoute = p.match(/^\/api\/sponsors\/(0x[0-9a-fA-F]{40})$/);
    if (spRoute && method === 'DELETE') return send(res, 200, { removed: await sponsors.remove(spRoute[1]) });

    // ---- sponsor ads: shown only after a verified capture at that spot ----------------------------------------------
    const adRoute = p.match(/^\/api\/v1\/spots\/([^/]+)\/ad$/);
    if (adRoute && method === 'GET') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      return send(res, 200, { ad: await ads.pick(adRoute[1], user).catch(() => null) });
    }
    if (p === '/api/v1/ads/impression' && method === 'POST') {
      const user = auth.user(bearer(req));
      if (!user) throw new CaptureError('signed_out', 'Not signed in.', 401);
      const { campaign } = await readJson(req);
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
      return send(res, 200, capture.issue(auth.user(bearer(req)), spotId));
    }
    if (p === '/api/v1/capture/verify' && method === 'POST') {
      const who = auth.user(bearer(req));
      const accepted = await capture.verify(who, await readJson(req));
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
        return send(res, 201, { spot: withArkiv(await store.create(value)) });
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
        return send(res, 200, { spot: withArkiv(saved), arkivError });
      }
      if (method === 'DELETE') {
        if (arkiv.enabled && arkiv.status(spot.id)) await arkiv.unpublish(spot.id).catch((e) => console.error('arkiv unpublish failed:', safeMessage(e)));
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
