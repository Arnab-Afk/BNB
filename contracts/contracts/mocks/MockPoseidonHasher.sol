// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPoseidonHasher.sol";

/// @title  MockPoseidonHasher
/// @notice A keccak256-based drop-in replacement for PoseidonHasher.
///
/// @dev    ⚠️  FOR LOCAL TESTING AND DEVELOPMENT ONLY.
///             DO NOT deploy to testnet or mainnet.
///
///         This contract mimics the interface of PoseidonHasher using keccak256,
///         which lets us test GhostPool logic without needing the real Poseidon
///         assembly. The ZK proofs generated against this hasher will NOT be
///         valid — it is purely for unit testing the Merkle tree mechanics.
contract MockPoseidonHasher is IPoseidonHasher {
    /// @inheritdoc IPoseidonHasher
    function poseidon(bytes32 left, bytes32 right) external pure override returns (bytes32 hash) {
        hash = keccak256(abi.encode(left, right));
    }
}
