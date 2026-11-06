// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Stamp} from "../src/Stamp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract StampTest is Test {
    Stamp stamp;
    uint256 signerKey = 0xA11CE;
    address signer;
    address owner = address(0x0123);
    address alice = address(0xA11);
    address bob = address(0xB0B);
    address relayer = address(0x7E1A);

    event Stamped(address indexed recipient, uint256 indexed spotId, uint256 nonce);

    function setUp() public {
        signer = vm.addr(signerKey);
        stamp = new Stamp(signer, owner, "https://world3.example/stamps/{id}.json");
        vm.warp(1_800_000_000);
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 12; i++) stamp.registerSpot(i, "Spot", "SPOT", 0, 0); // every spot the tests mint is registered
        vm.stopPrank();
    }

    // ------------------------------------------------------------------------------------------------- helpers

    function _voucher(address to, uint256 spot, uint256 nonce) internal view returns (Stamp.Voucher memory) {
        return Stamp.Voucher({recipient: to, spotId: spot, nonce: nonce, deadline: block.timestamp + 1 hours});
    }

    function _sign(uint256 key, Stamp.Voucher memory v) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, stamp.voucherDigest(v));
        return abi.encodePacked(r, s, vv);
    }

    function _mint(address to, uint256 spot, uint256 nonce) internal returns (Stamp.Voucher memory v, bytes memory sig) {
        v = _voucher(to, spot, nonce);
        sig = _sign(signerKey, v);
        stamp.mint(v, sig);
    }

    // ---------------------------------------------------------------------------------------------- the happy path

    function test_mintsOneStampToTheRecipient() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.expectEmit(true, true, false, true);
        emit Stamped(alice, 7, 1);
        stamp.mint(v, sig);
        assertEq(stamp.balanceOf(alice, 7), 1);
        assertTrue(stamp.usedNonce(1));
    }

    function test_anyoneCanRelayAVoucher_stampGoesToTheRecipient() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.prank(relayer);
        stamp.mint(v, sig);
        assertEq(stamp.balanceOf(alice, 7), 1);
        assertEq(stamp.balanceOf(relayer, 7), 0);
    }

    function test_samePersonCanHoldDifferentSpots() public {
        _mint(alice, 1, 1);
        _mint(alice, 2, 2);
        assertEq(stamp.balanceOf(alice, 1), 1);
        assertEq(stamp.balanceOf(alice, 2), 1);
    }

    // ------------------------------------------------------------------------------------------------- refusals

    function test_revertsWhenTheVoucherExpired() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.warp(v.deadline + 1);
        vm.expectRevert(Stamp.VoucherExpired.selector);
        stamp.mint(v, sig);
    }

    function test_acceptsAVoucherOnItsDeadlineSecond() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.warp(v.deadline);
        stamp.mint(v, sig);
        assertEq(stamp.balanceOf(alice, 7), 1);
    }

    function test_revertsOnReplayOfTheSameVoucher() public {
        (Stamp.Voucher memory v, bytes memory sig) = _mint(alice, 7, 1);
        vm.expectRevert(Stamp.NonceUsed.selector);
        stamp.mint(v, sig);
    }

    function test_revertsWhenSignedByAnyoneButTheSigner() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(0xBAD, v);
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(v, sig);
    }

    function test_revertsWhenAnyFieldIsTamperedWith() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);

        Stamp.Voucher memory t = v;
        t.recipient = bob; // someone else tries to take the stamp
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(t, sig);

        t = v;
        t.spotId = 8; // a different spot
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(t, sig);

        t = v;
        t.deadline = v.deadline + 1 days; // a longer life
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(t, sig);

        t = v;
        t.nonce = 2; // a fresh nonce to replay under
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(t, sig);
    }

    function test_revertsOnAMalformedSignature() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        vm.expectRevert(); // ECDSAInvalidSignatureLength
        stamp.mint(v, hex"1234");
    }

    function test_oneStampPerPersonPerSpot_evenWithANewVoucher() public {
        _mint(alice, 7, 1);
        Stamp.Voucher memory v = _voucher(alice, 7, 2); // a second voucher for the same person and spot
        bytes memory sig = _sign(signerKey, v);
        vm.expectRevert(Stamp.AlreadyStamped.selector);
        stamp.mint(v, sig);
        assertFalse(stamp.usedNonce(2));
    }

    // ---------------------------------------------------------------------------------------- replay across chains

    function test_aVoucherDoesNotWorkOnAnotherChain() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(v, sig);
    }

    function test_aVoucherDoesNotWorkOnAnotherDeployment() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory sig = _sign(signerKey, v);
        Stamp other = new Stamp(signer, owner, "x");
        vm.prank(owner);
        other.registerSpot(7, "Spot", "SPOT", 0, 0);
        vm.expectRevert(Stamp.BadSignature.selector);
        other.mint(v, sig);
    }

    // ----------------------------------------------------------------------------------------- non-transferable

    function test_stampsCannotBeTransferred() public {
        _mint(alice, 7, 1);
        vm.startPrank(alice);
        vm.expectRevert(Stamp.NonTransferable.selector);
        stamp.safeTransferFrom(alice, bob, 7, 1, "");
        uint256[] memory ids = new uint256[](1);
        ids[0] = 7;
        uint256[] memory vals = new uint256[](1);
        vals[0] = 1;
        vm.expectRevert(Stamp.NonTransferable.selector);
        stamp.safeBatchTransferFrom(alice, bob, ids, vals, "");
        vm.stopPrank();
        assertEq(stamp.balanceOf(alice, 7), 1);
        assertEq(stamp.balanceOf(bob, 7), 0);
    }

    function test_approvalsAreDisabled_soNoOneCanMoveAStampOnBehalfOfAHolder() public {
        _mint(alice, 7, 1);
        vm.prank(alice);
        vm.expectRevert(Stamp.NonTransferable.selector);
        stamp.setApprovalForAll(bob, true);
        vm.prank(bob);
        vm.expectRevert();
        stamp.safeTransferFrom(alice, bob, 7, 1, "");
    }

    // ---------------------------------------------------------------------------------------- holder deletes it

    function test_aHolderCanBurnTheirOwnStamp_andNobodyElseCan() public {
        _mint(alice, 7, 1);
        vm.prank(bob);
        vm.expectRevert(); // bob holds nothing
        stamp.burn(7);
        vm.prank(alice);
        stamp.burn(7);
        assertEq(stamp.balanceOf(alice, 7), 0);
    }

    // --------------------------------------------------------------------------------------------------- admin

    function test_ownerCanRotateTheSigner_andOldVouchersStopWorking() public {
        Stamp.Voucher memory v = _voucher(alice, 7, 1);
        bytes memory oldSig = _sign(signerKey, v);
        uint256 newKey = 0xB0B1;
        vm.prank(owner);
        stamp.setSigner(vm.addr(newKey));
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(v, oldSig);
        stamp.mint(v, _sign(newKey, v));
        assertEq(stamp.balanceOf(alice, 7), 1);
    }

    function test_onlyTheOwnerCanChangeSettings() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        stamp.setSigner(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        stamp.setURI("x");
    }

    function test_theSignerCannotBeZero() public {
        vm.prank(owner);
        vm.expectRevert(Stamp.ZeroAddress.selector);
        stamp.setSigner(address(0));
        vm.expectRevert(Stamp.ZeroAddress.selector);
        new Stamp(address(0), owner, "x");
    }

    // --------------------------------------------------------------------------------------------------- fuzz

    function testFuzz_anyValidVoucherMintsExactlyOne(address to, uint256 spot, uint256 nonce) public {
        vm.assume(to != address(0) && to.code.length == 0);
        spot = bound(spot, 1, 12); // the spots registered in setUp
        _mint(to, spot, nonce);
        assertEq(stamp.balanceOf(to, spot), 1);
    }

    function testFuzz_aSignatureForOneRecipientNeverMintsForAnother(address a, address b, uint256 spot) public {
        vm.assume(a != b && b != address(0) && b.code.length == 0);
        spot = bound(spot, 1, 12);
        Stamp.Voucher memory v = _voucher(a, spot, 1);
        bytes memory sig = _sign(signerKey, v);
        v.recipient = b;
        vm.expectRevert(Stamp.BadSignature.selector);
        stamp.mint(v, sig);
    }

    // ---------------------------------------------------------------------------------------------------- the registry

    function test_onlyTheOwnerRegistersSpots() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        stamp.registerSpot(99, "Nope", "NOPE", 0, 0);
    }

    function test_anyoneCanReadARegisteredSpot() public {
        vm.prank(owner);
        stamp.registerSpot(50, "Taj Mahal", "TAJMAHAL", 1_800_000_100, 1_800_009_000);
        (string memory name, string memory label, uint64 starts, uint64 ends, bool exists) = stamp.spots(50);
        assertEq(name, "Taj Mahal");
        assertEq(label, "TAJMAHAL");
        assertEq(starts, 1_800_000_100);
        assertEq(ends, 1_800_009_000);
        assertTrue(exists);
    }

    function test_cannotMintAnUnregisteredSpot() public {
        Stamp.Voucher memory v = _voucher(alice, 777, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.expectRevert(Stamp.UnknownSpot.selector);
        stamp.mint(v, sig);
    }

    function test_theWindowIsEnforcedOnChain() public {
        vm.prank(owner);
        stamp.registerSpot(60, "Aqua", "AQUA", 1_800_000_100, 1_800_000_200);
        assertFalse(stamp.isOpen(60)); // not started yet
        Stamp.Voucher memory v = _voucher(alice, 60, 1);
        bytes memory sig = _sign(signerKey, v);
        vm.expectRevert(Stamp.SpotNotOpen.selector);
        stamp.mint(v, sig);

        vm.warp(1_800_000_150);
        assertTrue(stamp.isOpen(60));
        stamp.mint(v, sig);
        assertEq(stamp.balanceOf(alice, 60), 1);

        vm.warp(1_800_000_200); // the end is exclusive
        assertFalse(stamp.isOpen(60));
        Stamp.Voucher memory w = _voucher(bob, 60, 2);
        bytes memory sig2 = _sign(signerKey, w);
        vm.expectRevert(Stamp.SpotNotOpen.selector);
        stamp.mint(w, sig2);
        assertEq(stamp.balanceOf(alice, 60), 1, "a stamp already minted stays");
    }

    function test_closingASpotStopsNewStampsOnly() public {
        _mint(alice, 3, 1);
        vm.prank(owner);
        stamp.closeSpot(3);
        Stamp.Voucher memory v = _voucher(bob, 3, 2);
        bytes memory sig = _sign(signerKey, v);
        vm.expectRevert(Stamp.SpotNotOpen.selector);
        stamp.mint(v, sig);
        assertEq(stamp.balanceOf(alice, 3), 1);
    }

    function test_aBadWindowIsRefusedAndABatchRegistersEverything() public {
        vm.startPrank(owner);
        vm.expectRevert(Stamp.BadWindow.selector);
        stamp.registerSpot(70, "Bad", "BAD", 200, 100);
        Stamp.SpotInput[] memory items = new Stamp.SpotInput[](3);
        for (uint256 i = 0; i < 3; i++) items[i] = Stamp.SpotInput(80 + i, "B", "B", 0, 0);
        stamp.registerSpots(items);
        vm.stopPrank();
        assertTrue(stamp.isOpen(80) && stamp.isOpen(81) && stamp.isOpen(82));
    }

}

