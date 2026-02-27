// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGroth16Verifier.sol";

/// @title  MockGroth16Verifier
/// @notice Always returns `true` — used for local testing before the real
///         ZK circuit and trusted setup are complete.
///
/// @dev    ⚠️  FOR LOCAL TESTING ONLY. DO NOT deploy to testnet or mainnet.
///             Replace with the real snarkjs-generated Groth16Verifier.sol
///             once `merkle_proof_final.zkey` is available.
contract MockGroth16Verifier is IGroth16Verifier {
    /// @inheritdoc IGroth16Verifier
    function verifyProof(
        uint256[2]    calldata,
        uint256[2][2] calldata,
        uint256[2]    calldata,
        uint256[3]    calldata
    ) external pure override returns (bool) {
        return true;
    }
}
