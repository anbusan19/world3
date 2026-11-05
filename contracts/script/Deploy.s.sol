// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Stamp} from "../src/Stamp.sol";

/// Deploy the stamp contract.
///   STAMP_SIGNER  address of the backend key that signs vouchers (not its private key)
///   STAMP_OWNER   optional; defaults to the deployer
///   STAMP_URI     optional; token metadata URI template
/// Sepolia:  forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_KEY --broadcast
contract Deploy is Script {
    function run() external returns (Stamp stamp) {
        address signer = vm.envAddress("STAMP_SIGNER");
        string memory uri = vm.envOr("STAMP_URI", string("https://world3.example/stamps/{id}.json"));
        vm.startBroadcast();
        address owner = vm.envOr("STAMP_OWNER", msg.sender);
        stamp = new Stamp(signer, owner, uri);
        vm.stopBroadcast();
        console.log("Stamp deployed at", address(stamp));
        console.log("signer", signer);
        console.log("owner", owner);
    }
}
