/**
 * Ghost Paymaster — Fastify Server Entry Point
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './db/prisma/client.js';
import { merkleTree } from './zk/merkleTree.js';
import { startOfacSyncJob, stopOfacSyncJob } from './compliance/ofac.js';
import { createRelayWorker, redis } from './relayer/queue.js';
import { checkBundlerHealth } from './relayer/bundlerClient.js';
import { checkContractHealth } from './relayer/paymasterClient.js';
import { checkQueueHealth } from './relayer/queue.js';

// ─── Route Imports ────────────────────────────────────────────────────────────
import relayRoutes from './api/routes/relay.js';
import poolRoutes from './api/routes/pool.js';
import proofRoutes from './api/routes/proof.js';
import scoreRoutes from './api/routes/score.js';

// ─── Build Server ─────────────────────────────────────────────────────────────

export async function buildServer() {
  const fastify = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // ── Body size limit ────────────────────────────────────────────────────────
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string', bodyLimit: 1024 * 1024 },
    fastify.getDefaultJsonParser('error', 'error'),
  );

  // ── Health check (unauthenticated) ─────────────────────────────────────────
  fastify.get('/v1/health', async (_req, reply) => {
    const [bundler, database, redisOk] = await Promise.all([
      checkBundlerHealth().catch(() => false),
      checkContractHealth().catch(() => false),
      checkQueueHealth().catch(() => false),
    ]);

    const allOk = bundler && database && redisOk;
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      bundler: bundler ? 'connected' : 'disconnected',
      contracts: database ? 'reachable' : 'unreachable',
      redis: redisOk ? 'connected' : 'disconnected',
    });
  });

  // ── API Routes ─────────────────────────────────────────────────────────────
  await fastify.register(relayRoutes, { prefix: '/v1' });
  await fastify.register(poolRoutes, { prefix: '/v1' });
  await fastify.register(proofRoutes, { prefix: '/v1' });
  await fastify.register(scoreRoutes, { prefix: '/v1' });

  // ── Global error handler ────────────────────────────────────────────────────
  fastify.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, 'Unhandled error');
    reply.status(error.statusCode ?? 500).send({
      error: 'INTERNAL_ERROR',
      message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found' });
  });

  return fastify;
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main() {
  logger.info('Starting Ghost Paymaster backend…');

  // Connect DB
  await connectDatabase();

  // Initialise Merkle tree (restores from DB if available)
  await merkleTree.init();

  // Start OFAC sync job
  startOfacSyncJob();

  // Start BullMQ worker (in-process for simplicity; can be separated)
  const worker = createRelayWorker();

  // Build and start Fastify
  const server = await buildServer();

  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`Ghost Paymaster API listening on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await server.close();
    await worker.close();
    stopOfacSyncJob();
    await disconnectDatabase();
    await redis.quit();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
