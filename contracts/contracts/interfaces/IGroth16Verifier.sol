// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IGroth16Verifier
/// @notice Interface for the auto-generated Groth16 on-chain proof verifier.
///         The implementation (`Groth16Verifier.sol`) is exported from snarkjs:
///
///         snarkjs zkey export solidityverifier merkle_proof_final.zkey Groth16Verifier.sol
///
/// @dev    Public signals layout (indices into `_pubSignals`):
///         [0] merkle_root    — Merkle tree root the user proved against
///         [1] nullifier_hash — Poseidon(nullifier), unique ID for this spend
///         [2] recipient      — userOp.sender, binds proof to this specific UserOperation
interface IGroth16Verifier {
    /// @notice Verify a Groth16 proof on-chain.
    /// @param _pA          Proof element A  (G1 point, 2 uint256)
    /// @param _pB          Proof element B  (G2 point, 2×2 uint256)
    /// @param _pC          Proof element C  (G1 point, 2 uint256)
    /// @param _pubSignals  Public signals   ([merkleRoot, nullifierHash, recipient])
    /// @return bool        true if the proof is valid, false otherwise.
    function verifyProof(
        uint256[2]    calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2]    calldata _pC,
        uint256[3]    calldata _pubSignals
    ) external view returns (bool);
}
