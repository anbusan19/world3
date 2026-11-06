# Schema: what wrld3 puts on Arkiv

Network: **Arkiv Rabdi testnet**, chain id `7794095`. SDK: `@arkiv-network/sdk` 1.0.1.

## Who writes
One organizer wallet owns and writes every entity: **`0xf47cB2e4353F5daF04fA7AF0955551ab7DB74b52`**.
The server only reads. Anyone can write entities with the same schema name, so every read filters by this owner
(`ownedBy`); nothing is trusted just because it carries the `world3.spot` tag.

## Entities (built)

The schema names still start with `world3.` because the project was renamed to wrld3 after the first entities were written. Renaming the
schema would orphan them, so the old names stay.

### `world3.spot`
One per published spot. Written by the organizer when "List on Arkiv" is ticked in the dashboard.

| Field | Type | Indexed | What it is |
|---|---|---|---|
| `eventSlug` | str | yes | the event, e.g. `ethglobal-mumbai-2026` |
| `spotId` | str | yes | our id for the spot |
| `type` | str | yes | `LANDMARK` or `EVENT` |
| `latE3`, `lngE3` | i32 | yes | latitude and longitude x 1000, **rounded to about 110 m** |
| `name`, `label`, `city`, `kind`, `theme`, `icon`, `art` | str | no | display fields (`kind` is `geospatial` or `anchor`) |
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

### `world3.campaign` (built)
A sponsor's ad for one spot. **Written and owned by the sponsor's own wallet**, from the advertiser page (`/sponsor.html`) or `backend/scripts/campaign-create.mjs`. The ad image
is stored *inside* the entity (up to 100 KB; the advertiser page shrinks images to about 40 KB first), so there is no second storage system and it expires with the campaign.

| Field | Type | Indexed | What it is |
|---|---|---|---|
| `eventSlug`, `spotId` | str | yes | where it runs |
| `status` | str | yes | `active` or `paused` (the sponsor can pause their own) |
| `startsAt`, `endsAt` | u64 | yes | unix seconds |
| `sponsor`, `headline`, `alt`, `clickUrl` | str | no | shown text and the https link |
| `mime`, `sha256`, `width`, `height` | str / i32 | no | declared type, digest and size of the image |
| `creative` | bytes | no | the image (PNG, JPEG, WebP or GIF, at most 100 KB, at most 1280 px) |

The server shows a campaign only if the owner wallet is approved (`ARKIV_SPONSORS`, plus the organizer), it is active and inside its
dates, the image is a real file of the declared type and size and matches its digest, and the link is plain https. Anyone can copy the
schema name, so the tag alone proves nothing. Entities expire 7 days after the campaign ends.

**Nothing about the people who see an ad is on Arkiv.** Impressions are counted by our server, once per verified person.
**Not built:** escrow and payouts, Swarm for large creatives, and an ad on the World ID verify step.

## Run the query yourself

```
cd backend && npm install && node scripts/arkiv-query.mjs
```

It reads the spots from Arkiv directly (no wrld3 server, no key needed, though a free access key avoids rate limits) and
prints the spot entities currently live. Example keys: Gateway of India `0x6c5d1391…2e53ce`, CSMT `0xfba0cc6b…31ee7c`, ETHGlobal Mumbai `0xe3e06c5b…db67f9`.

**Known issue:** the last query returned spot 83 (World) four times. The dashboard's Save hung while a stuck transaction held the signer's nonce, and
the retries wrote extra copies (see `friction.md`, items 8 and 9). The app and server read one entity per spot id, so users see no duplicates.
