/**
 * POST /v1/proof/verify — Off-chain ZK proof verification (debug only)
 *
 * ⚠️  This endpoint is disabled in production.
 *    It exists only for development testing so you can verify proofs
 *    without submitting a full UserOperation.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyProof, validateProofShape, parsePublicSignals } from '../../zk/verifier.js';
import { nullifierRepo } from '../../db/repositories/nullifierRepo.js';
import { config } from '../../config.js';

const ProofVerifySchema = z.object({
  proof: z.object({
    pi_a: z.tuple([z.string(), z.string(), z.string()]),
    pi_b: z.tuple([
      z.tuple([z.string(), z.string()]),
      z.tuple([z.string(), z.string()]),
      z.tuple([z.string(), z.string()]),
    ]),
    pi_c: z.tuple([z.string(), z.string(), z.string()]),
  }),
  publicSignals: z.array(z.string()).length(3),
});

const proofRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/proof/verify
  fastify.post('/proof/verify', async (request, reply) => {
    if (config.NODE_ENV === 'production') {
      return reply.status(403).send({
        error: 'DISABLED',
        message: 'Proof verification endpoint is disabled in production',
      });
    }

    const parseResult = ProofVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten(),
      });
    }

    const { proof, publicSignals } = parseResult.data;

    // Shape check
    if (!validateProofShape(proof as Parameters<typeof validateProofShape>[0])) {
      return reply.status(400).send({
        error: 'MALFORMED_PROOF',
        message: 'Proof structure is invalid',
      });
    }

    // Parse signals
    let signals: ReturnType<typeof parsePublicSignals>;
    try {
      signals = parsePublicSignals(publicSignals);
    } catch (err: unknown) {
      return reply.status(400).send({
        error: 'INVALID_SIGNALS',
        message: err instanceof Error ? err.message : 'Bad public signals',
      });
    }

    // Check if nullifier already spent
    const spent = await nullifierRepo.isSpent(signals.nullifierHash);

    // Verify proof off-chain
    const valid = await verifyProof({
      proof: proof as Parameters<typeof verifyProof>[0]['proof'],
      publicSignals,
    });

    return reply.send({
      valid,
      nullifierAlreadySpent: spent,
      publicSignals: {
        merkleRoot: signals.merkleRoot,
        nullifierHash: signals.nullifierHash,
        recipient: signals.recipient,
      },
    });
  });
};

export default proofRoutes;
