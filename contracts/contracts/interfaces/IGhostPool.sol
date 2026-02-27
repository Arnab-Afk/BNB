// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGhostPool
/// @notice Interface for the Ghost Privacy Pool.
///         Consumed by GhostPaymaster to verify Merkle roots and deduct relay fees.
interface IGhostPool {
    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted when a user deposits tokens and inserts a commitment.
    event Deposit(
        bytes32 indexed commitment,
        uint32 indexed leafIndex,
        uint256 amount,
        address indexed token,
        uint256 timestamp
    );

    /// @notice Emitted when the Paymaster deducts a relay fee from the pool.
    event FeeDeducted(bytes32 indexed nullifierHash, uint256 amount, address token);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error CommitmentAlreadyInserted();
    error TokenNotAllowed(address token);
    error AmountTooSmall(uint256 provided, uint256 minimum);
    error UnknownMerkleRoot(bytes32 root);
    error CallerNotPaymaster(address caller);
    error InsufficientPoolBalance(uint256 required, uint256 available);
    error TransferFailed();

    // ─── State Queries ────────────────────────────────────────────────────────

    /// @notice Returns the most recently computed Merkle root.
    function getLastRoot() external view returns (bytes32);

    /// @notice Returns true if `root` was ever a valid root of this pool's Merkle tree.
    /// @dev    Checks the rolling `ROOT_HISTORY_SIZE` history — not just the latest root.
    ///         This prevents race conditions where a proof is generated just before a new deposit.
    function isKnownRoot(bytes32 root) external view returns (bool);

    /// @notice Returns true if `commitment` has already been deposited.
    function isCommitmentInserted(bytes32 commitment) external view returns (bool);

    /// @notice Returns the number of leaves inserted so far.
    function nextLeafIndex() external view returns (uint32);

    /// @notice Returns the pool's spendable balance for a given token (in token decimals).
    function poolBalance(address token) external view returns (uint256);

    // ─── Actions ──────────────────────────────────────────────────────────────

    /// @notice Deposit `amount` of `token` into the pool.
    /// @dev    `commitment` must be Poseidon(secret, nullifier), computed client-side.
    ///         The contract stores the commitment as a leaf in the Merkle tree.
    ///         Emits `Deposit`.
    /// @param commitment   Poseidon hash of (secret, nullifier) — 32-byte field element.
    /// @param amount       Token amount in the token's native decimals.
    /// @param token        Address of an allowed ERC-20 token (USDC or USDT).
    function deposit(bytes32 commitment, uint256 amount, address token) external;

    /// @notice Deduct `amount` of `token` from the pool's balance to reimburse the Paymaster.
    /// @dev    Restricted to the registered GhostPaymaster address via `onlyPaymaster`.
    ///         Called inside `GhostPaymaster.postOp()` after a successful relay.
    /// @param nullifierHash    The nullifier hash that was spent (for event logging).
    /// @param amount           Amount to deduct (in token decimals).
    /// @param token            Token to deduct from.
    function deductFee(bytes32 nullifierHash, uint256 amount, address token) external;
}
