import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// A tiny testnet faucet for the hackathon: it sends a small amount of tGLM (a worthless test token) from the server's own
// Arkiv wallet to any address that asks, so a sponsor can run an ad without visiting a faucet. It is deliberately stingy:
// one drip per address per day, a few per network address per day (a venue's wifi is one address for everybody), a daily total cap, and nothing for an address that already has enough.
//   chain: { send(to, value) -> txHash, balanceOf(address) -> bigint, ownBalance() -> bigint }

const ONE = 10n ** 18n;
const toWei = (tglm) => BigInt(Math.round(Number(tglm) * 1e6)) * 10n ** 12n;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export class FaucetError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

export function faucetConfigFromEnv(env = process.env) {
  return {
    amount: toWei(env.FAUCET_AMOUNT_TGLM ?? '0.05'),
    dailyCap: toWei(env.FAUCET_DAILY_CAP_TGLM ?? '2'),
    cooldownMs: Number(env.FAUCET_COOLDOWN_HOURS ?? 24) * 3_600_000,
    // how many different wallets one network address may fund per cooldown. At an event everyone shares the venue's wifi (one public
    // address), so 1 would let a single person per day through. The daily cap and one drip per wallet still stop farming.
    perIp: Math.max(1, Number(env.FAUCET_PER_IP ?? 10) || 1),
  };
}

export async function createFaucet({ dataDir, chain, config = faucetConfigFromEnv(), now = () => Date.now() }) {
  const file = path.join(dataDir, 'faucet.json');
  let ledger = { drips: [] }; // { address, ip, at, amount, tx }
  if (existsSync(file)) { try { ledger = JSON.parse(await readFile(file, 'utf8')); } catch { /* start fresh */ } }
  let queue = Promise.resolve();
  const save = () => { queue = queue.then(async () => { await mkdir(dataDir, { recursive: true }); await writeFile(`${file}.tmp`, JSON.stringify(ledger, null, 2)); await rename(`${file}.tmp`, file); }); return queue; };

  const recent = () => ledger.drips.filter((d) => now() - d.at < config.cooldownMs);
  const spentToday = () => ledger.drips.filter((d) => now() - d.at < 86_400_000).reduce((a, d) => a + BigInt(d.amount), 0n);
  const fmt = (wei) => `${(Number(wei / 10n ** 12n) / 1e6).toFixed(3)} tGLM`.replace(/\.?0+ tGLM$/, ' tGLM');
  let busy = Promise.resolve();

  return {
    info: () => ({ enabled: true, token: 'tGLM', amount: fmt(config.amount), cooldownHours: config.cooldownMs / 3_600_000 }),

    drip(address, ip = '') {
      const run = busy.then(async () => {
        if (!ADDRESS.test(String(address ?? ''))) throw new FaucetError('bad_address', 'That is not a wallet address.');
        const addr = address.toLowerCase();
        const r = recent();
        if (r.some((d) => d.address === addr)) throw new FaucetError('cooldown', 'This wallet already got tGLM today. Try again tomorrow.', 429);
        const perIp = config.perIp ?? 1;
        if (ip && r.filter((d) => d.ip === ip).length >= perIp) throw new FaucetError('cooldown', `This network already got tGLM today (up to ${perIp} wallet${perIp === 1 ? '' : 's'} per network). Try again tomorrow, or use the Arkiv faucet at hub.arkiv.network/faucet.`, 429);
        if (spentToday() + config.amount > config.dailyCap) throw new FaucetError('daily_cap', 'The faucet is out of tGLM for today. Ask the organizer.', 503);
        if ((await chain.balanceOf(address)) >= config.amount * 2n) throw new FaucetError('has_enough', 'This wallet already has enough tGLM to run an ad.');
        if ((await chain.ownBalance()) < config.amount + ONE / 100n) throw new FaucetError('empty', 'The faucet wallet is empty. Ask the organizer to top it up.', 503);
        const tx = await chain.send(address, config.amount);
        ledger.drips.push({ address: addr, ip, at: now(), amount: String(config.amount), tx });
        ledger.drips = ledger.drips.filter((d) => now() - d.at < 7 * 86_400_000); // keep a week
        await save();
        return { tx, amount: fmt(config.amount), token: 'tGLM' };
      });
      busy = run.catch(() => {});
      return run;
    },
  };
}
