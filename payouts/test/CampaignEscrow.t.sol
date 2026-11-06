// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Stamp} from "stamp/Stamp.sol"; // the real, unchanged contract that is deployed
import {CampaignEscrow} from "../src/CampaignEscrow.sol";

/// @dev A holder that tries to re-enter `withdraw` when it is paid.
contract Reenterer {
    CampaignEscrow public escrow;
    uint256 public spotId;
    uint256 public hits;

    constructor(CampaignEscrow e, uint256 s) {
        escrow = e;
        spotId = s;
    }


    // a contract can only hold a stamp if it says it accepts ERC-1155
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    receive() external payable {
        hits++;
        if (hits < 3) {
            try escrow.withdraw(spotId, address(this)) {} catch {}
        }
    }
}

/// @dev A holder whose wallet refuses money.
contract Refuser {
    // a contract can only hold a stamp if it says it accepts ERC-1155
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    receive() external payable {
        revert("no");
    }
}

contract CampaignEscrowTest is Test {
    Stamp stamp;
    CampaignEscrow escrow;
    uint256 signerKey = 0xA11CE;
    address owner = address(0xB055);
    address sponsor1 = address(0x5001);
    address sponsor2 = address(0x5002);
    address treasury = address(0x7EA5);
    uint256 constant SPOT = 83;
    uint64 constant END = 10_000;
    uint64 constant WINDOW = 3 days;
    uint64 constant SWEEP = 90 days;
    uint256 nonce;
    uint256 walletCount;

    function setUp() public {
        vm.warp(1000);
        stamp = new Stamp(vm.addr(signerKey), owner, "");
        escrow = new CampaignEscrow(address(stamp), owner, 1000, WINDOW, SWEEP);
        vm.prank(owner);
        stamp.registerSpot(SPOT, "World", "WORLD", 0, END);
        vm.deal(sponsor1, 100 ether);
        vm.deal(sponsor2, 100 ether);
    }

    // a stamp minted the way the backend does it: a signed voucher, redeemed by anyone
    function _mintTo(address to, uint256 spotId) internal {
        Stamp.Voucher memory v = Stamp.Voucher({recipient: to, spotId: spotId, nonce: ++nonce, deadline: block.timestamp + 1 days});
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(signerKey, stamp.voucherDigest(v));
        stamp.mint(v, abi.encodePacked(r, s, vv));
    }

    function _holders(uint256 n) internal returns (address[] memory hs) {
        hs = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            hs[i] = address(uint160(0x10000 + ++walletCount)); // an ordinary wallet, like a traveler's
            _mintTo(hs[i], SPOT);
        }
    }

    function _endAndRegister(address[] memory hs) internal {
        vm.warp(END);
        for (uint256 i = 0; i < hs.length; i++) escrow.register(SPOT, hs[i]);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
    }

    // ------------------------------------------------------------------------------------------ the happy path

    function test_tenPercentToProtocolRestSplitEqually() public {
        address[] memory hs = _holders(3);
        vm.prank(sponsor1);
        escrow.fund{value: 6 ether}(SPOT);
        vm.prank(sponsor2);
        escrow.fund{value: 4 ether}(SPOT);
        _endAndRegister(hs);

        (, uint256 share,,,,,,) = escrow.pools(SPOT);
        assertEq(share, 3 ether); // 10 ether, 10% = 1 to the protocol, 9 / 3 = 3 each
        assertEq(escrow.protocolBalance(), 1 ether);
        for (uint256 i = 0; i < 3; i++) {
            escrow.withdraw(SPOT, hs[i]);
            assertEq(hs[i].balance, 3 ether);
        }
        vm.prank(owner);
        escrow.withdrawProtocol(payable(treasury));
        assertEq(treasury.balance, 1 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_dustStaysWithProtocol() public {
        address[] memory hs = _holders(7);
        vm.prank(sponsor1);
        escrow.fund{value: 1000 wei}(SPOT); // fee 100, 900 / 7 = 128 each = 896, dust 4
        _endAndRegister(hs);
        (, uint256 share,,,,,,) = escrow.pools(SPOT);
        assertEq(share, 128);
        assertEq(escrow.protocolBalance(), 104);
        uint256 out;
        for (uint256 i = 0; i < 7; i++) {
            escrow.withdraw(SPOT, hs[i]);
            out += hs[i].balance;
        }
        assertEq(out + escrow.protocolBalance(), 1000);
    }

    // ------------------------------------------------------------------------------------------ funding rules

    function test_cannotFundAnUnknownSpot() public {
        vm.prank(sponsor1);
        vm.expectRevert(CampaignEscrow.UnknownSpot.selector);
        escrow.fund{value: 1 ether}(999);
    }

    function test_cannotFundWithNothing() public {
        vm.prank(sponsor1);
        vm.expectRevert(CampaignEscrow.NoValue.selector);
        escrow.fund(SPOT);
    }

    function test_cannotFundAfterTheEventEnds() public {
        vm.warp(END);
        vm.prank(sponsor1);
        vm.expectRevert(CampaignEscrow.AlreadyEnded.selector);
        escrow.fund{value: 1 ether}(SPOT);
    }

    function test_aSpotThatNeverEndsCanBeFundedButNotPaid() public {
        vm.prank(owner);
        stamp.registerSpot(5, "Open", "OPEN", 0, 0);
        vm.prank(sponsor1);
        escrow.fund{value: 1 ether}(5);
        vm.warp(block.timestamp + 1000 days);
        assertFalse(escrow.hasEnded(5));
        vm.expectRevert(CampaignEscrow.NotEnded.selector);
        escrow.finalize(5);
        // closing the spot is what ends it
        vm.prank(owner);
        stamp.closeSpot(5);
        assertTrue(escrow.hasEnded(5));
    }

    // ------------------------------------------------------------------------------------------ registering holders

    function test_registerNeedsAStamp() public {
        vm.warp(END);
        vm.expectRevert(CampaignEscrow.NoStamp.selector);
        escrow.register(SPOT, address(0xBEEF));
    }

    function test_registerOnlyOnceAndOnlyAfterTheEnd() public {
        address[] memory hs = _holders(1);
        vm.expectRevert(CampaignEscrow.NotEnded.selector);
        escrow.register(SPOT, hs[0]);
        vm.warp(END);
        escrow.register(SPOT, hs[0]);
        vm.expectRevert(CampaignEscrow.AlreadyRegistered.selector);
        escrow.register(SPOT, hs[0]);
    }

    function test_registerClosesWithTheWindow() public {
        address[] memory hs = _holders(1);
        vm.warp(END + WINDOW);
        vm.expectRevert(CampaignEscrow.WindowClosed.selector);
        escrow.register(SPOT, hs[0]);
    }

    function test_aStampFromAnotherSpotDoesNotCount() public {
        vm.prank(owner);
        stamp.registerSpot(84, "Other", "OTHER", 0, END);
        address who = address(uint160(0x20000 + ++walletCount));
        _mintTo(who, 84);
        vm.warp(END);
        vm.expectRevert(CampaignEscrow.NoStamp.selector);
        escrow.register(SPOT, who);
    }

    function test_aBurnedStampCannotBeRegistered() public {
        address[] memory hs = _holders(1);
        vm.prank(hs[0]);
        stamp.burn(SPOT);
        vm.warp(END);
        vm.expectRevert(CampaignEscrow.NoStamp.selector);
        escrow.register(SPOT, hs[0]);
    }

    function test_aHolderWhoWasNeverRegisteredGetsNothing() public {
        address[] memory hs = _holders(2);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        vm.warp(END);
        escrow.register(SPOT, hs[0]); // hs[1] is missed
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        vm.expectRevert(CampaignEscrow.NotRegistered.selector);
        escrow.withdraw(SPOT, hs[1]);
        escrow.withdraw(SPOT, hs[0]);
        assertEq(hs[0].balance, 9 ether); // the one registered holder takes all 90%
    }

    function test_aStrangerCanRegisterAHolderButPaymentGoesToTheHolder() public {
        address[] memory hs = _holders(1);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        vm.warp(END);
        vm.prank(address(0xCAFE));
        escrow.register(SPOT, hs[0]);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        vm.prank(address(0xCAFE));
        escrow.withdraw(SPOT, hs[0]);
        assertEq(hs[0].balance, 9 ether);
        assertEq(address(0xCAFE).balance, 0);
    }

    // ------------------------------------------------------------------------------------------ finalising and paying

    function test_cannotFinalizeBeforeTheWindowCloses() public {
        vm.prank(sponsor1);
        escrow.fund{value: 1 ether}(SPOT);
        vm.warp(END + WINDOW - 1);
        vm.expectRevert(CampaignEscrow.WindowOpen.selector);
        escrow.finalize(SPOT);
    }

    function test_cannotFinalizeTwiceOrWithoutFunds() public {
        vm.warp(END + WINDOW);
        vm.expectRevert(CampaignEscrow.NothingFunded.selector);
        escrow.finalize(SPOT);
        vm.warp(END - 1);
        vm.prank(sponsor1);
        escrow.fund{value: 1 ether}(SPOT);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        vm.expectRevert(CampaignEscrow.AlreadyFinalized.selector);
        escrow.finalize(SPOT);
    }

    function test_cannotWithdrawTwice() public {
        address[] memory hs = _holders(2);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        _endAndRegister(hs);
        escrow.withdraw(SPOT, hs[0]);
        vm.expectRevert(CampaignEscrow.AlreadyPaid.selector);
        escrow.withdraw(SPOT, hs[0]);
    }

    function test_cannotWithdrawBeforeFinalizing() public {
        address[] memory hs = _holders(1);
        vm.warp(END);
        escrow.register(SPOT, hs[0]);
        vm.expectRevert(CampaignEscrow.NotFinalized.selector);
        escrow.withdraw(SPOT, hs[0]);
    }

    // ------------------------------------------------------------------------------------------ nobody held a stamp

    function test_sponsorsGetEverythingBackWhenNobodyWasThere() public {
        vm.prank(sponsor1);
        escrow.fund{value: 6 ether}(SPOT);
        vm.prank(sponsor2);
        escrow.fund{value: 4 ether}(SPOT);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        assertEq(escrow.protocolBalance(), 0); // no fee when there was nobody to pay
        uint256 b1 = sponsor1.balance;
        vm.prank(sponsor1);
        escrow.refund(SPOT);
        assertEq(sponsor1.balance, b1 + 6 ether);
        vm.prank(sponsor2);
        escrow.refund(SPOT);
        vm.prank(sponsor2);
        vm.expectRevert(CampaignEscrow.NothingToRefund.selector);
        escrow.refund(SPOT);
        assertEq(address(escrow).balance, 0);
    }

    function test_noRefundWhenThereWerePayouts() public {
        address[] memory hs = _holders(1);
        vm.prank(sponsor1);
        escrow.fund{value: 1 ether}(SPOT);
        _endAndRegister(hs);
        vm.prank(sponsor1);
        vm.expectRevert(CampaignEscrow.NotRefunding.selector);
        escrow.refund(SPOT);
    }

    function test_noWithdrawWhenRefunding() public {
        vm.prank(sponsor1);
        escrow.fund{value: 1 ether}(SPOT);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        vm.expectRevert(CampaignEscrow.Refunding.selector);
        escrow.withdraw(SPOT, address(this));
    }

    // ------------------------------------------------------------------------------------------ hostile holders

    function test_aHolderCannotReenterToBePaidTwice() public {
        Reenterer evil = new Reenterer(escrow, SPOT);
        _mintTo(address(evil), SPOT);
        address[] memory others = _holders(1);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        vm.warp(END);
        escrow.register(SPOT, address(evil));
        escrow.register(SPOT, others[0]);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        escrow.withdraw(SPOT, address(evil));
        assertEq(address(evil).balance, 4.5 ether); // exactly one share
        escrow.withdraw(SPOT, others[0]);
        assertEq(others[0].balance, 4.5 ether);
    }

    function test_aHolderWhoRefusesMoneyBlocksNobodyElse() public {
        Refuser bad = new Refuser();
        _mintTo(address(bad), SPOT);
        address[] memory others = _holders(2);
        vm.prank(sponsor1);
        escrow.fund{value: 30 ether}(SPOT);
        vm.warp(END);
        escrow.register(SPOT, address(bad));
        escrow.register(SPOT, others[0]);
        escrow.register(SPOT, others[1]);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        vm.expectRevert(CampaignEscrow.TransferFailed.selector);
        escrow.withdraw(SPOT, address(bad));
        escrow.withdraw(SPOT, others[0]);
        escrow.withdraw(SPOT, others[1]);
        assertEq(others[0].balance, 9 ether);
        // the refused share is swept to the protocol later, so it is not stuck
        vm.warp(block.timestamp + SWEEP);
        escrow.sweep(SPOT);
        assertEq(escrow.protocolBalance(), 3 ether + 9 ether);
    }

    // ------------------------------------------------------------------------------------------ sweeping and the protocol

    function test_sweepOnlyAfterTheDelayAndOnce() public {
        address[] memory hs = _holders(2);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        _endAndRegister(hs);
        escrow.withdraw(SPOT, hs[0]);
        vm.expectRevert(CampaignEscrow.SweepTooEarly.selector);
        escrow.sweep(SPOT);
        vm.warp(block.timestamp + SWEEP);
        escrow.sweep(SPOT);
        assertEq(escrow.protocolBalance(), 1 ether + 4.5 ether);
        vm.expectRevert(CampaignEscrow.AlreadySwept.selector);
        escrow.sweep(SPOT);
        vm.expectRevert(CampaignEscrow.AlreadySwept.selector);
        escrow.withdraw(SPOT, hs[1]);
    }

    function test_onlyTheOwnerTakesTheProtocolShare() public {
        address[] memory hs = _holders(1);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        _endAndRegister(hs);
        vm.prank(sponsor1);
        vm.expectRevert();
        escrow.withdrawProtocol(payable(sponsor1));
    }

    function test_feeCannotExceedTheCap() public {
        vm.expectRevert(CampaignEscrow.FeeTooHigh.selector);
        new CampaignEscrow(address(stamp), owner, 2001, WINDOW, SWEEP);
    }

    function test_twoSpotsKeepTheirMoneySeparate() public {
        vm.prank(owner);
        stamp.registerSpot(84, "Other", "OTHER", 0, END);
        address a = address(uint160(0x20000 + ++walletCount));
        address b = address(uint160(0x20000 + ++walletCount));
        _mintTo(a, SPOT);
        _mintTo(b, 84);
        vm.prank(sponsor1);
        escrow.fund{value: 10 ether}(SPOT);
        vm.prank(sponsor2);
        escrow.fund{value: 20 ether}(84);
        vm.warp(END);
        escrow.register(SPOT, a);
        escrow.register(84, b);
        vm.warp(END + WINDOW);
        escrow.finalize(SPOT);
        escrow.finalize(84);
        escrow.withdraw(SPOT, a);
        escrow.withdraw(84, b);
        assertEq(a.balance, 9 ether);
        assertEq(b.balance, 18 ether);
    }

    // ------------------------------------------------------------------------------------------ properties

    /// @dev Whatever the number of holders and the amount, every wei is accounted for: holders plus protocol equal the pool, and
    ///      the contract ends empty once everyone is paid and the protocol has withdrawn.
    function testFuzz_everyWeiIsAccountedFor(uint8 holderCount, uint96 amount) public {
        uint256 n = bound(holderCount, 1, 40);
        uint256 total = bound(amount, 1, 50 ether);
        address[] memory hs = _holders(n);
        vm.deal(sponsor1, total);
        vm.prank(sponsor1);
        escrow.fund{value: total}(SPOT);
        _endAndRegister(hs);
        uint256 paidOut;
        for (uint256 i = 0; i < n; i++) {
            escrow.withdraw(SPOT, hs[i]);
            paidOut += hs[i].balance;
        }
        assertEq(paidOut + escrow.protocolBalance(), total);
        assertLe(escrow.protocolBalance(), (total * 1000) / 10_000 + n); // fee plus less than one wei per holder of dust
        vm.prank(owner);
        escrow.withdrawProtocol(payable(treasury));
        assertEq(address(escrow).balance, 0);
        // nobody is paid more than anybody else
        for (uint256 i = 1; i < n; i++) assertEq(hs[i].balance, hs[0].balance);
    }
}
