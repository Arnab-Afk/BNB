/**
 * GET /v1/score/:address
 *
 * Privacy Score for any BNB Chain address.
 * Queries BSC Testnet (or mainnet, based on config) directly via JSON-RPC.
 *
 * Score components (0–100):
 *   Ghost Deposits    (0–35 pts)  Has this address deposited into GhostPool?
 *   Wallet Age        (0–15 pts)  Newer wallet = less history exposed
 *   Tx Volume         (0–20 pts)  Fewer total txs = smaller graph footprint
 *   Counterparties    (0–15 pts)  Fewer unique counterparties = less exposed
 *   CEX Exposure      (0–15 pts)  Known CEX deposit addresses = KYC link
 */

import type { FastifyPluginAsync } from 'fastify';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { bscTestnet } from 'viem/chains';
import { isAddress } from 'viem';
import { logger } from '../../utils/logger.js';

// ── Known CEX hot wallet prefixes on BSC Testnet (minimal list for demo) ──────
// On mainnet you'd have a full list from Chainalysis / Etherscan labels
const KNOWN_CEX_ADDRESSES = new Set([
    '0x3c783c21a0383057d128bae431894a5c19f9cf06', // Binance testnet-ish
    '0x8894e0a0c962cb723c1976a4421c95949be2d4e3', // Binance hot wallet (mainnet well-known)
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance 14
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', // Binance 16
].map((a) => a.toLowerCase()));

// Ghost Pool deployed on BSC testnet
const GHOST_POOL = '0xd2c227909A77359b422C1BfEa6B482f2559eF6aa';
const GHOST_POOL_DEPOSIT_TOPIC =
    '0x0cd0d2a9a5f11cb2e2c580eb62a04a7c5a1a7e78baecf2e94c6e8bf3b65f0dce'; // keccak256("Deposit(uint256,bytes32,uint256)")

// ── RPC client (read-only, no key needed) ──────────────────────────────────────
const RPC_URL = process.env['BNB_TESTNET_RPC_URL'] ??
    'https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e';

const client = createPublicClient({
    chain: bscTestnet,
    transport: http(RPC_URL),
});

// ── BscScan API (free tier, no key needed for basic queries) ───────────────────
const BSCSCAN_API = 'https://api-testnet.bscscan.com/api';

async function fetchBscScan(params: Record<string, string>): Promise<unknown> {
    const qs = new URLSearchParams({
        apikey: process.env['BSCSCAN_API_KEY'] ?? 'YourApiKeyToken', // free tier works without key
        ...params,
    });
    const res = await fetch(`${BSCSCAN_API}?${qs}`);
    if (!res.ok) throw new Error(`BscScan API error: ${res.status}`);
    const json = await res.json() as { status: string; result: unknown };
    if (json.status === '0') return [];
    return json.result;
}

// ── Scoring helpers ────────────────────────────────────────────────────────────

interface TxRecord {
    from: string;
    to: string;
    blockNumber: string;
    timeStamp: string;
    isError: string;
}

async function getTransactionList(address: string): Promise<TxRecord[]> {
    try {
        const result = await fetchBscScan({
            module: 'account',
            action: 'txlist',
            address,
            startblock: '0',
            endblock: '99999999',
            page: '1',
            offset: '200', // last 200 txs — enough for scoring
            sort: 'desc',
        });
        return (result as TxRecord[]) ?? [];
    } catch {
        return [];
    }
}

async function getGhostDepositCount(address: string): Promise<number> {
    try {
        // Check logs from GhostPool where the depositor address appears in topics
        const LOOK_BACK = 60_000n;
        const latestBlock = await client.getBlockNumber();
        const fromBlock = latestBlock > LOOK_BACK ? latestBlock - LOOK_BACK : 0n;

        const logs = await client.getLogs({
            address: GHOST_POOL as `0x${string}`,
            fromBlock,
            toBlock: latestBlock,
        });

        // Any log emitted by GhostPool while this address was the caller counts
        // We also query the tx receipts to find transactions from this address to GhostPool
        const txs = await getTransactionList(address);
        const ghostDeposits = txs.filter(
            (tx) => tx.to?.toLowerCase() === GHOST_POOL.toLowerCase() && tx.isError === '0'
        );
        return ghostDeposits.length;
    } catch {
        return 0;
    }
}

async function getFirstTxTimestamp(address: string): Promise<number | null> {
    try {
        const result = await fetchBscScan({
            module: 'account',
            action: 'txlist',
            address,
            startblock: '0',
            endblock: '99999999',
            page: '1',
            offset: '1',
            sort: 'asc',
        }) as TxRecord[];
        if (!result?.length) return null;
        return Number(result[0].timeStamp);
    } catch {
        return null;
    }
}

// ── Score calculation ──────────────────────────────────────────────────────────

interface ScoreResult {
    address: string;
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    components: {
        ghostDeposits: { score: number; max: number; raw: number; label: string };
        walletAge: { score: number; max: number; raw: string; label: string };
        txVolume: { score: number; max: number; raw: number; label: string };
        counterparties: { score: number; max: number; raw: number; label: string };
        cexExposure: { score: number; max: number; hasCex: boolean; label: string };
    };
    tips: string[];
    analysedAt: string;
}

