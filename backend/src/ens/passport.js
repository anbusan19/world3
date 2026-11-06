import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { encodeFunctionData, createPublicClient, createWalletClient, http, parseAbi, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { permissionedResolverRevokeRootRolesSnippet } from '@ensdomains/ensjs/contracts';
import { RESOLVER_ALL_ROLES, registryRoles } from '@ensdomains/ensjs/utils/v2';
import { createSubname, deploySubregistry, grantResolverRoles, setRecords, setSubregistry } from '@ensdomains/ensjs/wallet/v2';
import { deploySubregistryWriteParameters, deployVerifiableProxyWriteParameters } from '@ensdomains/ensjs/wallet/v2';
import { SEPOLIA } from './addresses.js';

// The ENSv2 passport. Each traveler gets a name like a7k2.wrld3.eth with ITS OWN small resolver. ENSv2 resolver permissions have no
// per-name scoping (a role holder can write on every name a resolver serves), so a resolver per passport is what lets us say:
//   - the traveler holds every right over their own records;
//   - the backend holds exactly ONE right: setting the text record `world3.stamps`. It cannot edit any other record or change
//     who owns the name.
// The parent name's owner (the organizer wallet) is outside this promise: it controls the parent and the registry.

export const STAMPS_KEY = 'world3.stamps';
const ownerRoles = registryRoles.ROLE_SET_RESOLVER | registryRoles.ROLE_SET_SUBREGISTRY; // no ROLE_CAN_TRANSFER_ADMIN: not transferable
const backendRegistryRoles = registryRoles.ROLE_REGISTRAR | registryRoles.ROLE_RENEW; // may create and renew passports, nothing else

const resolverAbi = parseAbi([
  'function initialize((address account, uint256 roleBitmap)[] grants, bytes[] calls)',
  'function setText(bytes name, string key, string value)',
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
]);
const dns = (name) => '0x' + name.split('.').map((l) => l.length.toString(16).padStart(2, '0') + Buffer.from(l).toString('hex')).join('') + '00';

export async function createEns({ privateKey, rpcUrl, dataDir, parent = 'wrld3.eth' }) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl || 'https://ethereum-sepolia-rpc.publicnode.com');
  const pub = createPublicClient({ chain: sepolia, transport });
  const wallet = createWalletClient({ chain: sepolia, transport, account });
  const file = `${dataDir}/ens.json`;
  const load = async () => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {});
  const save = async (patch) => { await mkdir(dataDir, { recursive: true }); await writeFile(file, JSON.stringify({ ...(await load()), ...patch }, null, 2)); };
  const wait = async (hash) => { const r = await pub.waitForTransactionReceipt({ hash }); if (r.status !== 'success') throw new Error(`transaction ${hash} reverted`); return r; };
  const label = parent.replace(/\.eth$/, '');

  // simulate a proxy deploy to learn the address it will get, then send it
  async function deployProxy(params) {
    const { result, request } = await pub.simulateContract({ ...params, account });
    await wait(await wallet.writeContract(request));
    return result;
  }

  return {
    account, pub, wallet, parent, load, save, wait,

    // once: a registry for the parent's subnames, owned by nobody but holding the backend's limited rights, attached to the parent
    async ensureRegistry() {
      const st = await load();
      if (st.userRegistry) return st.userRegistry;
      const p = deploySubregistryWriteParameters(wallet, { factoryAddress: SEPOLIA.verifiableFactory, implAddress: SEPOLIA.userRegistryImpl, adminAddress: account.address, roleBitmap: backendRegistryRoles });
      const registry = await deployProxy(p);
      const hash = await setSubregistry(wallet, { registryAddress: SEPOLIA.ethRegistry, label, subregistryAddress: registry });
      await wait(hash);
      await save({ userRegistry: registry, setSubregistryTx: hash });
      return registry;
    },

    // one passport: its own resolver, the right split of permissions, the name, and the first stamps record
    async createPassport({ name, owner, stamps = '' }) {
      const registry = await this.ensureRegistry();
      const full = `${name}.${parent}`;
      // 1. the traveler's own resolver. The traveler and (for now) the backend both start with every right.
      const callData = encodeFunctionData({ abi: resolverAbi, functionName: 'initialize', args: [[{ account: owner, roleBitmap: RESOLVER_ALL_ROLES }, { account: account.address, roleBitmap: RESOLVER_ALL_ROLES }], []] });
      const resolver = await deployProxy(deployVerifiableProxyWriteParameters(wallet, { factoryAddress: SEPOLIA.verifiableFactory, implAddress: SEPOLIA.permissionedResolverImpl, callData }));
      // 2. the backend gets the one record right, then gives up everything else it started with
      await wait(await grantResolverRoles(wallet, { resolverAddress: resolver, targetAccount: account.address, scope: 'setter', setter: { kind: 'text', key: STAMPS_KEY } }));
      await wait(await wallet.writeContract({ address: resolver, abi: [permissionedResolverRevokeRootRolesSnippet[0]], functionName: 'revokeRootRoles', args: [RESOLVER_ALL_ROLES, account.address] }));
      // 3. the name itself, owned by the traveler
      const nameTx = await createSubname(wallet, { registryAddress: registry, label: name, owner, subregistryAddress: zeroAddress, resolverAddress: resolver, roleBitmap: ownerRoles });
      await wait(nameTx);
      // 4. the stamps record, written by the backend's one right
      const recordTx = stamps ? await this.setStamps({ name: full, resolver, value: stamps }) : null;
      return { name: full, resolver, owner, registry, nameTx, recordTx };
    },

    async setStamps({ name, resolver, value }) {
      const hash = await setRecords(wallet, { name, resolverAddress: resolver, texts: [{ key: STAMPS_KEY, value }] });
      await wait(hash);
      return hash;
    },

    // would this account be allowed to set this text key? (a simulation: nothing is sent, nothing costs gas)
    async canSetText({ resolver, name, key, as }) {
      try {
        await pub.simulateContract({ address: resolver, abi: resolverAbi, functionName: 'setText', args: [dns(name), key, 'x'], account: as });
        return { allowed: true };
      } catch (e) {
        return { allowed: false, why: String(e?.cause?.errorName ?? e?.cause?.data?.errorName ?? e?.shortMessage ?? 'reverted').slice(0, 80) };
      }
    },
  };
}
