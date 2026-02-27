/**
 * Minimal ABIs for Ghost Privacy Suite contracts.
 * Only includes the functions and events the backend needs to call.
 */

export const GHOST_POOL_ABI = [
  // ─── View functions ────────────────────────────────────────────────────
  {
    name: 'getLastRoot',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'isKnownRoot',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isCommitmentInserted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nextLeafIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint32' }],
  },
  {
    name: 'poolBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ─── Events ────────────────────────────────────────────────────────────
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'FeeDeducted',
    type: 'event',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: false },
    ],
  },
] as const;

export const GHOST_PAYMASTER_ABI = [
  // ─── View functions ────────────────────────────────────────────────────
  {
    name: 'nullifiers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'bnbToUsdcRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'zkVerificationEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  // ─── Events ────────────────────────────────────────────────────────────
  {
    name: 'NullifierSpent',
    type: 'event',
    inputs: [{ name: 'nullifierHash', type: 'bytes32', indexed: true }],
  },
  {
    name: 'GasSponsored',
    type: 'event',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'gasCostWei', type: 'uint256', indexed: false },
      { name: 'feeUSDC', type: 'uint256', indexed: false },
      { name: 'feeToken', type: 'address', indexed: false },
    ],
  },
] as const;
