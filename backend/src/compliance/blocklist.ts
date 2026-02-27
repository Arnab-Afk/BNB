/**
 * Combined blocklist — OFAC + Chainalysis + manual bans.
 * This is the single entry point for all compliance checks.
 */

import { prisma } from '../db/prisma/client.js';
import { logger } from '../utils/logger.js';
import { toChecksumAddress, isValidAddress } from '../utils/address.js';

export type BlockReason = 'OFAC_SDN' | 'CHAINALYSIS' | 'MANUAL';

/** Returns the reason an address is blocked, or null if not blocked. */
export async function getBlockReason(address: string): Promise<BlockReason | null> {
  if (!isValidAddress(address)) return null;
  const checksumAddr = toChecksumAddress(address);
  const record = await prisma.blockedAddress.findUnique({
    where: { address: checksumAddr },
    select: { reason: true },
  });
  return record ? (record.reason as BlockReason) : null;
}

/** Returns true if the address appears in ANY blocklist. */
export async function isBlocked(address: string): Promise<boolean> {
  return (await getBlockReason(address)) !== null;
}

/** Manually add an address to the blocklist. */
export async function blockAddress(
  address: string,
  reason: BlockReason,
  source: string,
): Promise<void> {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  const checksumAddr = toChecksumAddress(address);
  await prisma.blockedAddress.upsert({
    where: { address: checksumAddr },
    update: { reason, source },
    create: { address: checksumAddr, reason, source },
  });
  logger.warn({ address: checksumAddr, reason }, 'Address blocked');
}

/** Remove an address from the blocklist. */
export async function unblockAddress(address: string): Promise<boolean> {
  if (!isValidAddress(address)) return false;
  const checksumAddr = toChecksumAddress(address);
  try {
    await prisma.blockedAddress.delete({ where: { address: checksumAddr } });
    logger.info({ address: checksumAddr }, 'Address unblocked');
    return true;
  } catch {
    return false;
  }
}

/** List all blocked addresses (paginated). */
export async function listBlockedAddresses(
  skip = 0,
  take = 100,
): Promise<Array<{ address: string; reason: string; addedAt: Date }>> {
  return prisma.blockedAddress.findMany({
    skip,
    take,
    orderBy: { addedAt: 'desc' },
    select: { address: true, reason: true, addedAt: true },
  });
}