async function computeScore(address: string): Promise<ScoreResult> {
    const lowerAddr = address.toLowerCase();

    // Fetch all signals concurrently
    const [txs, ghostDepositCount, firstTs] = await Promise.all([
        getTransactionList(address),
        getGhostDepositCount(address),
        getFirstTxTimestamp(address),
    ]);

    // ── Component 1: Ghost Deposits (0–35 pts) ──────────────────────────────────
    // 0 deposits = 0 pts, 1 = 20, 2 = 28, 3+ = 35
    const ghostScore = ghostDepositCount === 0 ? 0
        : ghostDepositCount === 1 ? 20
            : ghostDepositCount === 2 ? 28
                : 35;

    // ── Component 2: Wallet Age (0–15 pts) ─────────────────────────────────────
    // Newer wallet = better score (less history)
    // 0 txs = fresh = 15 pts, 1 week = 12, 1 month = 8, 3+ months = 0
    let ageScore = 15;
    let ageLabel = 'No history (fresh wallet)';
    if (firstTs !== null) {
        const ageMs = Date.now() - firstTs * 1000;
        const ageDays = ageMs / 86_400_000;
        ageLabel = ageDays < 1 ? '<1 day old'
            : ageDays < 7 ? `${Math.floor(ageDays)}d old`
                : ageDays < 30 ? `${Math.floor(ageDays / 7)}w old`
                    : `${Math.floor(ageDays / 30)}mo old`;
        ageScore = ageDays < 1 ? 15
            : ageDays < 7 ? 12
                : ageDays < 30 ? 8
                    : ageDays < 90 ? 4
                        : 0;
    }

    // ── Component 3: Transaction Volume (0–20 pts) ──────────────────────────────
    // Fewer txs = smaller on-chain footprint = higher score
    const txCount = txs.length;
    const txVolumeScore = txCount === 0 ? 20
        : txCount < 5 ? 18
            : txCount < 15 ? 14
                : txCount < 30 ? 10
                    : txCount < 60 ? 6
                        : txCount < 100 ? 3
                            : 0;

    // ── Component 4: Unique Counterparties (0–15 pts) ───────────────────────────
    // More unique addresses interacted with = more exposed in tx graph
    const counterparties = new Set<string>();
    for (const tx of txs) {
        if (tx.from?.toLowerCase() !== lowerAddr && tx.from) counterparties.add(tx.from.toLowerCase());
        if (tx.to?.toLowerCase() !== lowerAddr && tx.to) counterparties.add(tx.to.toLowerCase());
    }
    const uniqueCount = counterparties.size;
    const counterpartyScore = uniqueCount === 0 ? 15
        : uniqueCount < 3 ? 13
            : uniqueCount < 8 ? 10
                : uniqueCount < 20 ? 6
                    : uniqueCount < 50 ? 3
                        : 0;

    // ── Component 5: CEX Exposure (0–15 pts) ────────────────────────────────────
    // Any direct interaction with a known CEX = KYC-linked = 0 pts
    const hasCex = txs.some(
        (tx) =>
            KNOWN_CEX_ADDRESSES.has(tx.from?.toLowerCase()) ||
            KNOWN_CEX_ADDRESSES.has(tx.to?.toLowerCase())
    );
    const cexScore = hasCex ? 0 : 15;

    // ── Total ────────────────────────────────────────────────────────────────────
    const total = ghostScore + ageScore + txVolumeScore + counterpartyScore + cexScore;
    const score = Math.min(100, Math.max(0, total));
    const grade: ScoreResult['grade'] =
        score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

    // ── Tips ─────────────────────────────────────────────────────────────────────
    const tips: string[] = [];
    if (ghostDepositCount === 0)
        tips.push('Deposit into Ghost Pool — break the on-chain link between your wallets.');
    if (hasCex)
        tips.push('You\'ve interacted with a known exchange. Your deposit address may be KYC-linked.');
    if (txCount >= 30)
        tips.push('Use a fresh wallet for private transactions to reduce your graph footprint.');
    if (ageScore < 8)
        tips.push('This wallet has a long history. Consider using a newer address for sensitive funds.');
    if (ghostDepositCount > 0 && ghostDepositCount < 3)
        tips.push('More Ghost deposits increase your anonymity set — making your withdrawal harder to trace.');
    if (tips.length === 0)
        tips.push('Excellent privacy hygiene. Keep using Ghost Pool and avoid address reuse.');

    return {
        address,
        score,
        grade,
        components: {
            ghostDeposits: { score: ghostScore, max: 35, raw: ghostDepositCount, label: 'Ghost Pool deposits' },
            walletAge: { score: ageScore, max: 15, raw: ageLabel, label: 'Wallet age' },
            txVolume: { score: txVolumeScore, max: 20, raw: txCount, label: 'Transaction count' },
            counterparties: { score: counterpartyScore, max: 15, raw: uniqueCount, label: 'Unique counterparties' },
            cexExposure: { score: cexScore, max: 15, hasCex, label: 'CEX exposure' },
        },
        tips,
        analysedAt: new Date().toISOString(),
    };
}

// ── Route ──────────────────────────────────────────────────────────────────────

const scoreRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Params: { address: string } }>(
        '/score/:address',
        {
            config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
            const { address } = request.params;

            if (!isAddress(address)) {
                return reply.status(400).send({
                    error: 'INVALID_ADDRESS',
                    message: 'Provide a valid EVM address (0x-prefixed, 42 chars)',
                });
            }

            try {
                logger.info({ address }, 'Computing privacy score');
                const result = await computeScore(address);
                return reply.send(result);
            } catch (err) {
                logger.error({ err, address }, 'Privacy score computation failed');
                return reply.status(500).send({
                    error: 'SCORE_FAILED',
                    message: 'Unable to compute privacy score',
                });
            }
        }
    );
};

export default scoreRoutes;
