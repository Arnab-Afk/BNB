/**
 * POST /v1/pool/deposit       — Register a deposit commitment
 * GET  /v1/pool/status        — Get pool statistics
 * GET  /v1/pool/merkle-proof  — Get Merkle proof for a commitment (for ZK proof generation)
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { depositRepo } from '../../db/repositories/depositRepo.js';
import { merkleTree } from '../../zk/merkleTree.js';
import { logger } from '../../utils/logger.js';

const DepositSchema = z.object({
  commitment: z.string().startsWith('0x').length(66),
  txHash: z.string().startsWith('0x').length(66),
  amount: z.string().regex(/^\d+$/, 'Must be a non-negative integer string'),
  token: z.string().startsWith('0x').length(42),
});

const poolRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/pool/deposit
  fastify.post('/pool/deposit', async (request, reply) => {
    const parseResult = DepositSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten(),
      });
    }

    const { commitment, txHash, amount, token } = parseResult.data;

    // Check duplicate
    const existing = await depositRepo.findByCommitment(commitment);
    if (existing) {
      return reply.status(409).send({
        error: 'COMMITMENT_ALREADY_INSERTED',
        message: 'This commitment has already been registered.',
        leafIndex: existing.leafIndex,
        merkleRoot: existing.merkleRoot,
      });
    }

    // Insert into Merkle tree
    const commitment256 = BigInt(commitment);
    const { root: newRoot, leafIndex } = await merkleTree.insert(commitment256);
    const merkleRootHex = '0x' + newRoot.toString(16).padStart(64, '0');

    // Persist deposit record
    const deposit = await depositRepo.create({
      commitment,
      leafIndex,
      merkleRoot: merkleRootHex,
      amount,
      token,
      txHash,
    });

    logger.info({ commitment, leafIndex, merkleRoot: merkleRootHex }, 'Deposit registered');

    return reply.status(201).send({
      leafIndex: deposit.leafIndex,
      merkleRoot: merkleRootHex,
      message: 'Commitment inserted. Merkle root updated.',
    });
  });

  // GET /v1/pool/status
  fastify.get('/pool/status', async (_request, reply) => {
    const [totalDeposits, nextLeafIndex, root] = await Promise.all([
      depositRepo.countTotal(),
      Promise.resolve(merkleTree.getNextIndex()),
      Promise.resolve(merkleTree.getCurrentRoot()),
    ]);

    const merkleRootHex = '0x' + root.toString(16).padStart(64, '0');

    return reply.send({
      totalDeposits,
      activeCommitments: nextLeafIndex,
      merkleRoot: merkleRootHex,
      merkleTreeHeight: Number(process.env['MERKLE_TREE_HEIGHT'] ?? 20),
      anonymitySetSize: nextLeafIndex,
    });
  });

  // GET /v1/pool/merkle-proof?leaf=0x...
  fastify.get<{ Querystring: { leaf: string } }>(
    '/pool/merkle-proof',
    async (request, reply) => {
      const { leaf } = request.query;

      if (!leaf || !leaf.startsWith('0x')) {
        return reply.status(400).send({
          error: 'MISSING_LEAF',
          message: 'Provide the commitment as ?leaf=0x...',
        });
      }

      // Find deposit by commitment
      const deposit = await depositRepo.findByCommitment(leaf);
      if (!deposit) {
        return reply.status(404).send({
          error: 'COMMITMENT_NOT_FOUND',
          message: 'No deposit found for this commitment',
        });
      }

      const proof = merkleTree.getMerkleProof(deposit.leafIndex);

      return reply.send({
        leaf,
        leafIndex: deposit.leafIndex,
        root: '0x' + proof.root.toString(16).padStart(64, '0'),
        pathElements: proof.pathElements.map((e) => '0x' + e.toString(16).padStart(64, '0')),
        pathIndices: proof.pathIndices,
      });
    },
  );
};

export default poolRoutes;
