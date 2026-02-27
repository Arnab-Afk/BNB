import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

// Global singleton to avoid too many connections in development hot-reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (process.env['NODE_ENV'] === 'development') {
  globalThis.__prisma = prisma;
  (prisma.$on as Function)('error', (e: { message: string }) => {
    logger.error({ msg: 'Prisma error', err: e.message });
  });
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
