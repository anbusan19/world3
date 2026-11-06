# Sponsor funding and holder payouts (built separately)

Sponsors fund a stamp. When the event ends, the pool is split: **10% to the protocol, the rest equally between the people who
hold that stamp.** This folder is its own project on purpose: **nothing in the app, the backend, the Stamp contract or the AWS
server was changed**, so it can be tested on its own and joined up later.

It reuses `../contracts/src/Stamp.sol` (the real, unchanged contract) and the backend's real voucher signer, read only.

## How it works

```
sponsor ──fund(spot)──▶ CampaignEscrow            (until the spot's event ends; ETH on Sepolia for now)

event ends (the Stamp contract's own spot window, set by the organizer)
   minting stops, funding stops, the claim window opens (default 3 days)

anyone ──register(spot, holder)──▶ counts a wallet that really holds the stamp (once each). The relayer does everyone.

claim window closes
anyone ──finalize(spot)──▶ fee = 10% to the protocol, the rest / (holders counted) = each holder's share
                           (rounding dust stays with the protocol; nobody held a stamp: no fee, sponsors can refund)

anyone ──withdraw(spot, holder)──▶ pays that holder (the money always goes to the holder)
owner  ──withdrawProtocol(to)──▶ the protocol's share
anyone ──sweep(spot)── after 90 days ──▶ shares nobody withdrew go to the protocol, so nothing is stuck
```

**Why holders are counted by the escrow.** The deployed Stamp has no total supply, and it can't be changed (it is live). So the
escrow counts holders itself in the claim window, checking each against `Stamp.balanceOf`. That keeps the Stamp contract
untouched, and the escrow works with the stamps people already have.

## What was validated

| Check | Result |
| --- | --- |
| `forge test`: 27 tests, including a 512-run fuzz that every wei is accounted for (holders + protocol = pool, contract ends empty, everyone paid the same) | all pass |
| Hostile holders: a contract that re-enters `withdraw`, and one that refuses money | cannot be paid twice, cannot block anyone else |
| Wrong stamps: another spot's stamp, a burned stamp, no stamp | not counted |
| Nobody there: sponsors get everything back, no fee | pass |
| Timing: no funding after the end, no finalising before the window closes, no minting after the end | pass |
| `npm run e2e`: a real anvil chain, the real Stamp, the backend's real voucher signer, 5 travelers, 2 sponsors, a whole event | all 17 checks pass |

Gas per call on the local chain (the relayer pays these, travelers pay nothing): mint 88k, register 75k, withdraw 73k,
finalize 94k, fund 77k.

Run it yourself:

```
cd payouts
npm install
forge test
forge build && npm run e2e      # needs anvil (comes with Foundry)
```

## What is not done (said plainly)

- **Not deployed anywhere.** Not on Sepolia, not on the server. Local chain only.
- **Testnet ETH only.** No USDC or other tokens yet.
- **Not audited.**
- **Who owns the payout wallet.** Today the server holds a wallet for each traveler (the one that owns their passport name), so a
  payout lands in a wallet the traveler does not directly control. Before real value moves, the app needs "send my winnings to my
  own address", or travelers must bring their own wallet.
- **The organizer controls timing.** The event end is the Stamp contract's `endsAt`, which the organizer can change. A sponsor
  trusts the organizer not to move it unfairly.
- **Someone must call `register`.** The relayer will, for everyone. A holder the relayer misses can register themselves in the window.

## Joining it up later (a plan, nothing done yet)

1. **Deploy** the escrow to Sepolia with `script/Deploy.s.sol` (needs the live Stamp address and a little Sepolia ETH). The Stamp contract is not redeployed.
2. **Backend** (one new module, no change to captures): after a spot ends, the relayer registers every holder, finalizes after the window, then withdraws for each. Plus a read route for the pool and an estimated share per stamp.
3. **Sponsor page:** a "Fund this spot" button that sends `fund(spotId)` (the page is on the Arkiv chain today, so it also asks the wallet to switch to Sepolia).
4. **App:** show the prize pool on a spot, and "you received X" after the payout. This is an app release.
5. **AWS:** `update.sh` for the backend module, with the escrow address and relayer settings in `.env`.
