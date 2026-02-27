/**
 * Deposit Event Indexer
 *
 * Polls on-chain GhostPool `Deposit` events and mirrors them into the
 * backend database and the off-chain Merkle tree.
 *
 * This means users do NOT have to call POST /v1/pool/deposit manually —
 * the indexer picks up the on-chain event automatically within one poll cycle.
 *
 * Poll interval: configurable via INDEXER_POLL_INTERVAL_MS (default 15 s).
 */

import { parseAbiItem } from 'viem';
import { publicClient } from '../relayer/paymasterClient.js';
import { getContractAddresses } from '../contracts/addresses.js';
import { depositRepo } from '../db/repositories/depositRepo.js';
import { merkleTree } from '../zk/merkleTree.js';
import { logger } from '../utils/logger.js';

// ─── ABI item ────────────────────────────────────────────────────────────────

const DEPOSIT_EVENT = parseAbiItem(
  'event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, uint256 amount, address indexed token, uint256 timestamp)',
);

// ─── State ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = Number(process.env['INDEXER_POLL_INTERVAL_MS'] ?? 15_000);

/** How many blocks to look back on the first run (≈ 24 hours on BSC @ 3s/block). */
const INITIAL_LOOKBACK_BLOCKS = 28_800n;

let _lastProcessedBlock: bigint | null = null;
let _pollTimer: ReturnType<typeof setTimeout> | null = null;
let _running = false;

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Process a single on-chain Deposit log.
 * Inserts the commitment into the off-chain Merkle tree and DB if not seen before.
 */
async function processDepositLog(log: {
  args: { commitment?: `0x${string}`; leafIndex?: number; amount?: bigint; token?: `0x${string}`; timestamp?: bigint };
  transactionHash: `0x${string}` | null;
  blockNumber: bigint | null;
}): Promise<void> {
  const { commitment, amount, token } = log.args;
  if (!commitment || !amount || !token) return;

  const txHash = log.transactionHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Check if already indexed
  const existing = await depositRepo.findByCommitment(commitment);
  if (existing) return;

  // Insert into off-chain Merkle tree
  const commitment256 = BigInt(commitment);
  const { root: newRoot, leafIndex } = await merkleTree.insert(commitment256);
  const merkleRootHex = '0x' + newRoot.toString(16).padStart(64, '0');

  // Persist deposit record
  await depositRepo.create({
    commitment,
    leafIndex,
    merkleRoot: merkleRootHex,
    amount: amount.toString(),
    token,
    txHash,
    blockNumber: log.blockNumber ?? undefined,
  });

  logger.info(
    { commitment, leafIndex, merkleRoot: merkleRootHex, txHash },
    'Deposit indexed from on-chain event',
  );
}

/**
 * Fetch Deposit events from fromBlock to toBlock and process them.
 */
async function fetchAndProcessDeposits(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const { ghostPool } = getContractAddresses();

  const logs = await publicClient.getLogs({
    address: ghostPool,
    event: DEPOSIT_EVENT,
    fromBlock,
    toBlock,
  });

  if (logs.length > 0) {
    logger.debug(
      { count: logs.length, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
      'Processing Deposit events',
    );
  }

  for (const log of logs) {
    try {
      await processDepositLog(log as Parameters<typeof processDepositLog>[0]);
    } catch (err) {
      logger.error({ err, txHash: log.transactionHash }, 'Failed to process Deposit event');
    }
  }
}

/**
 * Single poll tick — fetch events since the last processed block.
 */
async function poll(): Promise<void> {
  try {
    const latestBlock = await publicClient.getBlockNumber();

    if (_lastProcessedBlock === null) {
      // First run: look back a fixed number of blocks to catch recent deposits.
      // If the chain is shorter than INITIAL_LOOKBACK_BLOCKS (e.g., a fresh local node),
      // start from block 0 (genesis) to ensure no events are missed.
      const fromBlock = latestBlock > INITIAL_LOOKBACK_BLOCKS
        ? latestBlock - INITIAL_LOOKBACK_BLOCKS
        : 0n;
      await fetchAndProcessDeposits(fromBlock, latestBlock);
    } else if (latestBlock > _lastProcessedBlock) {
      await fetchAndProcessDeposits(_lastProcessedBlock + 1n, latestBlock);
    }

    _lastProcessedBlock = latestBlock;
  } catch (err) {
    logger.warn({ err }, 'Deposit indexer poll failed — will retry');
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Start the deposit indexer.
 * Safe to call multiple times — only one instance runs at a time.
 */
export function startDepositIndexer(): void {
  if (_running) return;
  _running = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'Deposit indexer started');

  const tick = async () => {
    await poll();
    if (_running) {
      _pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  // Run immediately then schedule
  tick().catch((err) => logger.error({ err }, 'Deposit indexer tick error'));
}

/**
 * Stop the deposit indexer.
 */
export function stopDepositIndexer(): void {
  _running = false;
  if (_pollTimer !== null) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
  logger.info('Deposit indexer stopped');
}
