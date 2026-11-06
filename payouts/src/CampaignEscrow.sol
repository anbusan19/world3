// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice The two things the escrow needs from the (already deployed, unchanged) Stamp contract.
interface IStamp {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function spots(uint256 spotId)
        external
        view
        returns (string memory name, string memory label, uint64 startsAt, uint64 endsAt, bool exists);
}

/// @title wrld3 CampaignEscrow
/// @notice Sponsors fund a spot. When the spot's event ends, the pool is split: `feeBps` (10%) to the protocol and the rest
///         equally between the people who hold that spot's stamp.
///
/// @dev    The Stamp contract has no total supply, so the escrow counts the holders itself. After the spot ends there is a
///         claim window in which anyone may register a holder (the call needs a real stamp in that wallet, and each wallet counts
///         once). The backend's relayer registers everybody, so travelers pay no gas, and a person can always register themselves.
///         After the window, the pool is split by the number registered and each holder is paid with `withdraw`, which anyone may
///         call for them (the money always goes to the holder). Nothing here can mint or move a stamp.
///
///         Timing comes from the Stamp contract's own spot window (`endsAt`), which only the organizer can change.
///         Testnet ETH only for now. Not audited.
contract CampaignEscrow is Ownable, ReentrancyGuard {
    IStamp public immutable stamp;
    /// @notice Protocol share in basis points (1000 = 10%).
    uint16 public immutable feeBps;
    /// @notice Seconds after a spot ends during which holders can be registered.
    uint64 public immutable claimWindow;
    /// @notice Seconds after finalising before shares nobody withdrew can be swept to the protocol.
    uint64 public immutable sweepDelay;

    uint16 public constant MAX_FEE_BPS = 2000; // the organizer can never take more than 20%

    struct Pool {
        uint256 total; // everything sponsors put in
        uint256 share; // what each registered holder gets (set when finalised)
        uint32 registered; // holders counted
        uint32 paid; // holders already paid
        uint64 finalizedAt;
        bool finalized;
        bool refunding; // nobody held a stamp: sponsors take their money back
        bool swept;
    }

    mapping(uint256 spotId => Pool) public pools;
    mapping(uint256 spotId => mapping(address sponsor => uint256)) public funded;
    mapping(uint256 spotId => mapping(address holder => bool)) public isRegistered;
    mapping(uint256 spotId => mapping(address holder => bool)) public isPaid;

    /// @notice The protocol's accumulated share (fees plus rounding dust plus swept shares), withdrawable by the owner.
    uint256 public protocolBalance;

    event Funded(uint256 indexed spotId, address indexed sponsor, uint256 amount, uint256 poolTotal);
    event HolderRegistered(uint256 indexed spotId, address indexed holder, uint32 count);
    event Finalized(uint256 indexed spotId, uint256 total, uint256 protocolCut, uint256 share, uint32 holders, bool refunding);
    event Paid(uint256 indexed spotId, address indexed holder, uint256 amount);
    event Refunded(uint256 indexed spotId, address indexed sponsor, uint256 amount);
    event Swept(uint256 indexed spotId, uint256 amount);
    event ProtocolWithdrawn(address indexed to, uint256 amount);

    error UnknownSpot();
    error NoValue();
    error AlreadyEnded();
    error NotEnded();
    error WindowClosed();
    error WindowOpen();
    error NoStamp();
    error AlreadyRegistered();
    error AlreadyFinalized();
    error NotFinalized();
    error NothingFunded();
    error NotRegistered();
    error AlreadyPaid();
    error Refunding();
    error NotRefunding();
    error NothingToRefund();
    error SweepTooEarly();
    error AlreadySwept();
    error TransferFailed();
    error ZeroAddress();
    error FeeTooHigh();

    constructor(address stampAddress, address initialOwner, uint16 feeBasisPoints, uint64 claimWindowSeconds, uint64 sweepDelaySeconds)
        Ownable(initialOwner)
    {
        if (stampAddress == address(0)) revert ZeroAddress();
        if (feeBasisPoints > MAX_FEE_BPS) revert FeeTooHigh();
        stamp = IStamp(stampAddress);
        feeBps = feeBasisPoints;
        claimWindow = claimWindowSeconds;
        sweepDelay = sweepDelaySeconds;
    }

    // ------------------------------------------------------------------------------------------------ views

    /// @notice When the spot's window closes (0 if it has no end yet), and whether the spot exists.
    function spotEnd(uint256 spotId) public view returns (bool exists, uint64 endsAt) {
        (,,, uint64 e, bool ex) = stamp.spots(spotId);
        return (ex, e);
    }

    /// @notice Has the spot's event ended (so funding is closed and the claim window has started)?
    function hasEnded(uint256 spotId) public view returns (bool) {
        (bool ex, uint64 e) = spotEnd(spotId);
        return ex && e != 0 && block.timestamp >= e;
    }

    /// @notice When the claim window closes and the pool can be finalised (0 if the spot has no end yet).
    function claimDeadline(uint256 spotId) public view returns (uint64) {
        (, uint64 e) = spotEnd(spotId);
        return e == 0 ? 0 : e + claimWindow;
    }

    // ---------------------------------------------------------------------------------------------- sponsors

    /// @notice Add to the pool for a spot. Open until the spot's event ends.
    function fund(uint256 spotId) external payable {
        if (msg.value == 0) revert NoValue();
        (bool ex,) = spotEnd(spotId);
        if (!ex) revert UnknownSpot();
        if (hasEnded(spotId)) revert AlreadyEnded();
        Pool storage p = pools[spotId];
        p.total += msg.value;
        funded[spotId][msg.sender] += msg.value;
        emit Funded(spotId, msg.sender, msg.value, p.total);
    }

    // -------------------------------------------------------------------------------------------- after the event

    /// @notice Count a holder. Anyone may call this for any wallet that holds the stamp, once the event has ended and until the
    ///         claim window closes. The backend's relayer does it for everyone.
    function register(uint256 spotId, address holder) external {
        if (!hasEnded(spotId)) revert NotEnded();
        if (block.timestamp >= claimDeadline(spotId)) revert WindowClosed();
        if (isRegistered[spotId][holder]) revert AlreadyRegistered();
        if (stamp.balanceOf(holder, spotId) == 0) revert NoStamp();
        isRegistered[spotId][holder] = true;
        uint32 n = ++pools[spotId].registered;
        emit HolderRegistered(spotId, holder, n);
    }

    /// @notice Close the claim window and fix each holder's share. Anyone may call it once the window has closed.
    function finalize(uint256 spotId) external {
        if (!hasEnded(spotId)) revert NotEnded();
        if (block.timestamp < claimDeadline(spotId)) revert WindowOpen();
        Pool storage p = pools[spotId];
        if (p.finalized) revert AlreadyFinalized();
        if (p.total == 0) revert NothingFunded();
        p.finalized = true;
        p.finalizedAt = uint64(block.timestamp);

        if (p.registered == 0) {
            p.refunding = true; // nobody was there: sponsors get everything back, no fee
            emit Finalized(spotId, p.total, 0, 0, 0, true);
            return;
        }
        uint256 fee = (p.total * feeBps) / 10_000;
        uint256 forHolders = p.total - fee;
        uint256 share = forHolders / p.registered;
        uint256 dust = forHolders - share * p.registered; // rounding stays with the protocol
        p.share = share;
        protocolBalance += fee + dust;
        emit Finalized(spotId, p.total, fee + dust, share, p.registered, false);
    }

    /// @notice Pay a registered holder their share. Anyone may call it (the money always goes to the holder).
    function withdraw(uint256 spotId, address holder) external nonReentrant {
        Pool storage p = pools[spotId];
        if (!p.finalized) revert NotFinalized();
        if (p.refunding) revert Refunding();
        if (p.swept) revert AlreadySwept();
        if (!isRegistered[spotId][holder]) revert NotRegistered();
        if (isPaid[spotId][holder]) revert AlreadyPaid();
        isPaid[spotId][holder] = true;
        p.paid += 1;
        uint256 amount = p.share;
        (bool ok,) = holder.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Paid(spotId, holder, amount);
    }

    /// @notice When nobody held a stamp, a sponsor takes back what they put in.
    function refund(uint256 spotId) external nonReentrant {
        Pool storage p = pools[spotId];
        if (!p.finalized) revert NotFinalized();
        if (!p.refunding) revert NotRefunding();
        uint256 amount = funded[spotId][msg.sender];
        if (amount == 0) revert NothingToRefund();
        funded[spotId][msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(spotId, msg.sender, amount);
    }

    /// @notice After `sweepDelay`, shares nobody withdrew go to the protocol, so no money is stuck for ever.
    function sweep(uint256 spotId) external {
        Pool storage p = pools[spotId];
        if (!p.finalized) revert NotFinalized();
        if (p.refunding) revert Refunding();
        if (p.swept) revert AlreadySwept();
        if (block.timestamp < p.finalizedAt + sweepDelay) revert SweepTooEarly();
        p.swept = true;
        uint256 left = uint256(p.registered - p.paid) * p.share;
        protocolBalance += left;
        emit Swept(spotId, left);
    }

    // -------------------------------------------------------------------------------------------- the protocol

    function withdrawProtocol(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = protocolBalance;
        protocolBalance = 0;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ProtocolWithdrawn(to, amount);
    }
}
