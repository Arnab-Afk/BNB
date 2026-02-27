// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IGhostPool.sol";
import "./interfaces/IPoseidonHasher.sol";

/// @title  GhostPool
/// @author Ghost Privacy Suite
/// @notice Privacy Pool that accepts stablecoin deposits and maintains a
///         Poseidon Merkle tree of cryptographic commitments.
///
/// @dev    Architecture overview:
///
///         1. DEPOSIT
///            User computes:  commitment = Poseidon(secret, nullifier)   (client-side, never on-chain)
///            User calls:     deposit(commitment, amount, token)
///            Contract:       inserts commitment as a leaf in the Merkle tree
///                            → Merkle root is updated
///                            → Historical roots are stored (ROOT_HISTORY_SIZE)
///
///         2. SPEND (via Ghost Paymaster)
///            User generates: ZK proof that commitment ∈ tree AND nullifier is unspent
///            Proof is:       carried in UserOperation.paymasterAndData
///            GhostPaymaster: verifies proof on-chain via Groth16Verifier
///                            → checks isKnownRoot(proof.merkleRoot)
///                            → checks nullifier not spent
///                            → pays BNB gas
///            After execution: GhostPaymaster calls deductFee() to reimburse itself
///
///         Privacy guarantee:
///         The deposit transaction links a wallet to a commitment.
///         The spend (gas relay) only reveals the nullifier hash — NOT the commitment.
///         Since many commitments exist in the tree, the specific depositor is hidden
///         within the anonymity set of size = current leaf count.
///
///         Inspired by Tornado Cash (MIT) and 0xbow Privacy Pools.
contract GhostPool is IGhostPool, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice How many historical Merkle roots to remember.
    /// @dev    Prevents race conditions: a user who generates a ZK proof just before
    ///         a new deposit is made can still spend, as long as their root is in history.
    uint32 public constant ROOT_HISTORY_SIZE = 30;

    /// @notice Maximum depth of the Merkle tree.
    uint32 public constant MAX_TREE_HEIGHT = 32;

    /// @notice Minimum deposit amount (1 USDC = 1_000_000 with 6 decimals).
    uint256 public constant MIN_DEPOSIT = 1_000_000;

    // ─── Immutables ───────────────────────────────────────────────────────────

    /// @notice Poseidon T3 hasher contract (deployed separately).
    IPoseidonHasher public immutable hasher;

    /// @notice Height of the Merkle tree (configured at deployment).
    uint32 public immutable levels;

    // ─── Merkle Tree State ────────────────────────────────────────────────────

    /// @notice Incremental Merkle tree — stores the last filled subtree hash at each level.
    /// @dev    filledSubtrees[i] = the last-inserted node at tree level i.
    ///         This is the classic O(log n) incremental Merkle tree pattern
    ///         (same as Tornado Cash / Semaphore).
    mapping(uint256 => bytes32) public filledSubtrees;

    /// @notice Historical root ring buffer.
    bytes32[ROOT_HISTORY_SIZE] public roots;

    /// @notice The index of the most recent root in the ring buffer.
    uint32 public currentRootIndex;

    /// @notice The index of the next leaf to be inserted.
    uint32 public nextIndex;

    // ─── ZK State ────────────────────────────────────────────────────────────

    /// @notice Set of inserted commitments — prevents duplicate deposits.
    mapping(bytes32 => bool) public commitments;

    // ─── Pool State ───────────────────────────────────────────────────────────

    /// @notice Allowed stablecoins (USDC, USDT, BUSD etc.)
    mapping(address => bool) public allowedTokens;

    /// @notice Accumulated pool balance per token (used for fee deductions).
    mapping(address => uint256) private _poolBalance;

    /// @notice Address of the GhostPaymaster — the only caller allowed to deduct fees.
    address public ghostPaymaster;

    // ─── Zero Values ─────────────────────────────────────────────────────────

    /// @notice Pre-computed zero hashes for each tree level.
    /// @dev    zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
    ///         zeros[0] = keccak256("ghostpool") — the leaf-level zero value.
    ///         These are filled in the constructor up to `levels` depth.
    bytes32[MAX_TREE_HEIGHT] public zeros;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _hasher      Address of the deployed PoseidonHasher contract.
    /// @param _levels      Depth of the Merkle tree (e.g. 20 → 2^20 = ~1M leaves).
    /// @param _usdc        Address of USDC token on BNB Chain.
    /// @param _usdt        Address of USDT token on BNB Chain.
    /// @param _owner       Owner address (multisig recommended in production).
    constructor(
        IPoseidonHasher _hasher,
        uint32 _levels,
        address _usdc,
        address _usdt,
        address _owner
    ) Ownable(_owner) {
        require(_levels > 0 && _levels <= MAX_TREE_HEIGHT, "GhostPool: invalid tree height");
        require(address(_hasher) != address(0), "GhostPool: zero hasher address");
        require(_usdc != address(0) && _usdt != address(0), "GhostPool: zero token address");

        hasher = _hasher;
        levels = _levels;

        // Allow USDC and USDT
        allowedTokens[_usdc] = true;
        allowedTokens[_usdt] = true;

        // Pre-compute zero hashes for each level.
        // zeros[0] is the canonical "empty leaf" value.
        // zeros[i] = Poseidon(zeros[i-1], zeros[i-1])
        zeros[0] = keccak256(abi.encodePacked("ghostpool")) & bytes32(type(uint256).max >> 4);
        for (uint32 i = 1; i < _levels; ) {
            zeros[i] = _hasher.poseidon(zeros[i - 1], zeros[i - 1]);
            unchecked { ++i; }
        }

        // Initialise filled subtrees to the zero values.
        for (uint32 i = 0; i < _levels; ) {
            filledSubtrees[i] = zeros[i];
            unchecked { ++i; }
        }

        // Set the initial root (tree full of zeros).
        roots[0] = _initialRoot(_hasher, _levels, zeros);
    }

    // ─── IGhostPool: State Queries ────────────────────────────────────────────

    /// @inheritdoc IGhostPool
    function getLastRoot() external view override returns (bytes32) {
        return roots[currentRootIndex];
    }

    /// @inheritdoc IGhostPool
    function isKnownRoot(bytes32 root) public view override returns (bool) {
        if (root == bytes32(0)) return false;
        uint32 i = currentRootIndex;
        // Scan the ring buffer from newest → oldest
        for (uint32 j = 0; j < ROOT_HISTORY_SIZE; ) {
            if (roots[i] == root) return true;
            if (i == 0) {
                i = ROOT_HISTORY_SIZE - 1;
            } else {
                unchecked { --i; }
            }
            unchecked { ++j; }
        }
        return false;
    }

    /// @inheritdoc IGhostPool
    function isCommitmentInserted(bytes32 commitment) external view override returns (bool) {
        return commitments[commitment];
    }

    /// @inheritdoc IGhostPool
    function nextLeafIndex() external view override returns (uint32) {
        return nextIndex;
    }

    /// @inheritdoc IGhostPool
    function poolBalance(address token) external view override returns (uint256) {
        return _poolBalance[token];
    }

    // ─── IGhostPool: Actions ──────────────────────────────────────────────────

    /// @inheritdoc IGhostPool
    /// @dev    The user MUST compute `commitment = Poseidon(secret, nullifier)` off-chain.
    ///         The contract NEVER receives the secret or nullifier.
    ///
    ///         Gas: ~180,000 on BNB Chain (dominated by the Merkle tree update).
    function deposit(
        bytes32 commitment,
        uint256 amount,
        address token
    ) external override nonReentrant {
        // ── Validations ──────────────────────────────────────────────────────
        if (!allowedTokens[token]) revert TokenNotAllowed(token);
        if (amount < MIN_DEPOSIT) revert AmountTooSmall(amount, MIN_DEPOSIT);
        if (commitments[commitment]) revert CommitmentAlreadyInserted();

        // ── State ────────────────────────────────────────────────────────────
        commitments[commitment] = true;

        // Insert commitment as a new leaf in the incremental Merkle tree.
        uint32 insertedIndex = _insert(commitment);

        // Track pool balance for fee deduction
        _poolBalance[token] += amount;

        // ── Transfer ─────────────────────────────────────────────────────────
        // Pull tokens from the caller into the pool.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // ── Event ────────────────────────────────────────────────────────────
        emit Deposit(commitment, insertedIndex, amount, token, block.timestamp);
    }

    /// @inheritdoc IGhostPool
    /// @dev    Called by GhostPaymaster inside postOp() to charge the user's
    ///         shielded balance for gas. The fee is denominated in stablecoins
    ///         and transferred to the Paymaster contract.
    function deductFee(
        bytes32 nullifierHash,
        uint256 amount,
        address token
    ) external override nonReentrant {
        if (msg.sender != ghostPaymaster) revert CallerNotPaymaster(msg.sender);
        if (_poolBalance[token] < amount) revert InsufficientPoolBalance(amount, _poolBalance[token]);

        _poolBalance[token] -= amount;

        // Transfer stablecoins to the Paymaster to reimburse gas costs.
        IERC20(token).safeTransfer(ghostPaymaster, amount);

        emit FeeDeducted(nullifierHash, amount, token);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Set the GhostPaymaster address.
    /// @dev    Can only be set after GhostPaymaster is deployed (chicken-and-egg).
    ///         Callable only by owner.
    function setPaymaster(address _paymaster) external onlyOwner {
        require(_paymaster != address(0), "GhostPool: zero paymaster address");
        ghostPaymaster = _paymaster;
    }

    /// @notice Allow or disallow a token for deposits.
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        require(token != address(0), "GhostPool: zero token address");
        allowedTokens[token] = allowed;
    }

    /// @notice Emergency: withdraw tokens sent to the contract by mistake.
    /// @dev    Cannot withdraw pool deposits — only "excess" balance beyond accounting.
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "GhostPool: zero recipient");
        uint256 excess = IERC20(token).balanceOf(address(this)) - _poolBalance[token];
        require(amount <= excess, "GhostPool: cannot withdraw pool deposits");
        IERC20(token).safeTransfer(to, amount);
    }

    // ─── Merkle Tree Internals ────────────────────────────────────────────────

    /// @dev Insert `leaf` into the incremental Merkle tree.
    ///      Returns the leaf index of the inserted element.
    ///
    ///      Algorithm (O(log n) hashes):
    ///      - Start at the leaf level with `currentHash = leaf`.
    ///      - At each level i:
    ///          If the current leaf index is LEFT (even): store as filledSubtrees[i], pair with zeros[i]
    ///          If the current leaf index is RIGHT (odd): pair with filledSubtrees[i] (the saved left sibling)
    ///      - Hash the pair with Poseidon and move up one level.
    ///      - After all levels: the resulting hash is the new root.
    function _insert(bytes32 leaf) private returns (uint32 insertedIndex) {
        uint32 currentIndex = nextIndex;
        require(currentIndex < uint32(2) ** levels, "GhostPool: Merkle tree full");

        insertedIndex = currentIndex;
        nextIndex = currentIndex + 1;

        bytes32 currentHash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint32 i = 0; i < levels; ) {
            if (currentIndex % 2 == 0) {
                // Current node is a LEFT child.
                // Save it and pair with the zero sibling on the right.
                left = currentHash;
                right = zeros[i];
                filledSubtrees[i] = currentHash;
            } else {
                // Current node is a RIGHT child.
                // Pair with the last-saved left sibling.
                left = filledSubtrees[i];
                right = currentHash;
            }
            currentHash = hasher.poseidon(left, right);
            currentIndex >>= 1; // Move up one level
            unchecked { ++i; }
        }

        // Update root ring buffer.
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentHash;
    }

    /// @dev Compute the initial root from a tree full of zeros.
    ///      Called once in the constructor.
    function _initialRoot(
        IPoseidonHasher _hasher,
        uint32 _levels,
        bytes32[MAX_TREE_HEIGHT] storage _zeros
    ) private returns (bytes32 root) {
        root = _zeros[0];
        for (uint32 i = 1; i < _levels; ) {
            root = _hasher.poseidon(root, root);
            unchecked { ++i; }
        }
    }
}
