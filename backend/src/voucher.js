import { randomBytes } from 'node:crypto';
import { getAddress, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// The mint voucher: what the Stamp contract (contracts/src/Stamp.sol) accepts to mint one stamp. The backend signs it only
// after a capture was accepted (location checked, World ID proof verified). The signature is an EIP-712 typed-data
// signature, so it is bound to this chain and this contract: it cannot be replayed on another chain or deployment.

export const VOUCHER_DOMAIN_NAME = 'World3 Stamp';
export const VOUCHER_DOMAIN_VERSION = '1';
export const VOUCHER_TYPES = {
  Voucher: [
    { name: 'recipient', type: 'address' },
    { name: 'spotId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export const domainFor = ({ chainId, contract }) => ({
  name: VOUCHER_DOMAIN_NAME,
  version: VOUCHER_DOMAIN_VERSION,
  chainId,
  verifyingContract: contract,
});

// the key stays in this closure; nothing else can read it back
export function createVoucherSigner({ privateKey, chainId, contract, ttlSeconds = 7 * 24 * 3600, now = () => Date.now(), random = () => randomBytes(32) }) {
  if (!privateKey || !contract || !chainId) return null; // not configured: captures are recorded but no voucher is issued
  const account = privateKeyToAccount(privateKey);
  const verifyingContract = getAddress(contract);
  return {
    address: account.address,
    chainId,
    contract: verifyingContract,
    // A spot id in the app is a string like "06"; on chain it is the number 6.
    async sign({ recipient, spotId, nonce, deadline }) {
      if (!isAddress(recipient)) throw new Error('recipient is not an address');
      const message = {
        recipient: getAddress(recipient),
        spotId: BigInt(Number(spotId)),
        nonce: nonce ?? BigInt('0x' + random().toString('hex')),
        deadline: deadline ?? BigInt(Math.floor(now() / 1000) + ttlSeconds),
      };
      const signature = await account.signTypedData({ domain: domainFor({ chainId, contract: verifyingContract }), types: VOUCHER_TYPES, primaryType: 'Voucher', message });
      // strings, so JSON (and the phone) never loses precision on 256-bit numbers
      return { recipient: message.recipient, spotId: message.spotId.toString(), nonce: message.nonce.toString(), deadline: message.deadline.toString(), signature, chainId, contract: verifyingContract };
    },
  };
}

export function voucherConfigFromEnv(env = process.env) {
  return { privateKey: env.VOUCHER_SIGNER_KEY, chainId: Number(env.CHAIN_ID) || 11155111, contract: env.STAMP_CONTRACT };
}
