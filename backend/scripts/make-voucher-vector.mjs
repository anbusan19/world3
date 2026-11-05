// Writes a fixed, public test vector (a throwaway key, never a real one) that the Solidity test reads back, so the Node
// signer and the contract are proven to agree on the encoding. Run: node scripts/make-voucher-vector.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createVoucherSigner } from '../src/voucher.js';

const privateKey = '0x' + '11'.repeat(32);
const contract = '0x00000000000000000000000000000000000057a4'; // where the Solidity test deploys the contract
const signer = createVoucherSigner({ privateKey, chainId: 11155111, contract });
const voucher = await signer.sign({
  recipient: '0x00000000000000000000000000000000000a11ce',
  spotId: 6,
  nonce: 123456789n,
  deadline: 4102444800n, // 2100-01-01
});
const out = { signer: signer.address, ...voucher };
await mkdir(new URL('../../contracts/test/vectors/', import.meta.url), { recursive: true });
await writeFile(new URL('../../contracts/test/vectors/voucher.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(out);
