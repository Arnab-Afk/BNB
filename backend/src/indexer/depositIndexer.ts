/**
 * depositIndexer.ts — Watch GhostPool.Deposit events and sync the off-chain Merkle tree
 *
 * The frontend currently calls POST /v1/pool/deposit manually after each on-chain deposit.
 * This indexer listens to on-chain events continuously and auto-inserts them, so the
 * backend Merkle tree always stays in sync without any manual calls.
 *
 * Usage (standalone process):
 *   node --loader ts-node/esm src/indexer/depositIndexer.ts
 *
 * Or import and call startDepositIndexer() from index.ts for in-process indexing.
 */

import { createPublicClient, http, parseAbiItem, type Log } from 'viem';
import { bscTestnet } from 'viem/chains';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { depositRepo } from '../db/repositories/depositRepo.js';
import { merkleTree } from '../zk/merkleTree.js';

// ── ABI for log decoding ──────────────────────────────────────────────────────

const DEPOSIT_EVENT = parseAbiItem(
    'event Deposit(uint256 indexed leafIndex, bytes32 commitment, address token, uint256 amount)',
);

// ── State ─────────────────────────────────────────────────────────────────────

let _stopFlag = false;
let _watcherActive = false;

// ── Client ────────────────────────────────────────────────────────────────────

function getViemClient() {
    return createPublicClient({
        chain: config.CHAIN_ID === 97 ? bscTestnet : bscTestnet, // extend for mainnet
        transport: http(config.BNB_TESTNET_RPC_URL ?? config.BNB_RPC_URL),
    });
}

// ── Sync historical deposits on startup ───────────────────────────────────────

/**
 * Replay all historical Deposit events from the GhostPool contract and insert
 * any that are not already in the database.
 * Called once at server startup to catch up on missed events.
 */
export async function syncHistoricalDeposits(): Promise<void> {
    const client = getViemClient();
    const poolAddr = config.GHOST_POOL_ADDRESS as `0x${string}`;

    logger.info('depositIndexer: syncing historical deposits…');

    // Get current block
    const latestBlock = await client.getBlockNumber();

    // Start from block 0 or from a configured start block
    // For BSC Testnet: contract deployed around block 47,000,000
    const FROM_BLOCK = 0n;
    const CHUNK_SIZE = 5_000n;

    let synced = 0;

    for (let from = FROM_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
        const to = from + CHUNK_SIZE - 1n < latestBlock ? from + CHUNK_SIZE - 1n : latestBlock;

        const logs = await client.getLogs({
            address: poolAddr,
            event: DEPOSIT_EVENT,
            fromBlock: from,
            toBlock: to,
        });

        for (const log of logs) {
            await processDepositLog(log);
            synced++;
        }
    }

    logger.info({ count: synced }, 'depositIndexer: historical sync complete');
}

// ── Real-time watcher ─────────────────────────────────────────────────────────

/**
 * Watch for new Deposit events in real time using eth_getLogs polling.
 * Runs indefinitely until stop() is called.
 */
export async function startDepositIndexer(): Promise<void> {
    if (_watcherActive) {
        logger.warn('depositIndexer: already running');
        return;
    }
    _watcherActive = true;
    _stopFlag = false;

    const client = getViemClient();
    const poolAddr = config.GHOST_POOL_ADDRESS as `0x${string}`;

    logger.info('depositIndexer: starting real-time watcher');

    let lastProcessedBlock = await client.getBlockNumber();

    while (!_stopFlag) {
        try {
            const latest = await client.getBlockNumber();

            if (latest > lastProcessedBlock) {
                const logs = await client.getLogs({
                    address: poolAddr,
                    event: DEPOSIT_EVENT,
                    fromBlock: lastProcessedBlock + 1n,
                    toBlock: latest,
                });

                for (const log of logs) {
                    await processDepositLog(log);
                }

                lastProcessedBlock = latest;
            }
        } catch (err) {
            logger.error({ err }, 'depositIndexer: error polling events');
        }

        // Poll every 3 seconds (BSC block time)
        await new Promise((resolve) => setTimeout(resolve, 3_000));
    }

    _watcherActive = false;
    logger.info('depositIndexer: stopped');
}

export function stopDepositIndexer(): void {
    _stopFlag = true;
}

// ── Event processor ───────────────────────────────────────────────────────────

async function processDepositLog(log: Log<bigint, number, false, typeof DEPOSIT_EVENT>): Promise<void> {
    const { leafIndex, commitment, token, amount } = log.args as {
        leafIndex: bigint;
        commitment: `0x${string}`;
        token: `0x${string}`;
        amount: bigint;
    };

    const commitmentHex = commitment as string;

    // Idempotent check — skip if already indexed
    const existing = await depositRepo.findByCommitment(commitmentHex);
    if (existing) {
        return;
    }

    // Insert into Merkle tree
    const commitmentBig = BigInt(commitmentHex);
    const { root: newRoot, leafIndex: insertedIndex } = await merkleTree.insert(commitmentBig);
    const merkleRootHex = '0x' + newRoot.toString(16).padStart(64, '0');

    // Sanity check — indexer leaf index should match on-chain
    if (insertedIndex !== Number(leafIndex)) {
        logger.warn(
            { onChain: leafIndex.toString(), local: insertedIndex },
            'depositIndexer: leaf index mismatch — tree may be out of sync',
        );
    }

    // Persist
    await depositRepo.create({
        commitment: commitmentHex,
        leafIndex: Number(leafIndex),
        merkleRoot: merkleRootHex,
        amount: amount.toString(),
        token,
        txHash: log.transactionHash ?? '0x',
    });

    logger.info(
        { leafIndex: leafIndex.toString(), commitment: commitmentHex, merkleRoot: merkleRootHex },
        'depositIndexer: deposit indexed',
    );
}

// ── Standalone entry point ────────────────────────────────────────────────────

const isMain = import.meta.url === new URL(process.argv[1]!, import.meta.url).href;
if (isMain) {
    import('../db/prisma/client.js').then(async ({ connectDatabase }) => {
        await connectDatabase();
        await merkleTree.init();
        await syncHistoricalDeposits();
        await startDepositIndexer();
    });
}
