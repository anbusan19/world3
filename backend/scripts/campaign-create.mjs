// The advertiser's tool. A sponsor runs this with THEIR OWN wallet; the campaign entity is theirs (only they can change it).
//
//   SPONSOR_PRIVATE_KEY=0x... node scripts/campaign-create.mjs \
//     --spot 05 --sponsor "Acme Coffee" --headline "Free coffee at the venue" \
//     --image ./banner.webp --url https://acme.example/coffee --days 2
//
//   --dry-run            check everything and print what would be written; nothing is signed, nothing costs gas
//   --pause <entityKey>  stop showing a campaign (your own); --resume <entityKey> to show it again
//   --delete <entityKey> remove a campaign
//
// The organizer must approve your wallet address (ARKIV_SPONSORS on the server) before the app shows your ad.
// Gas is paid in tGLM from your wallet (about 0.001 per write). Get some at https://hub.arkiv.network/faucet.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ExpirationTime, createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CampaignError, CampaignSchema, campaignValues } from '../src/campaign.js';
import { redact } from '../src/arkiv.js';
import { gasForCreative } from '../src/adgas.js';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* a sponsor has no server .env; they pass their own key */ }
const { values: a } = parseArgs({ options: {
  spot: { type: 'string' }, sponsor: { type: 'string' }, headline: { type: 'string' }, image: { type: 'string' }, url: { type: 'string' }, alt: { type: 'string' },
  days: { type: 'string', default: '2' }, event: { type: 'string' }, 'dry-run': { type: 'boolean' }, pause: { type: 'string' }, resume: { type: 'string' }, delete: { type: 'string' },
} });
const TX = { gas: 5_000_000n }; // pause, resume and delete are cheap (about 0.25M and 0.15M); only gas used is charged
const eventSlug = a.event ?? process.env.ARKIV_EVENT_SLUG ?? 'ethglobal-mumbai-2026';
const fail = (m) => { console.error(`\n  ${m}\n`); process.exit(1); };

try {
  const dry = !!a['dry-run'];
  const key = process.env.SPONSOR_PRIVATE_KEY;
  if (!dry && !key) fail('Set SPONSOR_PRIVATE_KEY to your wallet\'s private key (it stays on this computer), or use --dry-run.');
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' });
  const account = key ? privateKeyToAccount(key) : null;
  const wallet = account ? createWalletClient({ chain, transport: http(), account }) : null;

  if (a.pause || a.resume) {
    const entityKey = a.pause ?? a.resume;
    const { txHash } = await wallet.patchEntity(CampaignSchema, entityKey, { set: { status: a.pause ? 'paused' : 'active' } }, TX);
    console.log(`\n  ${a.pause ? 'Paused' : 'Resumed'} ${entityKey}\n  tx ${txHash}\n`);
    process.exit(0);
  }
  if (a.delete) {
    await wallet.deleteEntity({ entityKey: a.delete }, TX);
    console.log(`\n  Deleted ${a.delete}\n`);
    process.exit(0);
  }

  for (const f of ['spot', 'sponsor', 'headline', 'image', 'url']) if (!a[f]) fail(`Missing --${f}. See the header of this file for an example.`);
  const days = Number(a.days);
  if (!(days > 0 && days <= 90)) fail('--days must be between 1 and 90.');
  const now = Math.floor(Date.now() / 1000);
  const endsAt = now + Math.round(days * 86400);
  const values = campaignValues({ eventSlug, spotId: a.spot, sponsor: a.sponsor, headline: a.headline, clickUrl: a.url, alt: a.alt, startsAt: now, endsAt, creative: await readFile(a.image) });

  console.log(`\n  Campaign check passed.
    spot       ${values.spotId} (${eventSlug})
    sponsor    ${values.sponsor}
    headline   ${values.headline}
    link       ${values.clickUrl}
    image      ${values.mime}, ${values.width}x${values.height}, ${(values.creative.length / 1024).toFixed(1)} KB
    runs       ${new Date(now * 1000).toISOString()}  ->  ${new Date(endsAt * 1000).toISOString()}`);
  if (dry) { console.log('\n  --dry-run: nothing was signed or sent.\n'); process.exit(0); }

  // the entity outlives the campaign by a week so it can still be read while the event is wrapped up
  const expiration = ExpirationTime.fromDays(Math.ceil(days) + 7);
  const { entityKey, txHash } = await wallet.createEntity(CampaignSchema, values, { expiration }, { gas: gasForCreative(values.creative.length, days + 7) }); // gas depends on size and on how long it is kept
  console.log(`\n  Published.
    entity key ${entityKey}
    owner      ${account.address}
    tx         ${txHash}

  Next: ask the organizer to approve your wallet (${account.address}) so the app shows it.
  Pause any time:  node scripts/campaign-create.mjs --pause ${entityKey}\n`);
} catch (e) {
  if (e instanceof CampaignError) fail(`Not published: ${e.message}`);
  fail(`Arkiv did not accept the write: ${redact(e?.shortMessage ?? e?.name ?? 'unknown error')}`);
}
