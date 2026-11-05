# Sponsor campaigns, ads and payouts (plan)

Status: **plan**, nothing here is built yet except the stamp contract and voucher signer. Testnet only.

## The idea

An organizer creates an **event** (ETHGlobal Mumbai) with **spots** (the 3 ft Ethereum logo at the venue). **Sponsors** put
money behind a spot and run an ad on it. A traveler who walks up and captures the spot sees the sponsor's ad on the World ID
step. When the event ends, the money is split between the verified humans who hold that spot's stamp.

## Is it feasible?

Yes, technically, in three independent layers. Each works without the next.

| Layer | What | Needs | Effort |
|---|---|---|---|
| A. Arkiv records | Spots and sponsor campaigns as public entities; the app reads them | Arkiv testnet key + faucet funds | ~3-4 h |
| B. Ads | Show the campaign's creative on the verify step; count impressions | Layer A | ~2-3 h |
| C. Payouts | Sponsors fund an escrow for a spot; after the event it pays the stamp holders | Stamp contract (built), a wallet address per traveler, Sepolia funds | ~3-4 h, stretch |

Things to be honest about:

- **Staking is really an escrowed ad budget**, not yield. Sponsors lock funds until the event ends. If nobody captured the
  spot, they can refund.
- **Payouts need an address per traveler.** The tracks do not require a wallet, but paying people does. The app would
  generate a key on the phone (secure storage); the backend already knows each recipient address from the voucher.
