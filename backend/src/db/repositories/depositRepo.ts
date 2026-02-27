import type { Deposit } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface CreateDepositInput {
  commitment: string;
  leafIndex: number;
  merkleRoot: string;
  amount: string;
  token: string;
  txHash: string;
  blockNumber?: bigint;
  depositor?: string;
}

export const depositRepo = {
  async create(input: CreateDepositInput): Promise<Deposit> {
    return prisma.deposit.create({ data: input });
  },

  async findByCommitment(commitment: string): Promise<Deposit | null> {
    return prisma.deposit.findUnique({ where: { commitment } });
  },

  async findByTxHash(txHash: string): Promise<Deposit | null> {
    return prisma.deposit.findUnique({ where: { txHash } });
  },

  async listByToken(token: string, skip = 0, take = 50): Promise<Deposit[]> {
    return prisma.deposit.findMany({
      where: { token },
      orderBy: { leafIndex: 'asc' },
      skip,
      take,
    });
  },

  async countTotal(): Promise<number> {
    return prisma.deposit.count();
  },

  async countByToken(token: string): Promise<number> {
    return prisma.deposit.count({ where: { token } });
  },

  /** Return deposits in leaf-index order (for Merkle tree reconstruction). */
  async findAllOrdered(): Promise<Deposit[]> {
    return prisma.deposit.findMany({ orderBy: { leafIndex: 'asc' } });
  },
};
