/**
 * Incremental Poseidon Merkle Tree manager.
 *
 * Mirrors the on-chain GhostPool Merkle tree exactly so the backend can:
 *  1. Answer merkle-proof queries for ZK proof generation.
 *  2. Track the current root without querying the chain every time.
 *
 * The tree uses Poseidon hashing (via circomlibjs) — the same hash function
 * used in the Solidity PoseidonHasher.sol contract.
 *
 * Zero value: keccak256("ghostpool") & (2^252 - 1)
 */

import { createHash } from 'crypto';
import { buildPoseidon } from 'circomlibjs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prisma/client.js';

export type Bytes32 = bigint;

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_MASK = (1n << 252n) - 1n;
const ZERO_LEAF_PREIMAGE = 'ghostpool';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MerkleProof {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  leaf: bigint;
  leafIndex: number;
}

// ─── Poseidon Singleton ───────────────────────────────────────────────────────

type PoseidonFn = (inputs: bigint[]) => Uint8Array;

let _poseidon: PoseidonFn | null = null;

async function getPoseidon(): Promise<PoseidonFn> {
  if (!_poseidon) {
    _poseidon = await buildPoseidon() as PoseidonFn;
    logger.info('Poseidon hasher initialised');
  }
  return _poseidon;
}

function poseidonHash(fn: PoseidonFn, left: bigint, right: bigint): bigint {
  const res = fn([left, right]);
  const hex = Buffer.from(res).toString('hex');
  return BigInt('0x' + hex);
}

// ─── Zero Hash Precomputation ─────────────────────────────────────────────────

function computeZeroLeaf(): bigint {
  const hash = createHash('sha256').update(ZERO_LEAF_PREIMAGE).digest();
  return BigInt('0x' + hash.toString('hex')) & FIELD_MASK;
}

async function computeZeros(fn: PoseidonFn, height: number): Promise<bigint[]> {
  const zeros: bigint[] = new Array(height);
  zeros[0] = computeZeroLeaf();
  for (let i = 1; i < height; i++) {
    zeros[i] = poseidonHash(fn, zeros[i - 1]!, zeros[i - 1]!);
  }
  return zeros;
}

// ─── MerkleTreeManager ────────────────────────────────────────────────────────

export class MerkleTreeManager {
  private readonly height: number;
  private zeros!: bigint[];
  private filledSubtrees!: bigint[];
  private leaves: bigint[] = [];
  private roots: bigint[] = [];
  private nextIndex = 0;
  private poseidon!: PoseidonFn;
  private initialised = false;

  constructor(height: number = config.MERKLE_TREE_HEIGHT) {
    this.height = height;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialised) return;

    this.poseidon = await getPoseidon();
    this.zeros = await computeZeros(this.poseidon, this.height);
    this.filledSubtrees = [...this.zeros];

    // Try to restore state from DB
    const state = await prisma.merkleTreeState.findUnique({ where: { id: 'singleton' } });
    if (state) {
      this.nextIndex = state.nextIndex;
      this.filledSubtrees = Object.values(state.filledSubtrees as Record<string, string>)
        .map((v) => BigInt(v));
      this.roots.push(BigInt(state.currentRoot));
      logger.info({ nextIndex: this.nextIndex }, 'Merkle tree state restored from DB');
    } else {
      // Set initial root (tree full of zeros)
      const initialRoot = this._computeInitialRoot();
      this.roots.push(initialRoot);
      await this._persistState();
    }

    this.initialised = true;
    logger.info({ height: this.height, nextIndex: this.nextIndex }, 'MerkleTreeManager ready');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Insert a leaf and return the new root and leaf index. */
  async insert(leaf: bigint): Promise<{ root: bigint; leafIndex: number }> {
    this._assertInitialised();
    const maxLeaves = 2 ** this.height;
    if (this.nextIndex >= maxLeaves) {
      throw new Error('Merkle tree is full');
    }

    const leafIndex = this.nextIndex;
    this.leaves[leafIndex] = leaf;

    let currentIndex = leafIndex;
    let currentHash = leaf;

    for (let i = 0; i < this.height; i++) {
      let left: bigint;
      let right: bigint;

      if (currentIndex % 2 === 0) {
        left = currentHash;
        right = this.zeros[i]!;
        this.filledSubtrees[i] = currentHash;
      } else {
        left = this.filledSubtrees[i]!;
        right = currentHash;
      }
      currentHash = poseidonHash(this.poseidon, left, right);
      currentIndex = Math.floor(currentIndex / 2);
    }

    const newRoot = currentHash;
    this.roots.push(newRoot);
    this.nextIndex++;

    await this._persistState();

    return { root: newRoot, leafIndex };
  }

  /** Generate a Merkle proof for a given leaf index. */
  getMerkleProof(leafIndex: number): MerkleProof {
    this._assertInitialised();
    if (leafIndex >= this.nextIndex) {
      throw new Error(`Leaf at index ${leafIndex} not yet inserted`);
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    let currentIndex = leafIndex;
    for (let i = 0; i < this.height; i++) {
      const isRight = currentIndex % 2 === 1;
      pathIndices.push(isRight ? 1 : 0);

      if (isRight) {
        // Sibling is to the left — it was saved in filledSubtrees if it exists, else zero
        const siblingIndex = currentIndex - 1;
        pathElements.push(this.leaves[siblingIndex] ?? this.zeros[i]!);
      } else {
        // Sibling is to the right
        const siblingIndex = currentIndex + 1;
        pathElements.push(this.leaves[siblingIndex] ?? this.zeros[i]!);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root: this.getCurrentRoot(),
      pathElements,
      pathIndices,
      leaf: this.leaves[leafIndex]!,
      leafIndex,
    };
  }

  getCurrentRoot(): bigint {
    return this.roots[this.roots.length - 1]!;
  }

  getNextIndex(): number {
    return this.nextIndex;
  }

  isKnownRoot(root: bigint): boolean {
    return this.roots.includes(root);
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async _persistState(): Promise<void> {
    const filledSubtreesMap: Record<string, string> = {};
    for (let i = 0; i < this.height; i++) {
      filledSubtreesMap[i.toString()] = this.filledSubtrees[i]!.toString();
    }

    await prisma.merkleTreeState.upsert({
      where: { id: 'singleton' },
      update: {
        nextIndex: this.nextIndex,
        currentRoot: this.getCurrentRoot().toString(),
        filledSubtrees: filledSubtreesMap,
        treeHeight: this.height,
      },
      create: {
        id: 'singleton',
        nextIndex: this.nextIndex,
        currentRoot: this.getCurrentRoot().toString(),
        filledSubtrees: filledSubtreesMap,
        treeHeight: this.height,
      },
    });
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private _computeInitialRoot(): bigint {
    let root = this.zeros[0]!;
    for (let i = 1; i < this.height; i++) {
      root = poseidonHash(this.poseidon, root, root);
    }
    return root;
  }

  private _assertInitialised(): void {
    if (!this.initialised) {
      throw new Error('MerkleTreeManager not initialised — call init() first');
    }
  }
}

// Global singleton
export const merkleTree = new MerkleTreeManager(config.MERKLE_TREE_HEIGHT);
