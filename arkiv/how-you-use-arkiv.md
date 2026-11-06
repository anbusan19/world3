# How World3 uses Arkiv

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
| Delete | Unticking "List on Arkiv" or deleting a spot removes it from the public list. |

**What is real today:** two spots (Gateway of India, CSMT) written and read back on Rabdi, the dashboard switch, the public
list route, and the app chip.
**What is not built:** sponsor campaigns and ads. They are planned (see `docs/ads-and-campaigns.md`) and not part of what we claim.

## What we kept off Arkiv, and why

- **Exact coordinates and the 3D models.** Spots can be places people live or work; models are up to 30 MB, over the entity limit.
- **Captures, World ID nullifiers, GPS evidence, vouchers.** Personal and regulated by our privacy design. Arkiv is public.
- **Impressions and payouts (future).** Counted by the backend, never published per person.
