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

## Still to confirm on a real device
- Opening World App from a React Native app via `connectorURI` and returning with `return_to`.
- Testing with the simulator and `environment: "staging"` end to end.

## Highest-impact improvement (draft)
A short React Native / Expo guide with a working example, including the deep-link return.
