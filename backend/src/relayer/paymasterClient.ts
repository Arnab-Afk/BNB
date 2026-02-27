/**
 * GhostPaymaster On-Chain Client
 *
 * Handles reads from the GhostPaymaster and GhostPool contracts.
 */

import { createPublicClient, http, parseAbi, type Hex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const chain = config.CHAIN_ID === 56 ? bsc : bscTestnet;

const publicClient = createPublicClient({
  chain,
  transport: http(config.BNB_RPC_URL),
});

// Minimal ABIs — only the functions we need
const GHOST_POOL_ABI = parseAbi([
  'function getLastRoot() external view returns (bytes32)',
  'function isKnownRoot(bytes32 root) external view returns (bool)',
  'function isCommitmentInserted(bytes32 commitment) external view returns (bool)',
  'function nextLeafIndex() external view returns (uint32)',
  'function poolBalance(address token) external view returns (uint256)',
]);

/**
 * Fetch the current Merkle root from the on-chain GhostPool.
 */
export async function getOnChainRoot(): Promise<Hex> {
  const root = await publicClient.readContract({
    address: config.GHOST_POOL_ADDRESS as Hex,
    abi: GHOST_POOL_ABI,
    functionName: 'getLastRoot',
  });
  return root as Hex;
}

/**
 * Check whether a root is known to the on-chain pool (within ROOT_HISTORY_SIZE).
 */
export async function isKnownRoot(root: Hex): Promise<boolean> {
  const result = await publicClient.readContract({
    address: config.GHOST_POOL_ADDRESS as Hex,
    abi: GHOST_POOL_ABI,
    functionName: 'isKnownRoot',
    args: [root],
  });
  return result as boolean;
}

/**
 * Check whether a commitment has been inserted on-chain.
 */
export async function isCommitmentInserted(commitment: Hex): Promise<boolean> {
  const result = await publicClient.readContract({
    address: config.GHOST_POOL_ADDRESS as Hex,
    abi: GHOST_POOL_ABI,
    functionName: 'isCommitmentInserted',
    args: [commitment],
  });
  return result as boolean;
}

/**
 * Get the next leaf index from the on-chain pool.
 */
export async function getNextLeafIndex(): Promise<number> {
  const idx = await publicClient.readContract({
    address: config.GHOST_POOL_ADDRESS as Hex,
    abi: GHOST_POOL_ABI,
    functionName: 'nextLeafIndex',
  });
  return Number(idx);
}

/**
 * Get the pool balance for a given token.
 */
export async function getPoolBalance(tokenAddress: string): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: config.GHOST_POOL_ADDRESS as Hex,
    abi: GHOST_POOL_ABI,
    functionName: 'poolBalance',
    args: [tokenAddress as Hex],
  });
  return balance as bigint;
}

/**
 * Check if the contracts are reachable.
 */
export async function checkContractHealth(): Promise<boolean> {
  try {
    await getOnChainRoot();
    return true;
  } catch (err) {
    logger.warn({ err }, 'GhostPool contract unreachable');
    return false;
  }
}
