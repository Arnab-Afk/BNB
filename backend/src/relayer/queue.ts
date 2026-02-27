/**
 * BullMQ Relay Queue
 *
 * Manages asynchronous processing of UserOperation relay jobs.
 * Each job goes through:
 *   QUEUED → PROCESSING → SUBMITTED → COMPLETED | FAILED
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { operationRepo } from '../db/repositories/operationRepo.js';
import { nullifierRepo } from '../db/repositories/nullifierRepo.js';
import { sendUserOperation, waitForUserOperation } from './bundlerClient.js';
import { toUserOperation, type RelayRequest } from './userOpBuilder.js';

// ─── Redis Connection ─────────────────────────────────────────────────────────

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// ─── Queue Definition ─────────────────────────────────────────────────────────

export const RELAY_QUEUE_NAME = 'ghost:relay';

export const relayQueue = new Queue<RelayJobData>(RELAY_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2_000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// ─── Job Types ────────────────────────────────────────────────────────────────

export interface RelayJobData {
  operationId: string;
  relayRequest: RelayRequest;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function createRelayWorker(): Worker<RelayJobData> {
  const worker = new Worker<RelayJobData>(
    RELAY_QUEUE_NAME,
    async (job: Job<RelayJobData>) => {
      const { operationId, relayRequest } = job.data;
      const { userOp, publicSignals } = relayRequest;
      const nullifierHash = publicSignals[1]!;

      logger.info({ operationId, jobId: job.id }, 'Processing relay job');

      // Mark as processing
      await operationRepo.updateStatus(operationId, 'PROCESSING');

      // Convert to permissionless UserOperation type
      const operation = toUserOperation(userOp);

      // Send to bundler
      let userOpHash: `0x${string}`;
      try {
        userOpHash = await sendUserOperation(operation);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await operationRepo.markFailed(operationId, `Bundler rejected: ${msg}`);
        await nullifierRepo.markReverted(nullifierHash);
        throw err; // BullMQ will retry
      }

      // Mark as submitted
      await operationRepo.updateStatus(operationId, 'SUBMITTED', { userOpHash });

      // Wait for confirmation
      let receipt: Awaited<ReturnType<typeof waitForUserOperation>>;
      try {
        receipt = await waitForUserOperation(userOpHash);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await operationRepo.markFailed(operationId, `Tx failed: ${msg}`);
        await nullifierRepo.markReverted(nullifierHash);
        throw err;
      }

      // Mark as completed
      await operationRepo.markCompleted(
        operationId,
        receipt.receipt.transactionHash,
        receipt.receipt.blockNumber,
        receipt.receipt.gasUsed.toString(),
      );

      // Mark nullifier as definitively spent
      await nullifierRepo.markSpent(nullifierHash, receipt.receipt.transactionHash);

      logger.info(
        {
          operationId,
          txHash: receipt.receipt.transactionHash,
          blockNumber: receipt.receipt.blockNumber.toString(),
        },
        'Relay job completed successfully',
      );
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Relay job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Relay worker error');
  });

  return worker;
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueRelayJob(
  operationId: string,
  relayRequest: RelayRequest,
): Promise<string> {
  const job = await relayQueue.add(
    'relay',
    { operationId, relayRequest },
    { jobId: operationId },
  );
  return job.id!;
}

// ─── Queue Health ─────────────────────────────────────────────────────────────

export async function checkQueueHealth(): Promise<boolean> {
  try {
    const client = await redis.ping();
    return client === 'PONG';
  } catch {
    return false;
  }
}

// ─── Entry point when running worker standalone ───────────────────────────────

const isMain = import.meta.url === new URL(process.argv[1]!, import.meta.url).href;
if (isMain) {
  const worker = createRelayWorker();
  logger.info('Relay queue worker started');

  process.on('SIGTERM', async () => {
    logger.info('Worker shutting down…');
    await worker.close();
    await redis.quit();
    process.exit(0);
  });
}
