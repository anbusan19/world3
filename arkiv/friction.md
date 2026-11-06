# Arkiv friction notes

Things that got in our way while building on Rabdi with SDK 1.0.1, in the order we hit them. Nothing here is a complaint about
a broken feature; most are things we would have liked the docs or SDK to say.

1. **Funding a server-side wallet needs a browser wallet.** The faucet and access-key pages ask you to connect a wallet, so we
   could not paste in the address of a key generated on a server. We had to claim funds with MetaMask and send them across.
   *Wanted:* a faucet that accepts a pasted address, or a documented "send from your connected wallet" step.
2. **`$expiresAt` is a `bigint`, so `JSON.stringify` threw.** Our first public route returned HTTP 500 with
   `TypeError: Do not know how to serialize a BigInt` because the system field came back as a bigint. Reproduce: select
   `$expiresAt` and return the entity from an HTTP handler. We convert 64-bit values to strings. *Wanted:* a note in the
   query docs, or a `toJSON()`-safe projection.
3. **Expiry is a block number, not a date.** `createEntity` returns `expiresAt` as a block (e.g. `1565039`). Showing "listed until
   a date" means estimating it from block time. *Wanted:* a helper to turn a block into a date.
4. **Selected attributes come back as `{ type, value }`.** Reading `name` gives `{ type: 'str', value: '...' }`, so every consumer
   needs to unwrap. We wrote a small `flat()` helper. Fine once known, easy to miss.
5. **The access key lives in the RPC URL path.** Error messages from the transport can therefore contain the key. We found this in
   the arkiv-security-trust skill (not in the main docs) and added a redaction step so keys and URLs never reach logs or the
   dashboard. *Wanted:* the main docs should warn about it where the key is introduced.
6. **No test double.** To unit-test our adapter without spending tGLM we wrote an in-memory fake of the wallet/public client. An
   official in-memory client would have saved time.
7. **Query-then-create is not unique.** The index can lag right after a write, so "find the spot, else create" can duplicate. We
   keep our own record of the entity key and serialize writes (also from the skills, not the main docs).

What worked first time: `createEntity`, the `select().from().ownedBy().where().limit().fetch()` chain, `patchEntity`, `extendEntity`,
and `deleteEntity` on Rabdi with an access key; writes cost a fraction of a tGLM.

Not tested by us: rate limits under load (we never hit one with the access key), batching, and large `bytes` values.
