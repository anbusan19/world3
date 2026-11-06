import { signRequest } from '@worldcoin/idkit-server';

// Everything that talks to World ID, shared by sign-in and capture:
//   sign(action, meta)  -> a World ID request signed with the RP key, plus a one-time nonce we remember with `meta`
//   take(nonce, action) -> the remembered `meta` for that nonce, once (it is burned), or null if unknown/expired/other action
//   verifyProof(...)    -> asks World's servers to check the proof; returns the nullifier as a decimal string
// The signing key never leaves this file's config, and a proof made for one action can never be used for another.

export class CaptureError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const REFUSALS = {
  nonce: 'That request has expired or was already used. Start again.',
  too_far: 'You are too far from the spot to capture it.',
  poor_accuracy: 'Your location signal is too weak. Move to open sky and try again.',
  stale: 'Your location reading is out of date. Try again.',
  not_verified: 'We could not confirm you are a unique human. Verify with World ID and try again.',
  already_captured: 'One human can capture each spot once. This one is already in your passport.',
  signed_out: 'Sign in with World ID first.',
};
export const refusal = (code, status) => new CaptureError(code, REFUSALS[code], status);

const sameHex = (a, b) => { try { return BigInt(a) === BigInt(b); } catch { return false; } };
export function normaliseNullifier(v) {
  try { return BigInt(String(v)).toString(); } catch { return null; }
}

export function createWorld({ config, fetchImpl = fetch, now = () => Date.now() }) {
  const c = { environment: 'production', worldBase: 'https://developer.world.org', nonceTtlS: 120, credentials: ['proof_of_human', 'passport', 'selfie'], ...config };
  const pending = new Map(); // nonce -> { action, meta, expiresAt }
  const key = (n) => String(n).toLowerCase();

  const ready = () => {
    if (!c.appId || !c.rpId || !c.signingKey) throw new CaptureError('not_configured', 'World ID is not configured on this server.', 503);
  };

  function sign(action, meta = {}) {
    ready();
    const sig = signRequest({ signingKeyHex: c.signingKey, action, ttl: c.nonceTtlS });
    pending.set(key(sig.nonce), { action, meta, expiresAt: sig.expiresAt * 1000 });
    for (const [n, v] of pending) if (v.expiresAt < now()) pending.delete(n);
    return {
      app_id: c.appId,
      action,
      environment: c.environment,
      rp_context: { rp_id: c.rpId, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
    };
  }

  function take(nonce, action) {
    const entry = pending.get(key(nonce));
    pending.delete(key(nonce)); // burned whatever happens next, so a request can never be replayed
    if (!entry || entry.expiresAt < now() || entry.action !== action) return null;
    return entry.meta;
  }

  async function verifyProof(idkitResponse, nonce, action) {
    ready();
    if (!idkitResponse || typeof idkitResponse !== 'object') throw refusal('not_verified');
    if (idkitResponse.nonce !== undefined && !sameHex(idkitResponse.nonce, nonce)) throw refusal('not_verified');
    if (idkitResponse.action !== undefined && idkitResponse.action !== action) throw refusal('not_verified');
    if (idkitResponse.environment !== c.environment) throw refusal('not_verified');
    let result;
    try {
      const r = await fetchImpl(`${c.worldBase}/api/v4/verify/${c.rpId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...idkitResponse, action, environment: c.environment }),
      });
      result = await r.json();
    } catch {
      throw new CaptureError('world_unreachable', 'World ID could not be reached. Try again in a moment.', 502);
    }
    if (result?.success !== true || result?.environment !== c.environment) throw refusal('not_verified');
    // only the credentials we accept: a client could ask World App for a weaker one than we want
    const ids = (Array.isArray(idkitResponse.responses) ? idkitResponse.responses : []).map((r) => r?.identifier).filter(Boolean);
    if (ids.length && !ids.some((id) => c.credentials.includes(id))) throw refusal('not_verified');
    const nullifier = normaliseNullifier(result.nullifier ?? result.results?.[0]?.nullifier);
    if (!nullifier) throw refusal('not_verified');
    return nullifier;
  }

  return { sign, take, verifyProof, config: c };
}

export function worldConfigFromEnv(env = process.env) {
  return {
    appId: env.WORLD_ID_APP_ID,
    rpId: env.WORLD_ID_RP_ID,
    signingKey: env.WORLD_ID_SIGNING_KEY,
    environment: env.WORLD_ID_ENV || 'production',
    nonceTtlS: Number(env.NONCE_TTL_SECONDS) || 120,
    credentials: String(env.WORLD_ID_CREDENTIALS || 'proof_of_human,passport,selfie').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
