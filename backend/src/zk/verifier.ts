import { readFileSync } from 'fs';
import * as snarkjs from 'snarkjs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface ZkProof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol?: string;
  curve?: string;
}

export interface ZkPublicSignals {
  merkleRoot: string;     // Public signal[0]
  nullifierHash: string;  // Public signal[1]
  recipient: string;      // Public signal[2]
}

export interface ZkProofInput {
  proof: ZkProof;
  publicSignals: string[]; // Raw array from snarkjs
}

// Cached verification key — loaded once at startup
let _verificationKey: object | null = null;

function loadVerificationKey(): object {
  if (_verificationKey) return _verificationKey;
  try {
    const raw = readFileSync(config.CIRCUIT_VERIFICATION_KEY_PATH, 'utf-8');
    _verificationKey = JSON.parse(raw) as object;
    logger.info('ZK verification key loaded');
    return _verificationKey;
  } catch (err) {
    logger.warn({ err }, 'ZK verification key not found — off-chain snarkjs verification disabled');
    _verificationKey = {};
    return _verificationKey;
  }
}

/**
 * Verify a Groth16 ZK proof off-chain using snarkjs.
 * Returns true if the proof is valid, false otherwise.
 *
 * NOTE: The on-chain Groth16Verifier.sol is the authoritative verifier.
 *       This off-chain check is a fast pre-screen before broadcasting.
 */
export async function verifyProof(input: ZkProofInput): Promise<boolean> {
  const vk = loadVerificationKey();
  if (!vk || Object.keys(vk).length === 0) {
    logger.debug('Skipping off-chain ZK verification — no verification key');
    return true; // Fallback: let on-chain verification decide
  }

  try {
    const result = await snarkjs.groth16.verify(vk, input.publicSignals, input.proof);
    return result;
  } catch (err) {
    logger.error({ err }, 'snarkjs proof verification threw');
    return false;
  }
}

/**
 * Parse the raw public signals array from snarkjs into a typed object.
 * Signals order: [merkleRoot, nullifierHash, recipient]
 */
export function parsePublicSignals(signals: string[]): ZkPublicSignals {
  if (signals.length < 3) {
    throw new Error(`Expected 3 public signals, got ${signals.length}`);
  }
  return {
    merkleRoot: signals[0]!,
    nullifierHash: signals[1]!,
    recipient: signals[2]!,
  };
}

/**
 * Basic sanity checks on proof structure before expensive verification.
 */
export function validateProofShape(proof: ZkProof): boolean {
  if (!Array.isArray(proof.pi_a) || proof.pi_a.length < 2) return false;
  if (!Array.isArray(proof.pi_b) || proof.pi_b.length < 2) return false;
  if (!Array.isArray(proof.pi_c) || proof.pi_c.length < 2) return false;
  return true;
}
