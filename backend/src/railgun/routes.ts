/**
 * railgunRoutes.ts — Fastify routes for Railgun shield/unshield/status
 *
 * Routes:
 *   POST /v1/railgun/shield    — shield ERC-20 into Railgun
 *   POST /v1/railgun/unshield  — unshield ERC-20 from Railgun + generate POI
 *   GET  /v1/railgun/status    — Railgun engine health
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { shieldERC20 } from './shield.js';
import { unshieldERC20 } from './unshield.js';
import { isEngineStarted } from './engine.js';
import { logger } from '../utils/logger.js';

// ── Request schemas ────────────────────────────────────────────────────────────

const ShieldBodySchema = z.object({
    amount: z.string().regex(/^\d+$/, 'amount must be a base-unit integer string'),
    tokenAddress: z.string().startsWith('0x').length(42),
    railgunAddress: z.string().startsWith('0zk'),
    fromAddress: z.string().startsWith('0x').length(42),
});

const UnshieldBodySchema = z.object({
    railgunWalletID: z.string().min(1),
    encryptionKey: z.string().min(1),
    amount: z.string().regex(/^\d+$/, 'amount must be a base-unit integer string'),
    tokenAddress: z.string().startsWith('0x').length(42),
    toAddress: z.string().startsWith('0x').length(42),
    originalFromAddress: z.string().startsWith('0x').length(42).optional(),
});

// ── Route registration ─────────────────────────────────────────────────────────

export async function railgunRoutes(server: FastifyInstance): Promise<void> {
    // ── Health / status ──────────────────────────────────────────────────────────
    server.get('/v1/railgun/status', async (_req, reply) => {
        return reply.send({
            ok: true,
            engineReady: isEngineStarted(),
            timestamp: new Date().toISOString(),
        });
    });

    // ── Shield ────────────────────────────────────────────────────────────────────
    server.post('/v1/railgun/shield', async (req, reply) => {
        const parse = ShieldBodySchema.safeParse(req.body);
        if (!parse.success) {
            return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
        }

        if (!isEngineStarted()) {
            return reply.status(503).send({ error: 'Railgun engine not ready — try again in a few seconds' });
        }

        try {
            const result = await shieldERC20(parse.data);
            return reply.send({ ok: true, ...result });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err, body: parse.data }, 'railgun: shield failed');
            return reply.status(500).send({ error: 'Shield failed', message });
        }
    });

    // ── Unshield ──────────────────────────────────────────────────────────────────
    server.post('/v1/railgun/unshield', async (req, reply) => {
        const parse = UnshieldBodySchema.safeParse(req.body);
        if (!parse.success) {
            return reply.status(400).send({ error: 'Invalid request', details: parse.error.format() });
        }

        if (!isEngineStarted()) {
            return reply.status(503).send({ error: 'Railgun engine not ready — try again in a few seconds' });
        }

        try {
            const result = await unshieldERC20(parse.data);
            return reply.send({ ok: true, ...result });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err, body: parse.data }, 'railgun: unshield failed');
            return reply.status(500).send({ error: 'Unshield failed', message });
        }
    });
}