/// The backend (Node, viem) signs vouchers; this proves the contract accepts exactly what it produces.
/// Regenerate the vector with: node backend/scripts/make-voucher-vector.mjs
contract StampBackendVectorTest is Test {
    function test_acceptsAVoucherSignedByTheNodeBackend() public {
        string memory json = vm.readFile("test/vectors/voucher.json");
        address signerAddr = vm.parseJsonAddress(json, ".signer");
        address contractAddr = vm.parseJsonAddress(json, ".contract");
        uint256 chainId = vm.parseJsonUint(json, ".chainId");

        vm.chainId(chainId);
        deployCodeTo("Stamp.sol:Stamp", abi.encode(signerAddr, address(this), "x"), contractAddr);
        Stamp stamp = Stamp(contractAddr);
        stamp.registerSpot(vm.parseJsonUint(json, ".spotId"), "Spot", "SPOT", 0, 0); // this contract's owner is the test itself

        Stamp.Voucher memory v = Stamp.Voucher({
            recipient: vm.parseJsonAddress(json, ".recipient"),
            spotId: vm.parseJsonUint(json, ".spotId"),
            nonce: vm.parseJsonUint(json, ".nonce"),
            deadline: vm.parseJsonUint(json, ".deadline")
        });
        stamp.mint(v, vm.parseJsonBytes(json, ".signature"));
        assertEq(stamp.balanceOf(v.recipient, v.spotId), 1);
    }
}
