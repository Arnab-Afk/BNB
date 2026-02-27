import type { RelayOperation, OperationStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface CreateOperationInput {
  sender: string;
  merkleRoot: string;
  nullifierHash: string;
  chainId?: number;
}

export const operationRepo = {
  async create(input: CreateOperationInput): Promise<RelayOperation> {
    return prisma.relayOperation.create({
      data: {
        sender: input.sender,
        merkleRoot: input.merkleRoot,
        nullifierHash: input.nullifierHash,
        chainId: input.chainId ?? 56,
        status: 'QUEUED',
      },
    });
  },

  async findById(id: string): Promise<RelayOperation | null> {
    return prisma.relayOperation.findUnique({ where: { id } });
  },

  async findByUserOpHash(userOpHash: string): Promise<RelayOperation | null> {
    return prisma.relayOperation.findUnique({ where: { userOpHash } });
  },

  async updateStatus(
    id: string,
    status: OperationStatus,
    extras?: Partial<Pick<RelayOperation, 'txHash' | 'blockNumber' | 'gasUsed' | 'errorMessage' | 'userOpHash' | 'completedAt'>>,
  ): Promise<RelayOperation> {
    return prisma.relayOperation.update({
      where: { id },
      data: { status, ...extras, updatedAt: new Date() },
    });
  },

  async markCompleted(id: string, txHash: string, blockNumber: bigint, gasUsed: string): Promise<RelayOperation> {
    return prisma.relayOperation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        txHash,
        blockNumber,
        gasUsed,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  async markFailed(id: string, errorMessage: string): Promise<RelayOperation> {
    return prisma.relayOperation.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  async countByStatus(status: OperationStatus): Promise<number> {
    return prisma.relayOperation.count({ where: { status } });
  },
};
