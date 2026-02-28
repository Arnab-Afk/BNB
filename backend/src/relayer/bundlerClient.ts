/**
 * bundlerClient.ts — ERC-4337 Bundler Client
 *
 * Submits UserOperations to the configured bundler (Pimlico) via JSON-RPC.
 * Uses viem directly — permissionless@0.2.x removed createBundlerClient export.
 */

import { createPublicClient, http, type Hex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { UserOpInput } from './userOpBuilder.js';

// ERC-4337 EntryPoint v0.6 — canonical address on all EVM chains
export const ENTRYPOINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2781' as const;

const chain = config.CHAIN_ID === 56 ? bsc : bscTestnet;

// Public RPC client for chain reads
export const publicClient = createPublicClient({
  chain,
  transport: http(config.BNB_RPC_URL),
});

// ── JSON-RPC helpers ───────────────────────────────────────────────────────────

let _reqId = 1;

async function bundlerRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(config.BUNDLER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: _reqId++, method, params }),
  });

  if (!res.ok) {
    throw new Error(`Bundler HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json() as { result?: unknown; error?: { message: string; code: number } };
  if (json.error) {
    throw new Error(`Bundler RPC error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send a UserOperation to the bundler.
 * Returns the UserOp hash returned by the bundler.
 */
export async function sendUserOperation(userOp: UserOpInput): Promise<Hex> {
  logger.debug({ sender: userOp.sender }, 'Sending UserOperation to bundler');

  const userOpHash = await bundlerRpc('eth_sendUserOperation', [userOp, ENTRYPOINT_V06]) as Hex;
  logger.info({ userOpHash, sender: userOp.sender }, 'UserOperation submitted to bundler');
  return userOpHash;
}

/**
 * Estimate gas limits for a UserOperation via the bundler.
 */
export async function estimateUserOperationGas(
  userOp: Partial<UserOpInput>,
): Promise<{ preVerificationGas: bigint; verificationGasLimit: bigint; callGasLimit: bigint }> {
  const result = await bundlerRpc('eth_estimateUserOperationGas', [userOp, ENTRYPOINT_V06]) as {
    preVerificationGas: string;
    verificationGasLimit: string;
    callGasLimit: string;
  };

  return {
    preVerificationGas: BigInt(result.preVerificationGas),
    verificationGasLimit: BigInt(result.verificationGasLimit),
    callGasLimit: BigInt(result.callGasLimit),
  };
}

/**
 * Wait for a UserOp to be included in a block by polling eth_getUserOperationReceipt.
 */
export async function waitForUserOperation(
  userOpHash: Hex,
  timeoutMs = 60_000,
): Promise<{ transactionHash: Hex; blockNumber: bigint }> {
  logger.debug({ userOpHash }, 'Waiting for UserOperation receipt');
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const receipt = await bundlerRpc('eth_getUserOperationReceipt', [userOpHash]) as null | {
      receipt: { transactionHash: string; blockNumber: string };
    };

    if (receipt?.receipt) {
      const out = {
        transactionHash: receipt.receipt.transactionHash as Hex,
        blockNumber: BigInt(receipt.receipt.blockNumber),
      };
      logger.info({ userOpHash, ...out }, 'UserOperation confirmed');
      return out;
    }

    await new Promise((r) => setTimeout(r, 2_000));
  }

  throw new Error(`Timeout waiting for UserOp ${userOpHash} after ${timeoutMs}ms`);
}

/**
 * Check if the bundler is reachable.
 */
export async function checkBundlerHealth(): Promise<boolean> {
  try {
    await bundlerRpc('eth_chainId', []);
    return true;
  } catch {
    return false;
  }
}
