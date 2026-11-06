// Registers the parent name on ENSv2 Sepolia with the ENS wallet (ENS_PRIVATE_KEY), paying with the free test USDC.
//   node scripts/ens-register-parent.mjs [label]      (default label: wrld3)
// Steps: check it is free -> price it -> mint test USDC -> approve -> commit -> wait 60 s -> register -> verify. Safe to re-run.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, parseAbi, toHex, zeroAddress, zeroHash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { SEPOLIA } from '../src/ens/addresses.js';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* env may already be set */ }
const label = process.argv[2] ?? 'wrld3';
const DURATION = 31_536_000n; // one year
const account = privateKeyToAccount(process.env.ENS_PRIVATE_KEY);
const transport = http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com');
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ chain: sepolia, transport, account });

const registrarAbi = parseAbi([
  'function isAvailable(string label) view returns (bool)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
]);
const registryAbi = parseAbi(['function getStatus(uint256 labelHash) view returns (uint8)', 'function ownerOf(uint256 id) view returns (address)']);
const usdcAbi = parseAbi(['function mint(address to, uint256 amount)', 'function approve(address spender, uint256 value) returns (bool)', 'function balanceOf(address) view returns (uint256)']);

const tx = async (hash) => { const r = await pub.waitForTransactionReceipt({ hash }); if (r.status !== 'success') throw new Error(`transaction ${hash} reverted`); return hash; };
const say = (m) => console.log(`  ${m}`);
const { keccak256, stringToBytes } = await import('viem');
const labelHash = BigInt(keccak256(stringToBytes(label)));

console.log(`\nRegistering ${label}.eth on ENSv2 Sepolia with ${account.address}`);
const status = await pub.readContract({ address: SEPOLIA.ethRegistry, abi: registryAbi, functionName: 'getStatus', args: [labelHash] });
if (status === 2) {
  const owner = await pub.readContract({ address: SEPOLIA.ethRegistry, abi: registryAbi, functionName: 'ownerOf', args: [labelHash] }).catch(() => null);
  say(`${label}.eth is already registered${owner ? ` (owner ${owner})` : ''}. ${owner?.toLowerCase() === account.address.toLowerCase() ? 'It is ours; nothing to do.' : 'It belongs to someone else: choose another label.'}`);
  process.exit(owner?.toLowerCase() === account.address.toLowerCase() ? 0 : 1);
}
if (!(await pub.readContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'isAvailable', args: [label] }))) throw new Error('the registrar says this name is not available');

const [base, premium] = await pub.readContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'getRegisterPrice', args: [label, DURATION, SEPOLIA.mockUsdc] });
const total = base + premium;
say(`price for 1 year: ${Number(total) / 1e6} test USDC (base ${Number(base) / 1e6}, premium ${Number(premium) / 1e6})`);
const eth = await pub.getBalance({ address: account.address });
say(`wallet has ${Number(eth) / 1e18} Sepolia ETH for gas`);
if (eth < 5_000_000_000_000_000n) throw new Error('not enough Sepolia ETH for gas (need about 0.005)');

// free test USDC, no access control (docs: MockUSDC.mint)
const have = await pub.readContract({ address: SEPOLIA.mockUsdc, abi: usdcAbi, functionName: 'balanceOf', args: [account.address] });
if (have < total) { await tx(await wallet.writeContract({ address: SEPOLIA.mockUsdc, abi: usdcAbi, functionName: 'mint', args: [account.address, total * 3n] })); say('minted test USDC'); }
await tx(await wallet.writeContract({ address: SEPOLIA.mockUsdc, abi: usdcAbi, functionName: 'approve', args: [SEPOLIA.ethRegistrar, total * 2n] })); say('approved the registrar to take the fee');

// commit, wait, reveal
const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
const args = [label, account.address, secret, zeroAddress, zeroAddress, DURATION, zeroHash];
const commitment = await pub.readContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'makeCommitment', args });
await tx(await wallet.writeContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'commit', args: [commitment] })); say('committed');
const wait = Number(await pub.readContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'MIN_COMMITMENT_AGE' })) + 5;
say(`waiting ${wait} s (the registrar requires a pause between commit and register)`);
await new Promise((r) => setTimeout(r, wait * 1000));
const hash = await tx(await wallet.writeContract({ address: SEPOLIA.ethRegistrar, abi: registrarAbi, functionName: 'register', args: [label, account.address, secret, zeroAddress, zeroAddress, DURATION, SEPOLIA.mockUsdc, zeroHash] }));

// the name's token id carries version bits, so read it (and the owner) from the registry's own transfer event
const receipt = await pub.getTransactionReceipt({ hash });
const TRANSFER_SINGLE = keccak256(stringToBytes('TransferSingle(address,address,address,uint256,uint256)'));
const log = receipt.logs.find((l) => l.address.toLowerCase() === SEPOLIA.ethRegistry && l.topics[0] === TRANSFER_SINGLE);
const tokenId = BigInt('0x' + log.data.slice(2, 66));
const owner = await pub.readContract({ address: SEPOLIA.ethRegistry, abi: registryAbi, functionName: 'ownerOf', args: [tokenId] });
const after = await pub.readContract({ address: SEPOLIA.ethRegistry, abi: registryAbi, functionName: 'getStatus', args: [labelHash] });
console.log(`\n  ${label}.eth registered: status ${after} (2 = registered), owner ${owner}\n  tx ${hash}\n`);

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const file = new URL('../data/ens.json', import.meta.url);
const state = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
await writeFile(file, JSON.stringify({ ...state, parent: `${label}.eth`, labelHash: labelHash.toString(), owner, tokenId: tokenId.toString(), registerTx: hash, registeredAt: new Date().toISOString() }, null, 2));
