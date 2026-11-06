# wrld3 — World ID integration debrief

Prize: **Best Use of IDKit**. App: wrld3, an Android app where you visit real places and keep a non-transferable stamp for each one.

## The trust moment

A stamp means "a real person was here". Claiming a stamp is the one moment where the product needs to know something about the person: that they are a unique human who has not already claimed this spot. If one person (or a script) can claim every spot, stamps, sponsor ad impressions and any future payouts are worthless.

## Why Proof of Human is the minimum sufficient credential

The only fact we need is "one unique human". We do not need a name, a document, an age or a face. Proof of Human gives exactly that, and nothing else leaves the person's World ID. Passport/NFC and Selfie Check would add assurance we do not use.

Each spot has its own action (`capture-<spot id>`), so:
- the same person gets one stamp per spot, and a second claim is refused (replayed nullifier);
- proofs for different spots cannot be linked to each other.

Sign-in uses its own action. Flow: the app builds the request with `@worldcoin/idkit-core`, opens World App, receives the result, and sends it to our server. The server verifies it against `/api/v4/verify/{rp_id}`, checks the credential identifier is one we accept, and only then signs the mint voucher.

## The paths we demonstrate

| Path | What happens |
| --- | --- |
| Success | Verified at the spot, the server signs a voucher, the stamp is minted on Sepolia. |
| Cancelled in World App | No proof is returned, the app shows it, nothing is minted. |
| Already claimed (`nullifier_replayed`) | The server refuses, no second stamp. |
| Credential we do not accept | The server refuses a proof whose credential is not in the allowed list. |
| Not at the spot | Refused before the World ID result is used, with the reason. |

## Integration debrief

**Time to first success:** _fill in: how long from starting to the first verified proof on a device._

**Friction we hit (all real, all resolved):**
1. **`nullifier_replayed` on returning users.** A person who signed in once could not sign in again on the same action, which broke reinstalling or a second phone. We moved sign-in to a new action and added recovery codes (a saved 100-bit code, stored hashed) for returning users.
2. **Return link after renaming the app.** World App could not open the app after we renamed it ("no app found to open"), because the URL scheme in the request (`wrld3://verify`) no longer matched the scheme registered in the app. Easy to miss: the scheme must match in both places.
3. **Selfie Check not enabled.** When we tried to accept more credentials, the request failed with a message to contact World to enable Selfie Check for the app. There was no way to see in advance which credentials an app is allowed to request. We reverted to the Proof of Human preset.
4. **Testing with more than one account.** Each action gives one proof per person, so repeated testing burns actions. We worked around it with per-spot action overrides.

**Missing capability or documentation:**
- A way to see, in the developer portal or the MCP, which credentials are enabled for an app before sending a request.
- Guidance for standalone native apps (not mini apps) on return links and what happens when the user comes back without finishing.
- A clear recommended pattern for "returning user" sign-in with action-based nullifiers.

**The one improvement with the greatest impact:** let a developer query which credentials their app can request, so the failure shows up at setup, not on a user's phone.

## What is not done yet (said plainly)

- The proof is verified on our server, which then signs the mint. The contract trusts our signer, not World ID directly. Verifying onchain is the next step.
- World ID proves a unique human, not location. Location is a separate server-side check on GPS and can be spoofed.
- Sign-in is Orb only until World enables other credentials for the app.
