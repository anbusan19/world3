import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { IDKit, proofOfHuman } from '@worldcoin/idkit-core/expo';
import { getFeedBase } from './spots';

// The real capture, from the phone's side. The phone only gathers evidence and asks World ID to prove the person is
// unique; the backend recomputes the distance, asks World's servers to check the proof, and decides.
//   1. ask the backend for a signed World ID request for this spot (it also remembers a one-time nonce)
//   2. open World App with that request and wait for the person to approve or decline
//   3. send the evidence and World's answer to the backend, which returns the capture or a refusal

// kind is what the screen shows: 'unverified' | 'repeat' | 'far' | 'gps' | 'stale' | 'expired' | 'busy' | 'network' | 'signedout'
export class CaptureFailure extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const KIND_BY_CODE = {
  not_verified: 'unverified',
  already_captured: 'repeat',
  too_far: 'far',
  poor_accuracy: 'gps',
  stale: 'stale',
  nonce: 'expired',
  world_unreachable: 'busy',
  signed_out: 'signedout',
  event_over: 'ended',
  not_configured: 'network',
  no_spot: 'network',
};

// The signed-in session: a random token the server gave us after a World ID proof. Kept in the phone's secure store.
const TOKEN_KEY = 'world3.session';
let token = null;
const headers = () => ({ 'content-type': 'application/json', 'x-requested-with': 'world3-app', ...(token ? { authorization: `Bearer ${token}` } : {}) });

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${getFeedBase()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  } catch {
    throw new CaptureFailure('network', 'Could not reach the World3 server.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new CaptureFailure(KIND_BY_CODE[data?.code] ?? 'network', data?.error ?? `The server answered ${res.status}.`);
  return data;
}

// Open World App with a signed request and wait for the person to approve or decline. Resolves with World's result.
async function askWorldId(req, signal) {
  let completion;
  try {
    const request = await IDKit.request({
      app_id: req.app_id,
      action: req.action,
      rp_context: {
        rp_id: req.rp_context.rp_id,
        nonce: req.rp_context.nonce,
        created_at: req.rp_context.created_at,
        expires_at: req.rp_context.expires_at,
        signature: req.rp_context.signature,
      },
      allow_legacy_proofs: false,
      environment: req.environment,
      return_to: 'world3://verify',
    }).preset(proofOfHuman({ signal }));
    await Linking.openURL(request.connectorURI);
    completion = await request.pollUntilCompletion({ timeout: 3 * 60 * 1000 });
  } catch (e) {
    if (__DEV__) console.log('[world] request failed', String(e?.message ?? e));
    throw new CaptureFailure('unverified', `World ID did not open (${String(e?.message ?? e).slice(0, 80)}). Install World App and try again.`);
  }
  if (!completion.success) {
    if (__DEV__) console.log('[world] not completed:', JSON.stringify(completion.error));
    throw new CaptureFailure('unverified', `World ID verification did not finish (${String(completion.error)}).`);
  }
  return completion.result;
}

// ---- session ----------------------------------------------------------------------------------------------------

// On launch: is the saved session still good? Resolves with the user, or null. If the server cannot be reached we keep the
// session (and let the person in) instead of signing them out for a bad connection.
export async function loadSession() {
  try { token = await SecureStore.getItemAsync(TOKEN_KEY); } catch { token = null; }
  if (!token) return null;
  try {
    const res = await fetch(`${getFeedBase()}/api/v1/me`, { headers: headers() });
    if (res.status === 401) { await clearToken(); return null; }
    if (!res.ok) return { id: null, offline: true };
    return (await res.json()).user;
  } catch {
    return { id: null, offline: true };
  }
}

async function clearToken() {
  token = null;
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* nothing stored */ }
}

// Sign in with World ID: one proof of human makes (or finds) your account. onStage(0..1) drives the progress list.
export async function signInWithWorldId({ onStage = () => {} } = {}) {
  onStage(0);
  const req = await post('/api/v1/auth/nonce', {});
  onStage(1);
  const result = await askWorldId(req, 'signin');
  onStage(2);
  const out = await post('/api/v1/auth/verify', { nonce: req.rp_context.nonce, idkitResponse: result });
  token = out.token;
  try { await SecureStore.setItemAsync(TOKEN_KEY, token); } catch { /* stays signed in until the app closes */ }
  return out.user;
}

