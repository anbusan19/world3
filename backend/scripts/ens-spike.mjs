// The permission proof. Creates a passport for a throwaway "traveler", writes the stamps record as the backend, reads it back
// through the Universal Resolver, then checks (by simulation, so nothing is sent) who is allowed to change what.
//   node scripts/ens-spike.mjs
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { STAMPS_KEY, createEns } from '../src/ens/passport.js';
import { SEPOLIA } from '../src/ens/addresses.js';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* env may already be set */ }
const dataDir = new URL('../data', import.meta.url).pathname;
const ens = await createEns({ privateKey: process.env.ENS_PRIVATE_KEY, rpcUrl: process.env.SEPOLIA_RPC_URL, dataDir });
const traveler = privateKeyToAccount(generatePrivateKey()); // a throwaway; its key is never saved or shown
const label = `spike${Math.random().toString(36).slice(2, 6)}`;
console.log(`\nCreating ${label}.${ens.parent} for traveler ${traveler.address}`);
const p = await ens.createPassport({ name: label, owner: traveler.address, stamps: '05,06' });
console.log(`  resolver ${p.resolver}\n  name tx   ${p.nameTx}\n  record tx ${p.recordTx}`);

// read it back like any app would (viem + the ENSv2 Universal Resolver)
const reader = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com') });
const value = await reader.getEnsText({ name: p.name, key: STAMPS_KEY, universalResolverAddress: '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe' }).catch((e) => `READ FAILED: ${String(e.shortMessage ?? e.message).slice(0, 100)}`);
console.log(`\nResolved ${p.name} -> ${STAMPS_KEY} = ${JSON.stringify(value)}`);

console.log('\nWho may set what (simulated, nothing is sent):');
const rows = [];
for (const [who, as, keys] of [['backend', ens.account.address, [STAMPS_KEY, 'avatar', 'description', 'url', 'com.twitter']], ['traveler', traveler.address, ['avatar', STAMPS_KEY]]]) {
  for (const key of keys) {
    const r = await ens.canSetText({ resolver: p.resolver, name: p.name, key, as });
    rows.push({ who, key, allowed: r.allowed, why: r.why ?? '' });
    console.log(`  ${who.padEnd(9)} ${key.padEnd(14)} ${r.allowed ? 'ALLOWED' : `refused (${r.why})`}`);
  }
}
const ok = rows.find((r) => r.who === 'backend' && r.key === STAMPS_KEY)?.allowed
  && rows.filter((r) => r.who === 'backend' && r.key !== STAMPS_KEY).every((r) => !r.allowed)
  && rows.filter((r) => r.who === 'traveler').every((r) => r.allowed);
console.log(`\n${ok ? 'PASS' : 'FAIL'}: the backend can write only ${STAMPS_KEY}; the traveler controls the rest.\n`);
await ens.save({ spike: { name: p.name, resolver: p.resolver, owner: traveler.address, readBack: value, pass: !!ok, at: new Date().toISOString() } });
process.exit(ok ? 0 : 1);
