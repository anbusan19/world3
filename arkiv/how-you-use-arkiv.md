# How wrld3 uses Arkiv

**Filters, owner, expiry: do they fit?**

- **Filters.** The app needs "which spots are in this event" (`eventSlug`) and "find or update this one" (`spotId`), plus
  `type` and the rounded coordinates for a nearby-spots box. Those four are the only indexed columns; everything else is
  plain data returned with the entity. We did not index things nobody queries.
- **Owner.** One organizer wallet owns every entity, and the server filters reads by that owner, because anyone can write
  the same schema name. A spot is only ever changed by the dashboard, the one place that holds the key. This matches
  the product: spots are the organizer's, and travelers never write to Arkiv.
- **Expiry.** A spot lives 30 days and is renewed when the organizer re-saves it, so a venue that stays open stays listed,
  and a finished event disappears without anyone cleaning up. Event spots are meant to end; the chain enforces that.

**Does each Arkiv feature change something the user sees?**

| Feature | What a person sees |
|---|---|
| Public, queryable entities | The spot screen shows **Listed on Arkiv** with the entity key and expiry, and anyone can run `backend/scripts/arkiv-query.mjs` to see the same spots without our server. |
| Owner-only writes | Only the organizer can list or change a spot. A copy of our schema by someone else is ignored. |
| Expiry | "listed until 2026-12-06" on the spot screen. |
| Sponsor-owned campaigns | A sponsor's ad appears on the stamp screen right after a verified capture, labelled Sponsored. Only the sponsor's wallet can change or pause it. |
| Delete | Unticking "List on Arkiv" or deleting a spot removes it from the public list. |

**What is real today:** four spots (Gateway of India, CSMT, ETHGlobal Mumbai, World) written and read back on Rabdi (World appears several times, see `schema.md`), the dashboard switch, the public
list route, and the app chip. **Sponsor campaigns:** one demo campaign is on Rabdi, written with the advertiser tool; the server reads it,
validates it, and the app shows it as a "Sponsored" card on the stamp screen after a verified capture.
**Advertisers** use a web page (`/sponsor.html`) or a command: they connect their own wallet, publish, and pause or delete their own campaign. The organizer approves wallets on `/sponsors.html`. Sponsor campaigns with ad images are written the same way from the hosted advertiser page.
**What is not built:** payouts to stamp holders and Swarm for large images.

## What we kept off Arkiv, and why

- **Exact coordinates and the 3D models.** Spots can be places people live or work; models are up to 30 MB, over the entity limit.
- **Captures, World ID nullifiers, GPS evidence, vouchers.** Personal and regulated by our privacy design. Arkiv is public.
- **Impressions and payouts (future).** Counted by the backend, never published per person.
