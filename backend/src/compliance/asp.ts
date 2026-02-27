/**
 * Association Set Provider (ASP) compliance module.
 *
 * Implements the Oxbow-style compliance model:
 *  1. OFAC SDN list check (via blocklist DB)
 *  2. Optional Chainalysis risk-score check
 *  3. Local protocol-level blocklist
 *
 * The ASP runs BEFORE accepting any relay request.
 * If any check fails, the request is rejected with a COMPLIANCE_BLOCKED error.
 */

import axios from 'axios';
import { isBlocked, getBlockReason, blockAddress } from './blocklist.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { isValidAddress, toChecksumAddress } from '../utils/address.js';

export interface AspCheckResult {
  allowed: boolean;
  reason?: string;
  riskScore?: number; // 0-10, 10 = highest risk
}

// ─── Chainalysis ──────────────────────────────────────────────────────────────

const CHAINALYSIS_API_BASE = 'https://public.chainalysis.com/api/v1';
const CHAINALYSIS_RISK_THRESHOLD = 7; // Block addresses with risk score >= 7

interface ChainalysisResponse {
  identifications: Array<{
    category: string;
    name: string;
    description: string;
  }>;
}

async function checkChainalysis(address: string): Promise<{ blocked: boolean; reason?: string }> {
  if (!config.CHAINALYSIS_API_KEY) return { blocked: false };

  try {
    const response = await axios.get<ChainalysisResponse>(
      `${CHAINALYSIS_API_BASE}/address/${address}`,
      {
        headers: { Token: config.CHAINALYSIS_API_KEY },
        timeout: 5_000,
      },
    );

    const ids = response.data?.identifications ?? [];
    if (ids.length > 0) {
      const reason = ids.map((i) => i.category).join(', ');
      return { blocked: true, reason: `Chainalysis: ${reason}` };
    }
    return { blocked: false };
  } catch (err: unknown) {
    // Don't block on API failure — log and allow
    logger.warn({ err, address }, 'Chainalysis API check failed — skipping');
    return { blocked: false };
  }
}

// ─── Main ASP Check ───────────────────────────────────────────────────────────

/**
 * Run all compliance checks for a given address.
 * Returns { allowed: true } if all checks pass.
 * Returns { allowed: false, reason } if any check fails.
 */
export async function aspCheck(address: string): Promise<AspCheckResult> {
  if (!isValidAddress(address)) {
    return { allowed: false, reason: 'Invalid address format' };
  }
  const checksumAddr = toChecksumAddress(address);

  // 1. Local blocklist (OFAC + manual)
  const blockReason = await getBlockReason(checksumAddr);
  if (blockReason) {
    logger.warn({ address: checksumAddr, reason: blockReason }, 'ASP: address blocked (local list)');
    return { allowed: false, reason: `Blocked: ${blockReason}` };
  }

  // 2. Chainalysis (optional)
  const chainalysis = await checkChainalysis(checksumAddr);
  if (chainalysis.blocked) {
    // Auto-add to local blocklist for future fast-path checks
    await blockAddress(checksumAddr, 'CHAINALYSIS', 'chainalysis-api').catch(() => {});
    logger.warn({ address: checksumAddr, reason: chainalysis.reason }, 'ASP: address blocked (Chainalysis)');
    return { allowed: false, reason: chainalysis.reason };
  }

  return { allowed: true };
}

/**
 * Batch check multiple addresses (e.g., sender + recipient).
 * Returns the first failure found, or { allowed: true } if all pass.
 */
export async function aspCheckBatch(addresses: string[]): Promise<AspCheckResult> {
  for (const addr of addresses) {
    const result = await aspCheck(addr);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
