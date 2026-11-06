// One-time: deploy the subname registry and attach it to the parent name. Safe to re-run.   node scripts/ens-setup.mjs
import { createEns } from '../src/ens/passport.js';
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* env may already be set */ }
const dataDir = new URL('../data', import.meta.url).pathname;
const ens = await createEns({ privateKey: process.env.ENS_PRIVATE_KEY, rpcUrl: process.env.SEPOLIA_RPC_URL, dataDir });
console.log(`\nSetting up ${ens.parent} subnames with ${ens.account.address}`);
const registry = await ens.ensureRegistry();
console.log(`  subname registry ${registry}\n  attached to ${ens.parent}\n`);
