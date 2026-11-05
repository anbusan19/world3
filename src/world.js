import { Linking } from 'react-native';
import { IDKit, proofOfHuman } from '@worldcoin/idkit-core/expo';
import { getFeedBase } from './spots';

// The real capture, from the phone's side. The phone only gathers evidence and asks World ID to prove the person is
// unique; the backend recomputes the distance, asks World's servers to check the proof, and decides.
//   1. ask the backend for a signed World ID request for this spot (it also remembers a one-time nonce)
//   2. open World App with that request and wait for the person to approve or decline
//   3. send the evidence and World's answer to the backend, which returns the capture or a refusal

// kind is what the result screen shows: 'unverified' | 'repeat' | 'far' | 'gps' | 'stale' | 'expired' | 'busy' | 'network'
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
  not_configured: 'network',
  no_spot: 'network',
};

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${getFeedBase()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'world3-app' }, body: JSON.stringify(body) });
  } catch {
    throw new CaptureFailure('network', 'Could not reach the World3 server.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new CaptureFailure(KIND_BY_CODE[data?.code] ?? 'network', data?.error ?? `The server answered ${res.status}.`);
  return data;
}

// onStage(0..2) tells the screen which step is running. Resolves with the accepted capture.
export async function captureWithWorldId({ spot, user, onStage }) {
  if (!user?.coords) throw new CaptureFailure('gps', 'We do not have your location yet.');
  const pose = { lat: user.coords[1], lng: user.coords[0], accuracyM: user.accuracy ?? 999, timestamp: Date.now() };

  onStage(0);
  const req = await post('/api/v1/capture/nonce', { spotId: spot.id });

  onStage(1);
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
      return_to: 'world3://capture',
    }).preset(proofOfHuman({ signal: spot.id }));
    await Linking.openURL(request.connectorURI);
    completion = await request.pollUntilCompletion({ timeout: 3 * 60 * 1000 });
  } catch {
    throw new CaptureFailure('unverified', 'World ID did not open. Install World App and try again.');
  }
  if (!completion.success) throw new CaptureFailure('unverified', 'World ID verification was cancelled or failed.');

  onStage(2);
  const out = await post('/api/v1/capture/verify', { spotId: spot.id, nonce: req.rp_context.nonce, pose, idkitResponse: completion.result });
  return out.capture;
}