- **Real money is a legal question** (paying people for location + ad views: consumer protection, tax, KYC, India's DPDP Act,
  ASCI ad disclosure, World ID's own terms). Everything stays on testnet tokens until that is reviewed.
- **The backend decides who gets a stamp**, so sponsors trust the organizer's backend for the count. Mitigation: the stamp
  supply and every mint are public on chain, and one stamp per verified human per spot is enforced by World ID plus the contract.

## Layer A: what lives on Arkiv

Arkiv limits that shape the design (from docs.arkiv.network, checked today):

- an entity can carry up to **128 KiB of `bytes`** in total; a `str` is **128 bytes**; **32 attributes** max;
- only attributes marked **indexed** can be filtered on; `STARTSWITH` works on strings, ranges work on numbers;
- expiry is mandatory, **max ~182.5 days**, extendable by the owner; expired entities vanish from queries;
- only the **owner** can change or delete; **anyone** can write the same schema tag, so always filter by owner;
- 100 rows per page; the public RPC is rate limited (get a free access key).

Entities (schema tags `world3.*`):

| Entity | Owner (writer) | Key fields | Expires |
|---|---|---|---|
| `world3.event` | organizer wallet | `slug` (indexed), `name`, `startsAt`, `endsAt` (u64, indexed) | event end + claim window |
| `world3.spot` | organizer wallet | `eventSlug` (indexed), `spotId` (indexed), `name`, `kind`, `latE5`/`lngE5` (i32, coarse ~1 m), `geohash6` (indexed, coarse), `captureRadiusM`, `modelRef` | event end + claim window |
| `world3.campaign` | **the sponsor's own wallet** | `spotId` (indexed), `eventSlug` (indexed), `sponsor`, `headline`, `clickUrl`, `status` (indexed), `startsAt`/`endsAt` (indexed), creative (below), `escrowTx`, `budget` | `endsAt` + claim window |

**Never on Arkiv:** captures, nullifiers, World ID data, GPS evidence, user wallets, voucher data. Impressions are counted by
the backend, not published.

The backend is what the app talks to (`/api/v1/spots`, `/api/v1/spots/:id/ads`). It reads Arkiv with an access key, filters to
the organizer's and approved sponsors' wallets, verifies creatives, caches, and falls back to its local copy if Arkiv is
unreachable. The prize needs a feature that **reads from Arkiv**: the spot list and ads do, and `arkiv/` documents one
public query anyone can run without the backend.

## Storing and resolving ad assets

Two storage tiers, chosen by size:

1. **Small creatives (up to ~100 KB: PNG, JPEG, WebP, short GIF) go inside the campaign entity** as `bytes`, with
   `mime`, `sha256`, `width`, `height` and `alt` as indexed/plain attributes. No second system, expires with the campaign,
   and "resolve" is just the Arkiv query that already returned the campaign. This fits a banner: a 640x360 WebP is usually
   20-60 KB. The dashboard re-encodes uploads to fit and rejects anything over the limit.
2. **Larger creatives (GIF, longer animation) go on Swarm** and the entity stores `swarmRef` (a 64-hex `str`, within the
   128-byte limit) plus `sha256`. Swarm needs a **postage stamp** (xBZZ on Gnosis) for every upload, and public gateways do not
   document free uploads, so this is the stretch path (and the Arkiv + Swarm bonus). Never store an encrypted Swarm reference
   (it contains the key) in an entity.

Resolution order in the backend, for a campaign:

1. creative bytes in the entity -> use them;
2. else `https://<gateway>/bzz/<swarmRef>` from a short list of gateways, with timeout and fallback;
3. verify `sha256` of what came back; if it does not match, drop the campaign and log it;
4. store the bytes under `data/ads/<sha256>.<ext>` and serve them from `/files/ads/<sha256>` with immutable caching.
The phone only ever loads from our backend, so one bad gateway never shows a broken ad.

Safety rules for ads (sponsors are third parties):

- only wallets on the organizer's allowlist can have a campaign shown; owner is checked, not just the schema tag;
- mime allowlist and magic-byte check, size cap, max dimensions, re-encode, strip metadata;
- always labelled **Sponsored**; `clickUrl` must be `https`, opens in the browser after a confirm, no tracking pixels;
- animation capped and not auto-playing for people with reduced motion;
- the organizer can mark a campaign `paused` (it is theirs to hide) without touching the sponsor's entity.

## Layer B: ads on the verify step

1. The person opens a spot and taps Capture. The verify screen asks the backend for `/api/v1/spots/:id/ads` and shows the
   top campaign (rotation by least impressions) above the World ID button.
2. When they actually start verifying, the app posts an **impression** (signed in, one per person per campaign) to the backend.
3. The sponsor sees counts: impressions, captures, estimated payout per stamp.

## Layer C: staking and payout (stretch)

`CampaignEscrow` (Sepolia, testnet ETH to start):

- `fund(spotId)` payable: a sponsor adds to the pool for a spot. Locked until `endsAt` (set by the organizer when the event is created).
- After `endsAt`, anyone can call `distribute(spotId, holders[])`: for each holder with a stamp that has not been paid,
  pay `pool / totalSupply(spotId)`. The backend relayer calls it in batches and pays the gas, so travelers do not need gas.
- If nobody captured the spot, sponsors can `refund`. Rounding dust stays in the contract or goes to the organizer.
- Needs `Stamp` to extend `ERC1155Supply` (a small change) so `totalSupply` is on chain, and the app to send a wallet address.

Why it is fair: one stamp per verified human per spot (World ID per-spot action + the contract's one-per-wallet rule), so
the number of shares is the number of distinct people who really stood there.

## Build order for the hackathon (about one day left)

1. **Arkiv adapter** and `world3.spot` entities; spot list served from Arkiv; `arkiv/*.md` files. (Layer A)
2. **Campaign entities** written by two demo sponsor wallets; ad card on the verify step with creatives stored in the entity. (B)
3. **Wallet in the app**, auto-mint through the relayer, **escrow + distribute** on Sepolia if time allows. (C)
4. Swarm for large creatives only if there is time and a postage batch.

## Needed from the team

- an Arkiv testnet wallet funded from the faucet (https://hub.arkiv.network/faucet) and an access key (https://hub.arkiv.network/access-keys);
- two demo sponsor wallets (throwaway, generated by us) funded the same way;
- later, for payouts: a funded Sepolia key and RPC URL.
