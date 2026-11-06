// End-to-end check on a throwaway local chain (anvil). It uses the REAL Stamp contract and the backend's REAL voucher signer
// (read only, nothing in ../backend or ../contracts is changed), then walks a whole event:
//   deploy -> register a spot -> sponsors fund -> travelers get stamps -> the event ends -> holders registered -> finalised -> paid.
//   npm install && forge build && npm run e2e
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { createVoucherSigner } from '../../backend/src/voucher.js';

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
// anvil's well-known test keys (worthless, public)
const KEYS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // 0 organizer / owner
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // 1 backend signer and relayer
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // 2 sponsor A
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // 3 sponsor B
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', // 4..8 travelers
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f265e2d4f9fa6a1a5eb2d16f4f5d8e5b8a5d62f4e',
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', // 9 treasury
].map((k) => privateKeyToAccount(k));
const [organizer, relayer, sponsorA, sponsorB, t1, t2, t3, t4, t5, treasury] = KEYS;
const travelers = [t1, t2, t3, t4, t5];

const artifact = (path) => JSON.parse(readFileSync(new URL(`../out/${path}`, import.meta.url)));
const stampArt = artifact('Stamp.sol/Stamp.json');
const escrowArt = artifact('CampaignEscrow.sol/CampaignEscrow.json');

