import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { signRequest } from '@worldcoin/idkit-server';

// The capture verifier. The phone only sends evidence; this decides. A capture is accepted only when
//   1. the nonce is one we issued for this spot, is not expired, and has not been used (single use),
//   2. the location evidence is fresh, accurate enough, and inside the spot's capture radius (distance is recomputed here),
//   3. World ID accepts the proof when we ask World's servers (the phone's own answer is never trusted), and
//   4. this human (World ID nullifier) has not already captured this spot.
// Every refusal has a short code the app shows as a plain message. Nothing is issued on a refusal.

export class CaptureError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const REFUSALS = {
  nonce: 'That capture request has expired or was already used. Start the capture again.',
  too_far: 'You are too far from the spot to capture it.',
  poor_accuracy: 'Your location signal is too weak. Move to open sky and try again.',
  stale: 'Your location reading is out of date. Try again.',
  not_verified: 'We could not confirm you are a unique human. Verify with World ID and try again.',
  already_captured: 'One human can capture each spot once. This one is already in your passport.',
};
export const refusal = (code) => new CaptureError(code, REFUSALS[code]);

export function distanceMeters(a, b) {
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "0xAB…" or a decimal string -> the same BigInt either way, so one human is one key whatever the casing.
function normaliseNullifier(v) {
  try { return BigInt(String(v)).toString(); } catch { return null; }
}
const sameHex = (a, b) => { try { return BigInt(a) === BigInt(b); } catch { return false; } };

export class Captures {
  #queue = Promise.resolve();

  constructor(dir) {
    this.file = path.join(dir, 'captures.json');
    this.items = []; // { id, spotId, nullifier, at }
  }

  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) this.items = JSON.parse(await readFile(this.file, 'utf8')).captures ?? [];
  }

  has(spotId, nullifier) {
    return this.items.some((c) => c.spotId === spotId && c.nullifier === nullifier);
  }

  add(item) {
    this.items.push(item);
    const data = JSON.stringify({ version: 1, captures: this.items }, null, 2);
    this.#queue = this.#queue.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.#queue;
  }
}

export function createCaptureService({ store, captures, config, fetchImpl = fetch, now = () => Date.now() }) {
  const c = {
    action: 'capture',
    environment: 'production',
    worldBase: 'https://developer.world.org',
    maxAccuracyM: 25,
    maxAgeMs: 60_000,
    nonceTtlS: 120,
    ...config,
  };
  const pending = new Map(); // nonce -> { spotId, expiresAt }
  const key = (n) => String(n).toLowerCase();

  const ready = () => {
    if (!c.appId || !c.rpId || !c.signingKey) throw new CaptureError('not_configured', 'World ID is not configured on this server.', 503);
  };

  // Step 1: the app asks to capture a spot. We sign a World ID request for it and remember the nonce.
  function issue(spotId) {
    ready();
    const spot = store.get(String(spotId));
    if (!spot || !spot.published) throw new CaptureError('no_spot', 'There is no such spot.', 404);
    const sig = signRequest({ signingKeyHex: c.signingKey, action: c.action, ttl: c.nonceTtlS });
    pending.set(key(sig.nonce), { spotId: spot.id, expiresAt: sig.expiresAt * 1000 });
    for (const [n, v] of pending) if (v.expiresAt < now()) pending.delete(n); // forget old ones
    return {
      app_id: c.appId,
      action: c.action,
      environment: c.environment,
      rp_context: { rp_id: c.rpId, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
    };
  }

  // Step 2: the app sends its evidence and the World ID result. Returns the accepted capture or throws a CaptureError.
  async function verify({ spotId, nonce, pose, idkitResponse }) {
    ready();
    // nonce first, and burn it straight away: whatever happens next, this request cannot be replayed
    const entry = pending.get(key(nonce));
    pending.delete(key(nonce));
    if (!entry || entry.expiresAt < now() || entry.spotId !== String(spotId)) throw refusal('nonce');
    const spot = store.get(entry.spotId);
    if (!spot || !spot.published) throw new CaptureError('no_spot', 'There is no such spot.', 404);

    // location evidence
    const lat = Number(pose?.lat), lng = Number(pose?.lng), acc = Number(pose?.accuracyM), ts = Number(pose?.timestamp);
    if (![lat, lng, acc, ts].every(Number.isFinite)) throw new CaptureError('bad_request', 'The location evidence is missing or malformed.', 400);
    if (Math.abs(now() - ts) > c.maxAgeMs) throw refusal('stale');
    if (acc > c.maxAccuracyM) throw refusal('poor_accuracy');
    const sLat = spot.lat, sLng = spot.lng;
    if (distanceMeters({ lat, lng }, { lat: sLat, lng: sLng }) > spot.captureRadiusM) throw refusal('too_far');

    // the proof must be for the request we issued, then World's servers must accept it
    if (!idkitResponse || typeof idkitResponse !== 'object') throw refusal('not_verified');
    if (idkitResponse.nonce !== undefined && !sameHex(idkitResponse.nonce, nonce)) throw refusal('not_verified');
    if (idkitResponse.environment !== c.environment) throw refusal('not_verified');
    let result;
    try {
      const r = await fetchImpl(`${c.worldBase}/api/v4/verify/${c.rpId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...idkitResponse, environment: c.environment }),
      });
      result = await r.json();
    } catch {
      throw new CaptureError('world_unreachable', 'World ID could not be reached. Try again in a moment.', 502);
    }
    if (result?.success !== true || result?.environment !== c.environment) throw refusal('not_verified');

    // one human, one stamp per spot (World ID makes the same person produce the same nullifier for this action)
    const nullifier = normaliseNullifier(result.nullifier ?? result.results?.[0]?.nullifier);
    if (!nullifier) throw refusal('not_verified');
    if (captures.has(spot.id, nullifier)) throw refusal('already_captured');

    const capture = { id: randomUUID(), spotId: spot.id, nullifier, at: new Date(now()).toISOString() };
    await captures.add(capture);
    // TODO(next): sign the EIP-712 mint voucher here and return it with the capture.
    return { id: capture.id, spotId: spot.id, at: capture.at };
  }

  return { issue, verify, config: c };
}

export function captureConfigFromEnv(env = process.env) {
  return {
    appId: env.WORLD_ID_APP_ID,
    rpId: env.WORLD_ID_RP_ID,
    signingKey: env.WORLD_ID_SIGNING_KEY,
    action: env.WORLD_ID_ACTION || 'capture',
    environment: env.WORLD_ID_ENV || 'production',
    maxAccuracyM: Number(env.MAX_ACCURACY_M) || 25,
    nonceTtlS: Number(env.NONCE_TTL_SECONDS) || 120,
  };
}
