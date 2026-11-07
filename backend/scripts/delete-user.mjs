// Removes one person's wrld3 account from the server's data so they can sign up again as a new user (for a demo, or after they lost
// their session and recovery code). Stop the server first:  sudo systemctl stop wrld3
//
//   node scripts/delete-user.mjs --label taco            # by passport name (the part before .wrld3.eth)
//   node scripts/delete-user.mjs --wallet 0xa92A...      # or by the wallet the explorer shows for them
//   node scripts/delete-user.mjs --user <userId>         # or by account id
//   node scripts/delete-user.mjs --list                  # who is on the server (changes nothing)
//   --data <dir>   the server's data folder (default ../data)      --dry-run   show what would go and change nothing
//
// Removed: the account, its sessions, and its passport record on this server. Kept on purpose: the captures (stamps already minted
// stay on chain, and a person who captured a spot cannot capture it again with World ID anyway, so the records must stay in step).
// NOT undone: the ENS name (once registered on chain it stays taken) and anything on the chain or at World.
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// the wallet the server holds for a person (the same derivation the passports use), so an account can be matched to the explorer
const walletOf = (seed, userId) => (seed ? privateKeyToAccount(keccak256(stringToBytes(`${seed}:${userId}`))).address : null);

// Who is on this server: id, passport name, when they joined, how many stamps and sessions. Nothing is changed.
export async function listUsers({ dataDir, ownerSeed = null }) {
  const read = async (f) => (existsSync(path.join(dataDir, f)) ? JSON.parse(await readFile(path.join(dataDir, f), 'utf8')) : null);
  const accounts = await read('accounts.json');
  const passports = await read('passports.json');
  const captures = await read('captures.json');
  if (!accounts) throw new Error(`No accounts.json in ${dataDir}.`);
  return accounts.users.map((u) => ({
    userId: u.id,
    wallet: walletOf(ownerSeed, u.id),
    passport: passports?.users?.[u.id]?.name ?? null,
    joined: u.createdAt ?? null,
    stamps: new Set((captures?.captures ?? []).filter((c) => c.userId === u.id).map((c) => c.spotId)).size,
    sessions: accounts.sessions.filter((x) => x.userId === u.id).length,
  }));
}

export async function deleteUser({ dataDir, label, userId, wallet, ownerSeed = null, dryRun = false, now = () => Date.now() }) {
  const read = async (f) => (existsSync(path.join(dataDir, f)) ? JSON.parse(await readFile(path.join(dataDir, f), 'utf8')) : null);
  const accounts = await read('accounts.json');
  const passports = await read('passports.json');
  if (!accounts) throw new Error(`No accounts.json in ${dataDir}.`);
  let id = userId ?? null;
  if (!id && label) {
    const wanted = String(label).trim().toLowerCase().replace(/\.wrld3\.eth$/, '');
    id = Object.entries(passports?.users ?? {}).find(([, st]) => st.label === wanted)?.[0] ?? null;
    if (!id) throw new Error(`No passport named "${wanted}" on this server.`);
  }
  if (!id && wallet) {
    if (!ownerSeed) throw new Error('--wallet needs PASSPORT_OWNER_SEED (it is read from the server .env).');
    id = accounts.users.find((u) => walletOf(ownerSeed, u.id)?.toLowerCase() === String(wallet).toLowerCase())?.id ?? null;
    if (!id) throw new Error(`No account on this server holds the wallet ${wallet}.`);
  }
  if (!id) throw new Error('Say who: --label <passport name>, --wallet <0x...> or --user <id>.');
  const user = accounts.users.find((u) => u.id === id);
  if (!user) throw new Error(`No account with id ${id}.`);
  const plan = {
    userId: id,
    passport: passports?.users?.[id] ? { label: passports.users[id].label ?? null, name: passports.users[id].name ?? null } : null,
    sessions: accounts.sessions.filter((s) => s.userId === id).length,
  };
  if (dryRun) return { dryRun: true, ...plan };
  const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
  for (const f of ['accounts.json', 'passports.json']) if (existsSync(path.join(dataDir, f))) await copyFile(path.join(dataDir, f), path.join(dataDir, `${f}.bak-${stamp}`)); // a copy to go back to
  accounts.users = accounts.users.filter((u) => u.id !== id);
  accounts.sessions = accounts.sessions.filter((s) => s.userId !== id);
  const put = async (f, data) => { const p = path.join(dataDir, f); await writeFile(`${p}.tmp`, JSON.stringify(data, null, 2)); await rename(`${p}.tmp`, p); };
  await put('accounts.json', accounts);
  if (passports?.users?.[id]) { delete passports.users[id]; await put('passports.json', passports); }
  return { deleted: true, ...plan };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: a } = parseArgs({ options: { list: { type: 'boolean' }, wallet: { type: 'string' }, label: { type: 'string' }, user: { type: 'string' }, data: { type: 'string' }, 'dry-run': { type: 'boolean' }, force: { type: 'boolean' } } });
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = a.data ?? path.join(here, '..', 'data');
  try { process.loadEnvFile(path.join(dataDir, '..', '.env')); } catch { /* no .env next to the data folder */ }
  const ownerSeed = process.env.PASSPORT_OWNER_SEED ?? null;
  try {
    if (a.list) { console.table(await listUsers({ dataDir, ownerSeed })); process.exit(0); }
    if (!a['dry-run'] && !a.force) { // the running server keeps its own copy in memory and would write it back
      const up = await fetch('http://127.0.0.1:3000/api/v1/chain').then(() => true).catch(() => false);
      if (up) throw new Error('The server is running. Stop it first (sudo systemctl stop wrld3), run this, then start it again. Or pass --force if you know it is another server.');
    }
    const out = await deleteUser({ dataDir, label: a.label, userId: a.user, wallet: a.wallet, ownerSeed, dryRun: !!a['dry-run'] });
    console.log(JSON.stringify(out, null, 2));
    if (out.deleted) console.log('\nDone. Start the server again. The old files were copied to *.bak-<time> next to them.');
  } catch (e) { console.error(`\n  ${e.message}\n`); process.exit(1); }
}
