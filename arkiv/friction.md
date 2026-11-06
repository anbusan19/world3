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

8. **The documented gas floor is not enough for entities with large bytes.** The docs give 1,000,000 as the gas floor for one operation.
   A sponsor ad of more than about 25 KB failed with `EntityMutationError` at that limit. From our measurements the cost is about
   400,000 + 48 per byte of payload, so a 100 KB creative needs about 5.2 M. Reproduce: `createEntity` with a 60 KB `creative`
   and `gas: 1_000_000n`. We now scale the gas to the payload, and we also shrink images to about 40 KB. *Wanted:* a gas estimate
   for Arkiv writes, or a formula in the docs.
9. **One stuck transaction blocks every later write from that wallet, and nothing says so.** A write at nonce 34 stayed pending, so the
   dashboard's Save hung with no error. The fix was to resend nonce 34 with a higher gas price (`cast send --nonce 34 --gas-price 200gwei --async`).
   Our retries in the meantime wrote duplicate entities. We added a 45 s limit on the Arkiv step and a 90 s client timeout, but the
   SDK call has no timeout of its own. *Wanted:* a timeout option on writes, and a way to see and replace a pending transaction.

What worked first time: `createEntity`, the `select().from().ownedBy().where().limit().fetch()` chain, `patchEntity`, `extendEntity`,
and `deleteEntity` on Rabdi with an access key; writes cost a fraction of a tGLM.

Not tested by us: rate limits under load (we never hit one with the access key), batching, and large `bytes` values.
