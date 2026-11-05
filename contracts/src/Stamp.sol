// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title World3 Stamp
/// @notice A non-transferable ERC-1155 "I was there" stamp. Each spot is a token id. A stamp is minted only against an
///         EIP-712 voucher signed by the World3 backend, which has already checked the person's location and their World ID
///         proof. The contract trusts that signature and nothing else, so verification can change without redeploying.
/// @dev    Anyone may submit a voucher (the backend's relayer pays gas); the stamp always goes to the voucher's recipient.
///         Exact coordinates never appear here: a stamp is just (recipient, spot id).
contract Stamp is ERC1155, EIP712, Ownable {
    /// @notice What the backend signs. `nonce` is unique per voucher; `deadline` is a unix timestamp.
    struct Voucher {
        address recipient;
        uint256 spotId;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address recipient,uint256 spotId,uint256 nonce,uint256 deadline)");

    /// @notice The backend key whose signature authorises a mint. Rotatable by the owner.
    address public signer;

    /// @notice Vouchers already redeemed, by nonce.
    mapping(uint256 nonce => bool) public usedNonce;

    event Stamped(address indexed recipient, uint256 indexed spotId, uint256 nonce);
    event SignerChanged(address indexed previous, address indexed next);

    error ZeroAddress();
    error VoucherExpired();
    error NonceUsed();
    error BadSignature();
    error AlreadyStamped();
    error NonTransferable();

    constructor(address initialSigner, address initialOwner, string memory baseUri)
        ERC1155(baseUri)
        EIP712("World3 Stamp", "1")
        Ownable(initialOwner)
    {
        if (initialSigner == address(0)) revert ZeroAddress();
        signer = initialSigner;
        emit SignerChanged(address(0), initialSigner);
    }

    // ---------------------------------------------------------------------------------------------------- minting

    /// @notice Redeem a voucher: mint one stamp of `v.spotId` to `v.recipient`.
    function mint(Voucher calldata v, bytes calldata signature) external {
        if (block.timestamp > v.deadline) revert VoucherExpired();
        if (usedNonce[v.nonce]) revert NonceUsed();
        if (ECDSA.recover(voucherDigest(v), signature) != signer) revert BadSignature();
        if (balanceOf(v.recipient, v.spotId) != 0) revert AlreadyStamped(); // one stamp per person per spot

        usedNonce[v.nonce] = true;
        _mint(v.recipient, v.spotId, 1, "");
        emit Stamped(v.recipient, v.spotId, v.nonce);
    }

    /// @notice The EIP-712 digest the backend signs (exposed so clients and tests can check their encoding).
    function voucherDigest(Voucher calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(VOUCHER_TYPEHASH, v.recipient, v.spotId, v.nonce, v.deadline))
        );
    }

    // ---------------------------------------------------------------------------------------------------- admin

    function setSigner(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit SignerChanged(signer, next);
        signer = next;
    }

    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }

    // ------------------------------------------------------------------------------------- holder's own privacy

    /// @notice Holders may delete their own stamp (a public travel history is something a person should be able to remove).
    function burn(uint256 spotId) external {
        _burn(msg.sender, spotId, 1);
    }

    // ------------------------------------------------------------------------------------------ non-transferable

    /// @dev Stamps can be minted and burned, never moved. Every transfer path in ERC1155 goes through `_update`.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._update(from, to, ids, values);
    }

    /// @dev There is nothing to approve for a token that cannot move.
    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }
}
