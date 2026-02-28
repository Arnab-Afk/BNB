/**
 * engine.ts — Railgun Engine initialisation for Ghost Privacy Suite
 *
 * startRailgunEngine signature (from source):
 *   (walletSource, db, shouldDebug, artifactStore, useNativeArtifacts, skipMerkletreeScans?, poiNodeURLs?, customPOILists?, verboseScanLogging?)
 *
 * ArtifactStore class (from source):
 *   new ArtifactStore(get, store, exists)
 *   get: (path: string) => Promise<string | Buffer | null>
 *   store: (dir: string, path: string, item: string | Uint8Array) => Promise<void>
 *   exists: (path: string) => Promise<boolean>
 */

import {
    startRailgunEngine,
    setLoggers,
    ArtifactStore,
} from '@railgun-community/wallet';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

// ── Constants ─────────────────────────────────────────────────────────────────

// BSC Testnet is not in the Railgun SDK's NetworkName enum on older builds.
// Use BNBChain for both mainnet and testnet (the RPC URL handles the actual network).
export const RAILGUN_NETWORK: NetworkName = NetworkName.BNBChain;

export const TXID_VERSION = TXIDVersion.V2_PoseidonMerkle;

// Railgun proving key cache directory
const ARTIFACT_DIR = path.resolve('src/zk/railgun-artifacts');

// ── Artifact Store ────────────────────────────────────────────────────────────

function buildArtifactStore(): ArtifactStore {
    return new ArtifactStore(
        // get(path): string | Buffer | null
        async (filePath: string) => {
            const full = path.join(ARTIFACT_DIR, filePath);
            if (!fs.existsSync(full)) return null;
            return fs.readFileSync(full);
        },
        // store(dir, path, item): void
        async (dir: string, filePath: string, item: string | Uint8Array) => {
            const full = path.join(ARTIFACT_DIR, dir, filePath);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, item instanceof Uint8Array ? Buffer.from(item) : item);
        },
        // exists(path): boolean
        async (filePath: string) => {
            return fs.existsSync(path.join(ARTIFACT_DIR, filePath));
        },
    );
}

// ── Engine init ───────────────────────────────────────────────────────────────

let _engineStarted = false;

export async function initRailgunEngine(): Promise<void> {
    if (_engineStarted) return;

    setLoggers(
        (msg: string) => logger.debug({ module: 'railgun' }, msg),
        (err: string) => logger.error({ module: 'railgun' }, err),
    );

    const artifactStore = buildArtifactStore();

    // startRailgunEngine(walletSource, db, shouldDebug, artifactStore, useNativeArtifacts)
    await startRailgunEngine(
        'GhostPrivacySuite',
        undefined as never,    // db — undefined uses in-memory Loki DB
        false,                  // shouldDebug
        artifactStore,
        false,                  // useNativeArtifacts (wasm fallback)
        false,                  // skipMerkletreeScans
    );

    _engineStarted = true;
    logger.info({ network: RAILGUN_NETWORK }, 'Railgun engine started');
}

export function isEngineStarted(): boolean {
    return _engineStarted;
}
