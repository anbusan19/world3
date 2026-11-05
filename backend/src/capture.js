import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isAddress } from 'viem';
import { CaptureError, refusal } from './world.js';

// The capture verifier. The phone only sends evidence; this decides. A capture is accepted only when
//   1. the nonce is one we issued for this spot, is not expired, and has not been used (single use),
//   2. the location evidence is fresh, accurate enough, and inside the spot's capture radius (distance is recomputed here),
//   3. World ID accepts the proof when we ask World's servers (the phone's own answer is never trusted), and
//   4. this human (World ID nullifier) has not already captured this spot.
// Every refusal has a short code the app shows as a plain message. Nothing is issued on a refusal.

export { CaptureError, refusal } from './world.js';

export function distanceMeters(a, b) {
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

export function createCaptureService({ store, captures, world, accounts, voucherSigner = null, config = {}, now = () => Date.now() }) {
  const c = { action: 'capture', maxAccuracyM: 25, maxAgeMs: 60_000, ...config };
  // One World ID action per spot. A person's nullifier is derived from the action, so a separate action per spot is what
  // makes "one human, one stamp per spot" work: a single shared action would let each person prove only once, ever.
  const actionFor = (spotId) => `${c.action}-${spotId}`;

  // Step 1: a signed-in person asks to capture a spot. We sign a World ID request for it and remember the nonce.
  function issue(user, spotId) {
    if (!user) throw refusal('signed_out', 401);
    const spot = store.get(String(spotId));
    if (!spot || !spot.published) throw new CaptureError('no_spot', 'There is no such spot.', 404);
    return world.sign(actionFor(spot.id), { spotId: spot.id, userId: user.id });
  }

  // Step 2: the app sends its evidence and the World ID result. Returns the accepted capture or throws a CaptureError.
  async function verify(user, { spotId, nonce, pose, idkitResponse, recipient }) {
    if (!user) throw refusal('signed_out', 401);
    // the wallet that will hold the stamp; checked before anything is spent, so a typo does not burn the person's request
    if (voucherSigner && !isAddress(recipient ?? '')) throw new CaptureError('bad_recipient', 'A wallet address is needed to receive the stamp.', 400);
    // the nonce first, and it is burned straight away: whatever happens next, this request cannot be replayed
    const meta = world.take(nonce, actionFor(String(spotId)));
    if (!meta || meta.spotId !== String(spotId) || meta.userId !== user.id) throw refusal('nonce');
    const spot = store.get(meta.spotId);
    if (!spot || !spot.published) throw new CaptureError('no_spot', 'There is no such spot.', 404);

    // location evidence
    const lat = Number(pose?.lat), lng = Number(pose?.lng), acc = Number(pose?.accuracyM), ts = Number(pose?.timestamp);
    if (![lat, lng, acc, ts].every(Number.isFinite)) throw new CaptureError('bad_request', 'The location evidence is missing or malformed.', 400);
    if (Math.abs(now() - ts) > c.maxAgeMs) throw refusal('stale');
    if (acc > c.maxAccuracyM) throw refusal('poor_accuracy');
    if (distanceMeters({ lat, lng }, { lat: spot.lat, lng: spot.lng }) > spot.captureRadiusM) throw refusal('too_far');

    // World's servers must accept the proof (for this spot's action only)
    const nullifier = await world.verifyProof(idkitResponse, nonce, actionFor(spot.id));
    // the nullifier is per spot, so a repeat is the same person asking again for the same spot
    if (captures.has(spot.id, nullifier)) throw refusal('already_captured');

    // the capture is accepted: sign the mint voucher (only the backend can; the contract mints against nothing else)
    const voucher = voucherSigner ? await voucherSigner.sign({ recipient, spotId: spot.id }) : null;
    const capture = { id: randomUUID(), spotId: spot.id, userId: user.id, nullifier, at: new Date(now()).toISOString(), ...(voucher ? { voucher } : {}) };
    await captures.add(capture);
    return { id: capture.id, spotId: spot.id, at: capture.at, voucher };
  }

  // the signed-in person's own vouchers (so a lost response, or a new install, does not lose a stamp)
  const vouchersFor = (user) => captures.items.filter((x) => x.userId === user.id && x.voucher).map((x) => ({ captureId: x.id, spotId: x.spotId, at: x.at, ...x.voucher }));

  return { issue, verify, vouchersFor, config: c };
}

export function captureConfigFromEnv(env = process.env) {
  return {
    action: env.WORLD_ID_ACTION || 'capture',
    maxAccuracyM: Number(env.MAX_ACCURACY_M) || 25,
  };
}
