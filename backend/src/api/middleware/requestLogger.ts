/**
 * Request logger middleware.
 * Logs every incoming request with method, URL, status, and duration.
 */

import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../../utils/logger.js';

const requestLogger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    request.log.info({ method: request.method, url: request.url }, '--> request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime.toFixed(2) + 'ms',
      },
      '<-- response',
    );
  });
};

export default fp(requestLogger, { name: 'request-logger' });
