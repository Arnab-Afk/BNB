import type { Nullifier, NullifierStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export const nullifierRepo = {
  /**
   * Check if a nullifier has been spent.
   * Returns the record if found (regardless of status), null otherwise.
   */
  async find(hash: string): Promise<Nullifier | null> {
    return prisma.nullifier.findUnique({ where: { hash } });
  },

  /** Returns true if the nullifier has been spent (PENDING or SPENT). */
  async isSpent(hash: string): Promise<boolean> {
    const record = await prisma.nullifier.findUnique({
      where: { hash },
      select: { status: true },
    });
    if (!record) return false;
    return record.status === 'PENDING' || record.status === 'SPENT';
  },

  /** Mark a nullifier as PENDING when the relay job is accepted. */
  async markPending(hash: string, operationId: string): Promise<Nullifier> {
    return prisma.nullifier.upsert({
      where: { hash },
      update: { status: 'PENDING', operationId },
      create: { hash, status: 'PENDING', operationId },
    });
  },

  /** Mark a nullifier as SPENT once the transaction is confirmed. */
  async markSpent(hash: string, txHash: string): Promise<Nullifier> {
    return prisma.nullifier.update({
      where: { hash },
      data: { status: 'SPENT', txHash, spentAt: new Date() },
    });
  },

  /** Revert a nullifier back to REVERTED if the tx was reverted. */
  async markReverted(hash: string): Promise<Nullifier> {
    return prisma.nullifier.update({
      where: { hash },
      data: { status: 'REVERTED' },
    });
  },

  async countByStatus(status: NullifierStatus): Promise<number> {
    return prisma.nullifier.count({ where: { status } });
  },
};