export async function signOut() {
  const old = token;
  await clearToken();
  if (old) { try { await fetch(`${getFeedBase()}/api/v1/auth/signout`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'world3-app', authorization: `Bearer ${old}` }, body: '{}' }); } catch { /* the token is gone from the phone either way */ } }
}

// ---- capture ----------------------------------------------------------------------------------------------------

// onStage(0..2) tells the screen which step is running. Resolves with the accepted capture.
export async function captureWithWorldId({ spot, user, onStage }) {
  if (!user?.coords) throw new CaptureFailure('gps', 'We do not have your location yet.');
  const pose = { lat: user.coords[1], lng: user.coords[0], accuracyM: user.accuracy ?? 999, timestamp: Date.now() };

  onStage(0);
  const req = await post('/api/v1/capture/nonce', { spotId: spot.id });

  onStage(1);
  const result = await askWorldId(req, spot.id);

  onStage(2);
  const out = await post('/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose, idkitResponse: result });
  return out.capture;
}

// ---- sponsor ads ------------------------------------------------------------------------------------------------

// The sponsor ad for a spot, or null. The server only returns one to a signed-in person who has already made a verified
// capture there, and only from sponsor wallets the organizer approved. A failure here must never get in the way of the stamp.
export async function fetchAd(spotId) {
  try {
    const res = await fetch(`${getFeedBase()}/api/v1/spots/${encodeURIComponent(spotId)}/ad`, { headers: headers() });
    if (!res.ok) return null;
    const { ad } = await res.json();
    return ad ? { ...ad, imageUrl: `${getFeedBase()}${ad.creativeUrl}` } : null;
  } catch {
    return null;
  }
}

// Tell the server the person really saw it (counted once per person per campaign).
export function reportImpression(campaignKey) {
  fetch(`${getFeedBase()}/api/v1/ads/impression`, { method: 'POST', headers: headers(), body: JSON.stringify({ campaign: campaignKey }) }).catch(() => {});
}

// ---- public passport (opt-in, on ENS) ---------------------------------------------------------------------------

// { passport: { status: 'none'|'creating'|'ready'|'error', name?, path?, url?, published?, stamps?, error? }, parent } or null when the
// server has no passports or the person is signed out.
export async function getPassport() {
  try {
    const res = await fetch(`${getFeedBase()}/api/v1/passport`, { headers: headers() });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Asking for a passport is the consent to publish: creation takes about a minute and runs on the server.
export async function startPassport(label) {
  return post('/api/v1/passport', label ? { label } : {});
}

// Is this name allowed and free? { ok: true, label } or { ok: false, reason }
export async function checkPassportName(label) {
  const unsure = { ok: false, reason: 'Could not check right now.' };
  try {
    const res = await fetch(`${getFeedBase()}/api/v1/passport/name?label=${encodeURIComponent(label)}`, { headers: headers() });
    return res.ok ? await res.json() : unsure;
  } catch {
    return unsure;
  }
}

export async function setPassportPublic(flag) {
  return post('/api/v1/passport/public', { public: !!flag });
}

// The spots this person has captured, from the server: [{ spotId, at }]. The app keeps stamps in memory, so after a restart it asks again.
export async function fetchMyCaptures() {
  try {
    const res = await fetch(`${getFeedBase()}/api/v1/me/captures`, { headers: headers() });
    return res.ok ? (await res.json()).captures : [];
  } catch {
    return [];
  }
}

// The public explorer feed: recent stamps across everyone, no personal data. { total, items, spots }
export async function fetchExplorer({ limit = 10, offset = 0, q = '', spot = '' } = {}) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const u = `${getFeedBase()}/api/v1/explorer?limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}&spot=${encodeURIComponent(spot)}`;
    const res = await fetch(u, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// The full explorer lives on the website. It only works from a phone when the spot server has a public https address.
export function explorerUrl() {
  const base = getFeedBase();
  return /^https:\/\//i.test(base) ? `${base}/explorer.html` : null;
}
