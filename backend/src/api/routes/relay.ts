/**
 * POST /v1/relay        — Submit a signed UserOperation for private gas relay
 * GET  /v1/relay/status/:jobId — Poll relay job status
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RelayRequestSchema } from '../../relayer/userOpBuilder.js';
import { verifyProof, validateProofShape, parsePublicSignals } from '../../zk/verifier.js';
import { nullifierRepo } from '../../db/repositories/nullifierRepo.js';
import { operationRepo } from '../../db/repositories/operationRepo.js';
import { enqueueRelayJob } from '../../relayer/queue.js';
import { aspCheckBatch } from '../../compliance/asp.js';
import { isKnownRoot, checkContractHealth } from '../../relayer/paymasterClient.js';
import { validatePaymasterAddress, validateChainId } from '../../relayer/userOpBuilder.js';
import { logger } from '../../utils/logger.js';
import type { Hex } from 'viem';

const relayRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/relay
  fastify.post(
    '/relay',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // ── Parse & validate body ──────────────────────────────────────────────
      const parseResult = RelayRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Request body validation failed',
          details: parseResult.error.flatten(),
        });
      }

      const { userOp, zkProof, publicSignals, chainId } = parseResult.data;

      // ── Chain ID check ─────────────────────────────────────────────────────
      if (!validateChainId(chainId)) {
        return reply.status(400).send({
          error: 'WRONG_CHAIN',
          message: `Expected chainId ${process.env['CHAIN_ID'] ?? 56}, got ${chainId}`,
        });
      }

      // ── Paymaster address check ────────────────────────────────────────────
      if (!validatePaymasterAddress(userOp.paymasterAndData)) {
        return reply.status(400).send({
          error: 'INVALID_PAYMASTER',
          message: 'paymasterAndData does not reference the Ghost Paymaster contract',
        });
      }

      // ── ZK Proof shape validation ──────────────────────────────────────────
      if (!validateProofShape(zkProof as Parameters<typeof validateProofShape>[0])) {
        return reply.status(400).send({
          error: 'INVALID_PROOF_SHAPE',
          message: 'ZK proof is malformed',
        });
      }

      // ── Parse public signals ───────────────────────────────────────────────
      let signals: ReturnType<typeof parsePublicSignals>;
      try {
        signals = parsePublicSignals(publicSignals);
      } catch (err: unknown) {
        return reply.status(400).send({
          error: 'INVALID_PUBLIC_SIGNALS',
          message: err instanceof Error ? err.message : 'Invalid public signals',
        });
      }

      const { merkleRoot, nullifierHash } = signals;

      // ── Nullifier double-spend check ──────────────────────────────────────
      const alreadySpent = await nullifierRepo.isSpent(nullifierHash);
      if (alreadySpent) {
        return reply.status(400).send({
          error: 'PROOF_ALREADY_SPENT',
          message: 'This nullifier has already been used.',
          details: { nullifierHash },
        });
      }

      // ── On-chain Merkle root check ─────────────────────────────────────────
      const rootKnown = await isKnownRoot(merkleRoot as Hex).catch(() => false);
      if (!rootKnown) {
        return reply.status(400).send({
          error: 'UNKNOWN_MERKLE_ROOT',
          message: 'The provided Merkle root is not known to the GhostPool contract.',
          details: { merkleRoot },
        });
      }

      // ── Off-chain ZK proof verification ──────────────────────────────────
      const proofValid = await verifyProof({
        proof: zkProof as Parameters<typeof verifyProof>[0]['proof'],
        publicSignals,
      });
      if (!proofValid) {
        return reply.status(400).send({
          error: 'INVALID_ZK_PROOF',
          message: 'The provided ZK proof failed off-chain Groth16 verification.',
        });
      }

      // ── ASP / Compliance check ────────────────────────────────────────────
      const aspResult = await aspCheckBatch([userOp.sender, signals.recipient]);
      if (!aspResult.allowed) {
        return reply.status(403).send({
          error: 'COMPLIANCE_BLOCKED',
          message: aspResult.reason ?? 'Address blocked by compliance module',
        });
      }

      // ── Create operation record ───────────────────────────────────────────
      const operation = await operationRepo.create({
        sender: userOp.sender,
        merkleRoot,
        nullifierHash,
        chainId,
      });

      // ── Mark nullifier as pending ────────────────────────────────────────
      await nullifierRepo.markPending(nullifierHash, operation.id.toString());

      // ── Enqueue relay job ─────────────────────────────────────────────────
      await enqueueRelayJob(operation.id.toString(), parseResult.data);

      logger.info({ operationId: operation.id, sender: userOp.sender }, 'Relay job queued');

      return reply.status(202).send({
        jobId: operation.id.toString(),
        status: 'queued',
        message: 'UserOperation accepted. Use /v1/relay/status/:jobId to track.',
      });
    },
  );

  // GET /v1/relay/status/:jobId
  fastify.get<{ Params: { jobId: string } }>(
    '/relay/status/:jobId',
    async (request, reply) => {
      const { jobId } = request.params;

      const operation = await operationRepo.findById(parseInt(jobId, 10));
      if (!operation) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Job ${jobId} not found`,
        });
      }

      return reply.send({
        jobId: operation.id,
        status: operation.status.toLowerCase(),
        txHash: operation.txHash ?? null,
        blockNumber: operation.blockNumber?.toString() ?? null,
        gasUsed: operation.gasUsed ?? null,
        errorMessage: operation.errorMessage ?? null,
        timestamp: operation.updatedAt.toISOString(),
      });
    },
  );
};

export default relayRoutes;
