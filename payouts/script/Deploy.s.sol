// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CampaignEscrow} from "../src/CampaignEscrow.sol";

/// Deploys the escrow next to the Stamp contract that is already live. It does not touch the Stamp contract.
///   STAMP_CONTRACT=0x... OWNER=0x... forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $KEY
/// Not run yet: validation first happens on a local chain (see sim/e2e.mjs).
contract Deploy is Script {
    function run() external {
        address stampAddress = vm.envAddress("STAMP_CONTRACT");
        address owner = vm.envAddress("OWNER");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(1000))); // 10%
        uint64 claimWindow = uint64(vm.envOr("CLAIM_WINDOW_SECONDS", uint256(3 days)));
        uint64 sweepDelay = uint64(vm.envOr("SWEEP_DELAY_SECONDS", uint256(90 days)));
        vm.startBroadcast();
        CampaignEscrow escrow = new CampaignEscrow(stampAddress, owner, feeBps, claimWindow, sweepDelay);
        vm.stopBroadcast();
        console.log("CampaignEscrow", address(escrow));
    }
}
