/**
 * UserOperation Builder & Validator
 *
 * Constructs and validates ERC-4337 UserOperation v0.6 objects.
 */

import { z } from 'zod';
import { type UserOperation } from 'permissionless';
import { type Hex, isAddress, isHex } from 'viem';
import { config } from '../config.js';

// ─── Zod Schema for incoming UserOp ──────────────────────────────────────────

const hexString = z.string().refine((v) => isHex(v), { message: 'Must be a 0x-prefixed hex string' });
const addressString = z.string().refine((v) => isAddress(v), { message: 'Must be a valid EVM address' });

export const UserOpSchema = z.object({
  sender: addressString,
  nonce: hexString,
  initCode: hexString,
  callData: hexString,
  callGasLimit: hexString,
  verificationGasLimit: hexString,
  preVerificationGas: hexString,
  maxFeePerGas: hexString,
  maxPriorityFeePerGas: hexString,
  paymasterAndData: hexString,
  signature: hexString,
});

export type UserOpInput = z.infer<typeof UserOpSchema>;

// ─── ZK Proof Schema ──────────────────────────────────────────────────────────

export const ZkProofSchema = z.object({
  pi_a: z.tuple([z.string(), z.string(), z.string()]),
  pi_b: z.tuple([
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string()]),
  ]),
  pi_c: z.tuple([z.string(), z.string(), z.string()]),
});

export const RelayRequestSchema = z.object({
  userOp: UserOpSchema,
  zkProof: ZkProofSchema,
  publicSignals: z.array(z.string()).length(3, 'Expected exactly 3 public signals'),
  chainId: z.number().int().positive(),
});

export type RelayRequest = z.infer<typeof RelayRequestSchema>;

// ─── Conversion & Validation ──────────────────────────────────────────────────

/**
 * Convert a validated RelayRequest userOp into a permissionless UserOperation.
 */
export function toUserOperation(input: UserOpInput): UserOperation<'v0.6'> {
  return {
    sender: input.sender as Hex,
    nonce: BigInt(input.nonce),
    initCode: input.initCode as Hex,
    callData: input.callData as Hex,
    callGasLimit: BigInt(input.callGasLimit),
    verificationGasLimit: BigInt(input.verificationGasLimit),
    preVerificationGas: BigInt(input.preVerificationGas),
    maxFeePerGas: BigInt(input.maxFeePerGas),
    maxPriorityFeePerGas: BigInt(input.maxPriorityFeePerGas),
    paymasterAndData: input.paymasterAndData as Hex,
    signature: input.signature as Hex,
  };
}

/**
 * Validate that the paymasterAndData prefix matches our GhostPaymaster address.
 */
export function validatePaymasterAddress(paymasterAndData: string): boolean {
  if (paymasterAndData === '0x' || paymasterAndData.length < 42) return false;
  // First 20 bytes (40 hex chars + "0x") = paymaster address
  const extractedAddress = '0x' + paymasterAndData.slice(2, 42);
  return extractedAddress.toLowerCase() === config.PAYMASTER_CONTRACT_ADDRESS.toLowerCase();
}

/**
 * Validate that chainId matches the configured chain.
 */
export function validateChainId(chainId: number): boolean {
  return chainId === config.CHAIN_ID;
}
