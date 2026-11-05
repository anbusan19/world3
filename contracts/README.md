# World3 stamp contract

`src/Stamp.sol`: a **non-transferable ERC-1155**. Each spot is a token id; capturing mints one stamp to the traveler.

- **Mint only with a voucher.** `mint(voucher, signature)` needs an EIP-712 signature from the backend's signer key. The
  backend signs only after it has checked the person's location and their World ID proof, so verification rules can change
  without redeploying. The voucher is `Voucher(address recipient, uint256 spotId, uint256 nonce, uint256 deadline)`;
  the domain is `World3 Stamp` v1 on the chain and contract address, so a voucher cannot be replayed elsewhere.
- **Anyone can relay a voucher** (the backend's relayer pays gas); the stamp always goes to the voucher's `recipient`.
- **One stamp per wallet per spot**, and each nonce works once.
- **Non-transferable:** transfers and approvals revert. The holder can `burn` their own stamp (a public travel history is
  something a person should be able to delete).
- **No coordinates on chain.** A stamp is only (recipient, spot id).
- The owner can rotate the signer key (`setSigner`) and change the metadata URI.

Not audited. Testnet only.

## Run the tests

```
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git   # once; lib/ is not committed
forge test
```

`StampBackendVectorTest` loads `test/vectors/voucher.json`, a voucher signed by the Node backend (`backend/src/voucher.js`),
and mints it, so the signer and the contract are proven to agree. Regenerate it with
`node backend/scripts/make-voucher-vector.mjs`.

## Deploy (Sepolia)

```
STAMP_SIGNER=<address of the backend voucher key> \
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_KEY --broadcast
```

Then set `STAMP_CONTRACT` (the printed address) and `CHAIN_ID=11155111` in `backend/.env`. The backend's
`VOUCHER_SIGNER_KEY` must be the private key behind `STAMP_SIGNER`.
