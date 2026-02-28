// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AssociationSetProvider
 * @notice Implements the 0xbow Association Set Provider (ASP) model for Ghost Privacy Suite.
 *
 * An ASP attests that a set of commitments (deposits) satisfy compliance requirements —
 * i.e., none of the depositing addresses appear on OFAC SDN or equivalent blocklists.
 *
 * Depositors in the "Clean Set" can generate a second ZK proof (Proof 2) alongside their
 * pool membership proof (Proof 1) to demonstrate compliance to GhostPaymaster.
 *
 * Flow:
 *   1. Ghost backend's OFAC sync job scans every deposit address
 *   2. Clean deposits are included in the ASP Merkle tree (Poseidon-hashed)
 *   3. The owner (Ghost Protocol multisig) calls updateRoot() to publish the new root
 *   4. Users prove their commitment is in the ASP tree using a standard Merkle proof
 *   5. GhostPaymaster verifies the ASP root via isKnownASPRoot() before executing the UserOp
 *
 * @dev Root history is maintained as a ring buffer (same pattern as GhostPool) so that
 *      users whose commitment was clean in a recent epoch can still prove membership
 *      even after subsequent root updates.
 */
contract AssociationSetProvider {
    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    address public pendingOwner;

    /// @notice Ring buffer of recent ASP Merkle roots (Poseidon tree of clean commitments)
    uint256 public constant ROOT_HISTORY_SIZE = 100;
    bytes32[ROOT_HISTORY_SIZE] public roots;
    uint32 public currentRootIndex;

    /// @notice Total number of root updates published
    uint256 public totalUpdates;

    /// @notice Metadata URI for the current clean set (IPFS or HTTPS)
    string public metadataUri;

    // ── Events ────────────────────────────────────────────────────────────────

    event RootUpdated(
        bytes32 indexed newRoot,
        bytes32 indexed previousRoot,
        uint256 cleanSetSize,
        string metadataUri,
        uint256 timestamp
    );
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Errors ────────────────────────────────────────────────────────────────

    error NotOwner();
    error NotPendingOwner();
    error ZeroRoot();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) {
        owner = _owner;
    }

    // ── Root management ───────────────────────────────────────────────────────

    /**
     * @notice Publish a new ASP Merkle root.
     * @param newRoot       Poseidon Merkle root of the clean commitment set
     * @param cleanSetSize  Number of commitments included in this root
     * @param _metadataUri  IPFS or HTTPS URL with the full commitment list (for auditors)
     */
    function updateRoot(
        bytes32 newRoot,
        uint256 cleanSetSize,
        string calldata _metadataUri
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (newRoot == bytes32(0)) revert ZeroRoot();

        bytes32 previousRoot = roots[currentRootIndex];

        currentRootIndex = uint32((currentRootIndex + 1) % ROOT_HISTORY_SIZE);
        roots[currentRootIndex] = newRoot;
        metadataUri = _metadataUri;
        totalUpdates++;

        emit RootUpdated(newRoot, previousRoot, cleanSetSize, _metadataUri, block.timestamp);
    }

    // ── Root verification ──────────────────────────────────────────────────────

    /**
     * @notice Check whether a root is in the recent root history.
     * @dev Called by GhostPaymaster to verify the ASP root in paymasterAndData.
     * @param root  The Poseidon Merkle root to check
     * @return bool True if the root was published within the last ROOT_HISTORY_SIZE updates
     */
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint32 i = currentRootIndex;
        for (uint32 j = 0; j < ROOT_HISTORY_SIZE; j++) {
            if (roots[i] == root) return true;
            if (i == 0) {
                i = uint32(ROOT_HISTORY_SIZE) - 1;
            } else {
                i--;
            }
        }
        return false;
    }

    /**
     * @notice Get the most recently published root.
     */
    function getLatestRoot() external view returns (bytes32) {
        return roots[currentRootIndex];
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotOwner();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
