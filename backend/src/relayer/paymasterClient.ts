/**
 * GhostPaymaster On-Chain Client
 *
 * Handles reads from the GhostPaymaster and GhostPool contracts.
 * Shared viem public client used by all contract reads.
 */

import { createPublicClient, http, type Hex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { GHOST_POOL_ABI, GHOST_PAYMASTER_ABI } from '../contracts/abis.js';
import { getContractAddresses } from '../contracts/addresses.js';

const chain = config.CHAIN_ID === 56 ? bsc : bscTestnet;

export const publicClient = createPublicClient({
  chain,
  transport: http(config.BNB_RPC_URL),
});

// ─── GhostPool reads ──────────────────────────────────────────────────────────

/**
 * Fetch the current Merkle root from the on-chain GhostPool.
 */
export async function getOnChainRoot(): Promise<Hex> {
  const { ghostPool } = getContractAddresses();
  const root = await publicClient.readContract({
    address: ghostPool,
    abi: GHOST_POOL_ABI,
    functionName: 'getLastRoot',
  });
  return root as Hex;
}

/**
 * Check whether a root is known to the on-chain pool (within ROOT_HISTORY_SIZE).
 */
export async function isKnownRoot(root: Hex): Promise<boolean> {
  const { ghostPool } = getContractAddresses();
  const result = await publicClient.readContract({
    address: ghostPool,
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
  const { ghostPool } = getContractAddresses();
  const result = await publicClient.readContract({
    address: ghostPool,
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
  const { ghostPool } = getContractAddresses();
  const idx = await publicClient.readContract({
    address: ghostPool,
    abi: GHOST_POOL_ABI,
    functionName: 'nextLeafIndex',
  });
  return Number(idx);
}

/**
 * Get the pool balance for a given token.
 */
export async function getPoolBalance(tokenAddress: string): Promise<bigint> {
  const { ghostPool } = getContractAddresses();
  const balance = await publicClient.readContract({
    address: ghostPool,
    abi: GHOST_POOL_ABI,
    functionName: 'poolBalance',
    args: [tokenAddress as Hex],
  });
  return balance as bigint;
}

// ─── GhostPaymaster reads ─────────────────────────────────────────────────────

/**
 * Check whether a nullifier hash has been spent on-chain.
 * This is the authoritative check — the on-chain mapping is updated by the Paymaster.
 */
export async function isNullifierSpentOnChain(nullifierHash: Hex): Promise<boolean> {
  const { ghostPaymaster } = getContractAddresses();
  try {
    const spent = await publicClient.readContract({
      address: ghostPaymaster,
      abi: GHOST_PAYMASTER_ABI,
      functionName: 'nullifiers',
      args: [nullifierHash],
    });
    return spent as boolean;
  } catch (err) {
    logger.warn({ err, nullifierHash }, 'Failed to check on-chain nullifier — defaulting to not-spent');
    return false;
  }
}

/**
 * Get the current BNB → USDC conversion rate from the GhostPaymaster.
 * Rate is stored scaled by 1e18 (e.g., BNB=$600, USDC 6dp → rate=600_000_000).
 */
export async function getBnbToUsdcRate(): Promise<bigint> {
  const { ghostPaymaster } = getContractAddresses();
  const rate = await publicClient.readContract({
    address: ghostPaymaster,
    abi: GHOST_PAYMASTER_ABI,
    functionName: 'bnbToUsdcRate',
  });
  return rate as bigint;
}

/**
 * Check whether ZK verification is enabled on the GhostPaymaster.
 */
export async function isZkVerificationEnabled(): Promise<boolean> {
  const { ghostPaymaster } = getContractAddresses();
  const enabled = await publicClient.readContract({
    address: ghostPaymaster,
    abi: GHOST_PAYMASTER_ABI,
    functionName: 'zkVerificationEnabled',
  });
  return enabled as boolean;
}

// ─── Health ───────────────────────────────────────────────────────────────────

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
