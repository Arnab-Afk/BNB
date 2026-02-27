// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "./GhostSmartAccount.sol";

/// @title  GhostSmartAccountFactory
/// @notice Deploys GhostSmartAccount instances via CREATE2 so the address is
///         deterministic — we can compute it before deployment and include it
///         as `userOp.sender` even before the account exists on-chain.
///         The account gets deployed on its first UserOperation (via initCode).
contract GhostSmartAccountFactory {
    IEntryPoint public immutable entryPoint;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    /// @notice Deploy (or return existing) smart account for `owner` with `salt`.
    function createAccount(address owner, uint256 salt) external returns (GhostSmartAccount account) {
        address predicted = getAddress(owner, salt);
        if (predicted.code.length > 0) {
            return GhostSmartAccount(payable(predicted));
        }
        account = new GhostSmartAccount{salt: bytes32(salt)}(entryPoint, owner);
        emit AccountCreated(address(account), owner, salt);
    }

    /// @notice Pre-compute the smart account address for (owner, salt) without deploying.
    ///         Use this to get `userOp.sender` before the first UserOperation.
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(GhostSmartAccount).creationCode,
            abi.encode(address(entryPoint), owner)
        ));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            bytes32(salt),
            initCodeHash
        )))));
    }
}
