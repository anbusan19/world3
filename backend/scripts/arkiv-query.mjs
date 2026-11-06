// Anyone can run this: it reads wrld3's public spots straight from Arkiv, without asking our server.
//   cd backend && npm install && node scripts/arkiv-query.mjs
// Optional: ARKIV_ACCESS_KEY=... (free, https://hub.arkiv.network/access-keys) if the public RPC rate-limits you.
import { createPublicClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { defineSchema, i32, str, bool } from '@arkiv-network/sdk/schema';
import { http } from 'viem';

const OWNER = process.env.WRLD3_OWNER ?? '0xf47cB2e4353F5daF04fA7AF0955551ab7DB74b52'; // the wallet that wrote them
const EVENT = process.env.WRLD3_EVENT ?? 'ethglobal-mumbai-2026';

const Spot = defineSchema('world3.spot', {
  eventSlug: str().indexed(), spotId: str().indexed(), name: str(), label: str(), city: str().optional(), type: str().indexed(),
  kind: str(), latE3: i32().indexed(), lngE3: i32().indexed(), captureRadiusM: i32(), approachRadiusM: i32(), theme: str(), icon: str(),
  art: str().optional(), hasModel: bool(),
});

const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' }), transport: http() });
const { entities } = await client
  .select({ $key: true, $expiresAt: true, spotId: true, name: true, type: true, latE3: true, lngE3: true })
  .from(Spot)
  .ownedBy(OWNER) // anyone can write this schema name, so only trust the organizer's wallet
  .where(eq('eventSlug', EVENT))
  .limit(100)
  .fetch();

for (const e of entities) {
  const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
  console.log(`${v(e.spotId)}  ${v(e.name)}  ${v(e.type)}  ~${v(e.latE3) / 1000}, ${v(e.lngE3) / 1000}  key ${e.$key}  expires at block ${e.$expiresAt}`);
}
console.log(`${entities.length} spot(s) from ${OWNER}`);
