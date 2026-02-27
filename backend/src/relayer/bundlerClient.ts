/**
 * Bundler Client
 *
 * Sends ERC-4337 UserOperations to the configured bundler (Pimlico / Alchemy).
 * Uses the `permissionless` SDK for type-safe UserOp handling.
 */

import { createPublicClient, http, type Hex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { createBundlerClient, ENTRYPOINT_ADDRESS_V06, type UserOperation } from 'permissionless';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const chain = config.CHAIN_ID === 56 ? bsc : bscTestnet;

// Public RPC client for chain reads
export const publicClient = createPublicClient({
  chain,
  transport: http(config.BNB_RPC_URL),
});

// Bundler client for submitting UserOps
export const bundlerClient = createBundlerClient({
  transport: http(config.BUNDLER_URL),
  entryPoint: ENTRYPOINT_ADDRESS_V06,
});

/**
 * Send a UserOperation to the bundler.
 * Returns the UserOp hash returned by the bundler.
 */
export async function sendUserOperation(userOp: UserOperation<'v0.6'>): Promise<Hex> {
  logger.debug({ sender: userOp.sender }, 'Sending UserOperation to bundler');

  try {
    const userOpHash = await bundlerClient.sendUserOperation({
      userOperation: userOp,
      entryPoint: ENTRYPOINT_ADDRESS_V06,
    });

    logger.info({ userOpHash, sender: userOp.sender }, 'UserOperation submitted to bundler');
    return userOpHash;
  } catch (err) {
    logger.error({ err, sender: userOp.sender }, 'Bundler rejected UserOperation');
    throw err;
  }
}

/**
 * Wait for a UserOp to be included in a block.
 * Returns the transaction receipt.
 */
export async function waitForUserOperation(userOpHash: Hex) {
  logger.debug({ userOpHash }, 'Waiting for UserOperation receipt');

  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 60_000,
  });

  logger.info(
    { userOpHash, txHash: receipt.receipt.transactionHash, blockNumber: receipt.receipt.blockNumber },
    'UserOperation confirmed',
  );
  return receipt;
}

/**
 * Estimate gas limits for a UserOperation via the bundler.
 */
export async function estimateUserOperationGas(
  userOp: Partial<UserOperation<'v0.6'>>,
): Promise<{ preVerificationGas: bigint; verificationGasLimit: bigint; callGasLimit: bigint }> {
  const estimate = await bundlerClient.estimateUserOperationGas({
    userOperation: userOp as UserOperation<'v0.6'>,
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });
  return estimate;
}

/**
 * Check if the bundler is reachable.
 */
export async function checkBundlerHealth(): Promise<boolean> {
  try {
    await bundlerClient.chainId();
    return true;
  } catch {
    return false;
  }
}
