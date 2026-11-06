# Why Arkiv, not a database

**If we swapped Arkiv for Postgres, what would people lose?**

1. **Discovery without us.** Today anyone, including another app or an AI agent, can list World3's spots with one query
   (`backend/scripts/arkiv-query.mjs`), without our server, an account, or our permission. With Postgres they could only
   use an API we choose to run and keep running.
2. **Spots survive the backend.** Our server is a laptop at a hackathon. If it disappears, the public list does not.
3. **Expiry the operator cannot forget.** An event spot is meant to end. The chain removes it on schedule; with a database
   somebody has to run a cleanup job, and a forgotten stale pin sends people to the wrong place.
4. **Provable ownership.** Each entity has an owner wallet. A sponsor's campaign is written and owned by the sponsor's own wallet,
   so the organizer can decline to show it but cannot forge or rewrite it, and the sponsor can pause or delete it without us.

**What we did not move, and why.** Everything personal, and everything big (see `how-you-use-arkiv.md`). Arkiv is a public
record: a database stays the right home for captures, accounts and models.

**Honest limits.** The app still reads spots through our server, which merges the exact coordinates and models that are
private. Arkiv is the public, discoverable layer, not the app's only source. If Arkiv is down, saving a spot still works and the
dashboard says why.