let failures = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`); if (!ok) failures++; };
const rpc = (method, params = []) => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json());

const anvil = spawn('anvil', ['--port', String(PORT), '--silent'], { stdio: 'inherit' });
const stop = () => { try { anvil.kill(); } catch { /* already gone */ } };
process.on('exit', stop);
for (let i = 0; i < 50; i++) { try { await rpc('eth_chainId'); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallet = (account) => createWalletClient({ account, chain: foundry, transport: http(RPC) });
const wait = (hash) => pub.waitForTransactionReceipt({ hash });
const gasUsed = {};
const send = async (label, hash) => { const r = await wait(hash); (gasUsed[label] ||= []).push(Number(r.gasUsed)); return r; };
const expectRevert = async (label, fn, name) => {
  try { await fn(); check(label, false, 'did not revert'); } catch (e) { check(label, String(e.message || e).includes(name), name); }
};

try {
  console.log('--- deploy');
  const deploy = async (art, args, account) => { const h = await wallet(account).deployContract({ abi: art.abi, bytecode: art.bytecode.object, args }); return (await wait(h)).contractAddress; };
  const stamp = await deploy(stampArt, [relayer.address, organizer.address, ''], organizer);
  const WINDOW = 60n, SWEEP = 3600n; // short windows for the test chain
  const escrow = await deploy(escrowArt, [stamp, organizer.address, 1000, WINDOW, SWEEP], organizer);
  const S = { address: stamp, abi: stampArt.abi }, E = { address: escrow, abi: escrowArt.abi };
  console.log('stamp', stamp, '\nescrow', escrow);

  // the backend's own voucher signer, pointed at this local Stamp
  const signer = createVoucherSigner({ privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', chainId: foundry.id, contract: stamp });
  const mint = async (to, spotId) => {
    const v = await signer.sign({ recipient: to, spotId });
    const args = [{ recipient: v.recipient, spotId: BigInt(v.spotId), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) }, v.signature];
    return send('mint (relayer pays)', await wallet(relayer).writeContract({ ...S, functionName: 'mint', args }));
  };

  console.log('--- the event');
  const now = Number((await pub.getBlock()).timestamp);
  const endsAt = BigInt(now + 3600);
  await send('registerSpot', await wallet(organizer).writeContract({ ...S, functionName: 'registerSpot', args: [83n, 'World', 'WORLD', 0n, endsAt] }));
  await send('fund', await wallet(sponsorA).writeContract({ ...E, functionName: 'fund', args: [83n], value: parseEther('6') }));
  await send('fund', await wallet(sponsorB).writeContract({ ...E, functionName: 'fund', args: [83n], value: parseEther('4') }));
  check('the pool holds 10 ETH', (await pub.getBalance({ address: escrow })) === parseEther('10'));

  for (const t of travelers) await mint(t.address, '83');
  const bal = async (a) => pub.readContract({ ...S, functionName: 'balanceOf', args: [a, 83n] });
  check('five travelers hold a stamp', (await Promise.all(travelers.map((t) => bal(t.address)))).every((b) => b === 1n));
  await expectRevert('the same traveler cannot be stamped twice', () => mint(t1.address, '83'), 'AlreadyStamped');
  await expectRevert('a stamp cannot be moved', () => wallet(t1).writeContract({ ...S, functionName: 'safeTransferFrom', args: [t1.address, t2.address, 83n, 1n, '0x'] }), 'NonTransferable');
  await expectRevert('cannot register a holder before the event ends', () => wallet(relayer).writeContract({ ...E, functionName: 'register', args: [83n, t1.address] }), 'NotEnded');

  console.log('--- the event ends');
  await rpc('evm_setNextBlockTimestamp', [Number(endsAt)]); await rpc('evm_mine');
  await expectRevert('minting stops when the event ends', () => mint(t5.address, '83').catch((e) => { throw e; }), 'SpotNotOpen').catch(() => {});
  await expectRevert('cannot fund after the event ends', () => wallet(sponsorA).writeContract({ ...E, functionName: 'fund', args: [83n], value: 1n }), 'AlreadyEnded');
  // a late traveler cannot get a stamp any more
  const late = privateKeyToAccount('0x' + '11'.repeat(32));
  await expectRevert('a late traveler gets no stamp', () => mint(late.address, '83'), 'SpotNotOpen');

  console.log('--- holders registered by the relayer');
  for (const t of travelers) await send('register (relayer pays)', await wallet(relayer).writeContract({ ...E, functionName: 'register', args: [83n, t.address] }));
  await expectRevert('someone without a stamp cannot be registered', () => wallet(relayer).writeContract({ ...E, functionName: 'register', args: [83n, late.address] }), 'NoStamp');
  await expectRevert('cannot finalise while the window is open', () => wallet(relayer).writeContract({ ...E, functionName: 'finalize', args: [83n] }), 'WindowOpen');

  await rpc('evm_setNextBlockTimestamp', [Number(endsAt + WINDOW)]); await rpc('evm_mine');
  await send('finalize', await wallet(relayer).writeContract({ ...E, functionName: 'finalize', args: [83n] }));
  const pool = await pub.readContract({ ...E, functionName: 'pools', args: [83n] });
  check('each of the 5 holders is owed 1.8 ETH (9 ETH / 5)', pool[1] === parseEther('1.8'), formatEther(pool[1]));
  check('the protocol holds 1 ETH (10%)', (await pub.readContract({ ...E, functionName: 'protocolBalance' })) === parseEther('1'));

  console.log('--- payouts');
  const before = await Promise.all(travelers.map((t) => pub.getBalance({ address: t.address })));
  for (const t of travelers) await send('withdraw (relayer pays)', await wallet(relayer).writeContract({ ...E, functionName: 'withdraw', args: [83n, t.address] }));
  const after = await Promise.all(travelers.map((t) => pub.getBalance({ address: t.address })));
  check('every traveler received exactly 1.8 ETH and paid no gas', after.every((a, i) => a - before[i] === parseEther('1.8')));
  await expectRevert('nobody is paid twice', () => wallet(relayer).writeContract({ ...E, functionName: 'withdraw', args: [83n, t1.address] }), 'AlreadyPaid');
  await expectRevert('only the organizer takes the protocol share', () => wallet(sponsorA).writeContract({ ...E, functionName: 'withdrawProtocol', args: [treasury.address] }), 'OwnableUnauthorizedAccount');
  const tBefore = await pub.getBalance({ address: treasury.address });
  await send('withdrawProtocol', await wallet(organizer).writeContract({ ...E, functionName: 'withdrawProtocol', args: [treasury.address] }));
  check('the protocol received 1 ETH', (await pub.getBalance({ address: treasury.address })) - tBefore === parseEther('1'));
  check('the escrow is empty at the end', (await pub.getBalance({ address: escrow })) === 0n);

  console.log('\n--- gas per call (the relayer pays these)');
  for (const [k, v] of Object.entries(gasUsed)) console.log(`${k.padEnd(28)} ${Math.round(v.reduce((a, b) => a + b, 0) / v.length).toLocaleString()} gas`);
} catch (e) {
  console.error('\nERROR', e?.shortMessage || e?.message || e);
  failures++;
} finally {
  stop();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll end-to-end checks passed.');
process.exit(failures ? 1 : 0);
