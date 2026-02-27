// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPoseidonHasher
/// @notice Interface for an external Poseidon T3 hasher contract.
///         Poseidon is a ZK-friendly hash function used in the Merkle tree.
///         The implementation is deployed separately because the assembly
///         is too large to inline efficiently.
interface IPoseidonHasher {
    /// @notice Compute Poseidon(left, right) — the standard 2-input Poseidon permutation
    ///         over the BN254 scalar field.
    /// @param left     Left 32-byte field element (a Merkle tree node).
    /// @param right    Right 32-byte field element (a Merkle tree node).
    /// @return hash    The resulting 32-byte field element.
    function poseidon(bytes32 left, bytes32 right) external view returns (bytes32 hash);
}
