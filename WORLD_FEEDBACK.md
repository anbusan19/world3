# World ID integration debrief (work in progress)

Notes kept as we build, for the World prize. Updated as each step is tried.

## What we built
- `backend/src/capture.js`: the server issues an RP-signed World ID request per spot, verifies the proof with World's
  `/api/v4/verify/{rp_id}`, recomputes distance, and refuses repeats using the nullifier (one human, one stamp per spot).
- `src/world.js` and `src/screens/Capture.js`: the app opens World App via IDKit (`@worldcoin/idkit-core/expo`) and
  sends the result to the backend. The phone's own answer is never trusted.
- Credential: Proof of Human, the minimum that stops bot farms. Passport or selfie checks add friction for nothing here.
- Both refusal paths are real: not verified (declined, cancelled, or World rejects the proof) and repeat capture.

## Timeline and friction (so far)
- Creating the app, the RP and the action through the developer-portal MCP took a few calls and worked first time.
  Registration showed `pending`, then `registered` on both production and staging within seconds.
- The RP signing key is shown once at creation. Easy to miss; we saved it straight to a git-ignored `.env`.
- Docs name the signing package three ways (`@worldcoin/idkit-core/signing`, `@worldcoin/idkit/signing`,
  `@worldcoin/idkit-server`). We used `@worldcoin/idkit-server` on the backend.
- The integrate page has no React Native / Expo page, but `@worldcoin/idkit-core` ships an `/expo` entry point
  (needs `expo-crypto`). It bundles for Android. This should be documented.
- Not obvious from the docs: how the request `nonce` relates to the `nonce` in the proof response. We bind captures to
  the server's nonce and check it matches; confirm against a real proof.
- Not obvious: how `signal` maps to `signal_hash` for 4.0 uniqueness proofs, so we cannot check the signal server-side.

## Confirmed on a real Android phone (sign in with World ID)
- IDKit's `connectorURI` opens World App directly from a React Native app via `Linking.openURL`. No QR needed on the phone.
- World App shows "World3 will see these proofs: Unique Human", then "Presenting"; our app got the result back by polling
  (`pollUntilCompletion`) and the server's `/api/v4/verify/{rp_id}` accepted it on the first try.
- The `nonce` in the proof result equals the nonce in the RP signature we issued, so we can bind a proof to our request.
- Used for two actions: `signin` (an account from the nullifier) and `capture` (a fresh check per spot). A proof for one
  action is refused for the other.
- Time to first success once the app, RP and action existed and the phone had World App: about 15 minutes, almost all of it
  our own mistakes (a stale server address saved on the phone, Wi-Fi off), not World's.

## Confirmed: a full capture on a real phone
- World ID sign-in, then a capture at a spot 3 m away with a ±4 m GPS fix: the server recomputed the distance, World's
  `/api/v4/verify` accepted the per-spot proof (`capture-06`), and the capture was recorded for that account.
- IDKit surfaced the real reason for failures as `nullifier_replayed` once we logged `completion.error`; World App itself
  only said "Your credentials don't meet World3's requirements".

## A mistake that cost us time (worth a doc note)
- We used one `capture` action for every spot. The first capture worked; the second, on another spot, made World App say
  "Verification failed. Your credentials don't meet World3's requirements." That message gave no hint that the cause was
  reusing an action. A nullifier is derived from the person plus the action, so one action means one proof per person.
  Fix: one action per spot (`capture-<spotId>`), created in the portal. Docs should say this next to the nullifier text,
  and World App should say "already used for this action" instead of "credentials don't meet requirements".
- Same limit for sign-in: a second sign-in proof for the `signin` action is refused, so a signed-out person cannot sign back
  in on a new phone with that proof. A session proof (`session_id`) is probably the right tool; not built yet.

## Still to confirm on a real device
- Returning to our app automatically with `return_to` (it came back on its own here; check it on a clean install).
- Testing with the simulator and `environment: "staging"` end to end.

## Highest-impact improvement (draft)
A short React Native / Expo guide with a working example, including the deep-link return.
