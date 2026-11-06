import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPublicClient, createWalletClient, getAddress, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// The Stamp contract's registry (contracts/src/Stamp.sol). When a spot is published, its name, label and open window are
// written to the contract, so anyone can list the stamps straight from the chain and mint one with a voucher. Deleting a spot here
// closes it on chain (new mints stop; stamps already minted stay). The organizer wallet pays the gas and is the contract's owner.

const ABI = parseAbi([
  'function registerSpot(uint256 spotId, string name, string label, uint64 startsAt, uint64 endsAt)',
  'function registerSpots((uint256 spotId, string name, string label, uint64 startsAt, uint64 endsAt)[] items)',
  'function closeSpot(uint256 spotId)',
  'function spots(uint256) view returns (string name, string label, uint64 startsAt, uint64 endsAt, bool exists)',
  'function isOpen(uint256 spotId) view returns (bool)',
  'function mint((address recipient, uint256 spotId, uint256 nonce, uint256 deadline) v, bytes signature)',
]);

const secs = (iso) => (iso ? BigInt(Math.floor(Date.parse(iso) / 1000)) : 0n);
const fingerprint = (r) => createHash('sha1').update(JSON.stringify(r)).digest('hex').slice(0, 16);
const numId = (id) => BigInt(Number(id));
// Sepolia prices contract writes steeply and node estimates run short, so every write states a generous limit (it pays for what it uses)
const GAS = { one: 900_000n, batch: 14_000_000n, mint: 900_000n };

export function recordFor(spot, ev) {
  return { spotId: numId(spot.id), name: String(spot.name).slice(0, 60), label: String(spot.label ?? '').slice(0, 14), startsAt: secs(ev?.startsAt), endsAt: secs(ev?.endsAt) };
}

export async function createStampChain({ dataDir, privateKey, rpcUrl, contract, chainId = 11155111, clients = null }) {
  if (!contract || (!privateKey && !clients)) return { enabled: false };
  const file = path.join(dataDir, 'chain.json');
  await mkdir(dataDir, { recursive: true });
  const ledger = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).spots ?? {} : {}; // spotId -> { fp, tx, at, closed? }
  let saving = Promise.resolve();
  const save = () => { const data = JSON.stringify({ version: 1, contract, chainId, spots: ledger }, null, 2); saving = saving.then(async () => { await writeFile(`${file}.tmp`, data); await rename(`${file}.tmp`, file); }); return saving; };

  const address = getAddress(contract);
  let pub; let wallet; let owner;
  if (clients) ({ pub, wallet, owner } = clients);
  else {
    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl || 'https://ethereum-sepolia-rpc.publicnode.com');
    pub = createPublicClient({ chain: sepolia, transport });
    wallet = createWalletClient({ chain: sepolia, transport, account });
    owner = account.address;
  }

  let tail = Promise.resolve(); // one writer: the same wallet signs everything, and two at once collide on the nonce
  const serial = (fn) => { const run = tail.then(fn, fn); tail = run.catch(() => {}); return run; };
  const send = async (functionName, args, gas) => {
    const hash = await wallet.writeContract({ address, abi: ABI, functionName, args, gas });
    const rc = await pub.waitForTransactionReceipt({ hash });
    if (rc.status !== 'success') throw new Error(`${functionName} reverted on chain`);
    return hash;
  };

  return {
    enabled: true, address, chainId, owner,
    explorer: `https://sepolia.etherscan.io/address/${address}`,
    txUrl: (h) => `https://sepolia.etherscan.io/tx/${h}`,
    status: (id) => ledger[String(id)] ?? null,
    count: () => Object.values(ledger).filter((x) => x && !x.closed).length,

    // write one spot (skipped when what is on chain already matches)
    sync: (spot, ev) => serial(async () => {
      const r = recordFor(spot, ev); const fp = fingerprint({ ...r, spotId: r.spotId.toString(), startsAt: r.startsAt.toString(), endsAt: r.endsAt.toString() });
      const have = ledger[String(spot.id)];
      if (have && have.fp === fp && !have.closed) return have;
      const tx = await send('registerSpot', [r.spotId, r.name, r.label, r.startsAt, r.endsAt], GAS.one);
      ledger[String(spot.id)] = { fp, tx, at: new Date().toISOString() };
      await save();
      return ledger[String(spot.id)];
    }),

    // first import of many spots, in a few transactions
    syncMany: (items) => serial(async () => {
      const todo = items.map(({ spot, ev }) => ({ spot, r: recordFor(spot, ev) })).filter(({ spot, r }) => {
        const fp = fingerprint({ ...r, spotId: r.spotId.toString(), startsAt: r.startsAt.toString(), endsAt: r.endsAt.toString() });
        const have = ledger[String(spot.id)]; r.fp = fp;
        return !have || have.fp !== fp || have.closed;
      });
      let done = 0;
      for (let i = 0; i < todo.length; i += 25) {
        const chunk = todo.slice(i, i + 25);
        const tx = await send('registerSpots', [chunk.map(({ r }) => ({ spotId: r.spotId, name: r.name, label: r.label, startsAt: r.startsAt, endsAt: r.endsAt }))], GAS.batch);
        for (const { spot, r } of chunk) ledger[String(spot.id)] = { fp: r.fp, tx, at: new Date().toISOString() };
        await save(); done += chunk.length;
      }
      return { registered: done, skipped: items.length - todo.length };
    }),

    // a deleted spot: no new stamps (the ones already minted stay)
    close: (id) => serial(async () => {
      const have = ledger[String(id)]; if (!have || have.closed) return null;
      const tx = await send('closeSpot', [numId(id)], GAS.one);
      ledger[String(id)] = { ...have, closed: true, closeTx: tx }; await save();
      return tx;
    }),

    // submit a voucher the backend signed (anyone may; here the organizer wallet relays and pays)
    mint: (voucher) => serial(async () => send('mint', [{ recipient: voucher.recipient, spotId: BigInt(voucher.spotId), nonce: BigInt(voucher.nonce), deadline: BigInt(voucher.deadline) }, voucher.signature], GAS.mint)),

    // what the chain itself says (not our ledger)
    onChain: async (id) => { const [name, label, startsAt, endsAt, exists] = await pub.readContract({ address, abi: ABI, functionName: 'spots', args: [numId(id)] }); return { name, label, startsAt: Number(startsAt), endsAt: Number(endsAt), exists }; },
  };
}
