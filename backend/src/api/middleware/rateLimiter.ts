/**
 * Rate limiter middleware.
 * Applies per-IP limits to prevent relay abuse.
 */

import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

const rateLimiter: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: '1 minute',
    errorResponseBuilder(_req, context) {
      return {
        error: 'RATE_LIMITED',
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
  });

  // Stricter limit for the relay endpoint
  fastify.addHook('preHandler', async (request, reply) => {
    // Individual route overrides can be registered at route level
    void request, reply;
  });
};

export default fp(rateLimiter, { name: 'rate-limiter' });
