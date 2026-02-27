// Minimal ABIs for on-chain interaction

export const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function mint(address to, uint256 amount) external", // MockERC20 only
] as const;

export const GHOST_POOL_ABI = [
    // Deposit
    "function deposit(bytes32 commitment, uint256 amount, address token) external",
    // Roots & nullifiers
    "function isKnownRoot(bytes32 root) view returns (bool)",
    "function nullifiers(bytes32) view returns (bool)",
    "function getLastRoot() view returns (bytes32)",
    "function nextLeafIndex() view returns (uint256)",
    // Events — must match IGhostPool.sol exactly
    "event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, uint256 amount, address indexed token, uint256 timestamp)",
] as const;

export const GHOST_PAYMASTER_ABI = [
    "function zkVerificationEnabled() view returns (bool)",
    "function getDeposit() view returns (uint256)",
] as const;

export const ENTRY_POINT_ABI = [
    "function getDepositInfo(address) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)",
    "function getNonce(address sender, uint192 key) view returns (uint256 nonce)",
    "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external",
] as const;

export const SMART_ACCOUNT_ABI = [
    "function execute(address target, uint256 value, bytes calldata data) external",
    "function validateUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)",
] as const;
