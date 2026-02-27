// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title  GhostSmartAccount
/// @notice Minimal ERC-4337 smart account used to demonstrate the Ghost Paymaster flow.
///         A fresh EOA (0 BNB) becomes the "owner" of this smart account.
///         The smart account has no BNB itself — yet it can transact because
///         GhostPaymaster sponsors the gas, deducting the fee from GhostPool.
///
/// @dev    In a production wallet you would use a more feature-rich account
///         (e.g., Safe, Kernel, Biconomy). This is a minimal demo account.
contract GhostSmartAccount is IAccount {
    using ECDSA for bytes32;

    IEntryPoint public immutable entryPoint;
    address      public immutable owner;

    constructor(IEntryPoint _entryPoint, address _owner) {
        entryPoint = _entryPoint;
        owner      = _owner;
    }

    // ── IAccount ─────────────────────────────────────────────────────────────

    /// @notice Validate that the UserOperation was signed by the owner.
    ///         Called by EntryPoint as part of tx validation.
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32                       userOpHash,
        uint256                       missingAccountFunds
    ) external override returns (uint256 validationData) {
        require(msg.sender == address(entryPoint), "GSA: not entrypoint");

        // EIP-191 personal_sign hash
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address signer  = ECDSA.recover(ethHash, userOp.signature);

        // 0 = success, 1 = failure
        if (signer != owner) return 1;

        // Top up EntryPoint prefund if needed (should be 0 since Paymaster covers it)
        if (missingAccountFunds > 0) {
            (bool ok,) = payable(address(entryPoint)).call{value: missingAccountFunds}("");
            ok; // ignore — Paymaster should cover everything
        }

        return 0;
    }

    // ── Execution ─────────────────────────────────────────────────────────────

    /// @notice Execute a call to any address. Called by EntryPoint after validation.
    function execute(
        address target,
        uint256 value,
        bytes   calldata data
    ) external {
        require(
            msg.sender == address(entryPoint) || msg.sender == owner,
            "GSA: not authorized"
        );
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    receive() external payable {}
}
