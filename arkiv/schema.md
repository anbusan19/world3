# Schema: what World3 puts on Arkiv

Network: **Arkiv Rabdi testnet**, chain id `7794095`. SDK: `@arkiv-network/sdk` 1.0.1.

## Who writes
One organizer wallet owns and writes every entity: **`0xf47cB2e4353F5daF04fA7AF0955551ab7DB74b52`**.
The server only reads. Anyone can write entities with the same schema name, so every read filters by this owner
(`ownedBy`); nothing is trusted just because it carries the `world3.spot` tag.

## Entities (built)

### `world3.spot`
One per published spot. Written by the organizer when "List on Arkiv" is ticked in the dashboard.

| Field | Type | Indexed | What it is |
|---|---|---|---|
| `eventSlug` | str | yes | the event, e.g. `ethglobal-mumbai-2026` |
| `spotId` | str | yes | our id for the spot |
| `type` | str | yes | `LANDMARK` or `EVENT` |
| `latE3`, `lngE3` | i32 | yes | latitude and longitude x 1000, **rounded to about 110 m** |
| `name`, `label`, `city`, `kind`, `theme`, `icon`, `art` | str | no | display fields |
| `captureRadiusM`, `approachRadiusM` | i32 | no | how close you must be |
| `hasModel` | bool | no | whether a 3D model exists on our server |

**Fields we query on:** `eventSlug`, `spotId` (find or update one spot), `type`, and the rounded coordinates for a
"near me" bounding box.

**Left off on purpose:** exact coordinates, the 3D model, captures, World ID data, wallet addresses, vouchers. A spot
in someone's home would otherwise be public forever, so exact location stays on our server and reaches the app only
through our feed.

**Expiry:** 30 days (`ARKIV_TTL_DAYS`). Re-saving the spot in the dashboard renews it (`extendEntity`). The chain's maximum
lifetime is about 182 days. Unticking the box, unpublishing, or deleting the spot deletes the entity.

**Who can change it:** only the organizer wallet (Arkiv's owner-only rule). Our dashboard is the only thing that holds that key.

## Entities planned, not built yet

`world3.campaign` (sponsor ads, written by each sponsor's own wallet, creative stored in the entity if under 128 KiB) and
`world3.event`. See `docs/ads-and-campaigns.md`. **Nothing about ads or sponsors is on Arkiv today.**

## Run the query yourself

```
cd backend && npm install && node scripts/arkiv-query.mjs
```

It reads the spots from Arkiv directly (no World3 server, no key needed, though a free access key avoids rate limits) and
prints the two entities currently live. Current keys: Gateway of India `0x6c5d1391…2e53ce`, CSMT `0xfba0cc6b…31ee7c`.
