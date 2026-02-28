# 👻 Ghost Privacy Suite — End-to-End Implementation Plan

> **Project:** Ghost — Compliant, full-stack privacy infrastructure for BNB Chain
> **Tracks:** BNB Chain × YZI Labs Hack Bengaluru — Track 4.1 (Gas Relayer) · 4.2 (Privacy SDK) · 4.3 (Railgun)
> **Status:** ✅ Core implementation complete — contracts deployed, backend wired, Railgun integrated, frontend live

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Status Summary](#2-component-status-summary)
3. [What Is Done](#3-what-is-done)
4. [What Is Remaining](#4-what-is-remaining)
5. [Detailed Implementation Plan](#5-detailed-implementation-plan)
   - [Phase 1 — ZK Circuits](#phase-1--zk-circuits-foundation)
   - [Phase 2 — Smart Contracts](#phase-2--smart-contracts)
   - [Phase 3 — Backend (Relayer)](#phase-3--backend-relayer)
   - [Phase 4 — SDK](#phase-4--sdk-ghostprivacysdk)
   - [Phase 5 — Frontend DApp](#phase-5--frontend-dapp)
   - [Phase 6 — Chrome Extension](#phase-6--chrome-extension)
   - [Phase 7 — Infrastructure & DevOps](#phase-7--infrastructure--devops)
   - [Phase 8 — Testing & Audit](#phase-8--testing--audit)
6. [File-by-File Gap Analysis](#6-file-by-file-gap-analysis)
7. [Integration Diagram](#7-integration-diagram)
8. [Dependency Order](#8-dependency-order)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      ENTRY POINTS                        │
│  web/ (landing)  │  frontend/ (DApp)  │  Chrome Ext.    │
│  @ghost-privacy/sdk (npm)                                │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                GHOST BACKEND  (backend/)                  │
│  Fastify REST API  │  BullMQ Worker  │  OFAC Sync Job    │
│  snarkjs verifier  │  Pimlico client │  Contract indexer │
│  Waku Broadcaster  │  Venus yield    │  Prisma (Postgres) │
└─────────────┬────────────────────┬──────────────────┬────┘
              │                    │                  │
┌─────────────▼────────────────────▼──────────────────▼────┐
│                      BNB CHAIN                           │
│  GhostPool.sol          GhostPaymaster.sol               │
│  AssociationSetProvider.sol  Groth16Verifier.sol         │
│  RailgunAdapter.sol     GhostNameService.sol             │
│  PoseidonHasher.sol                                      │
└──────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│               ZK CIRCUITS  (circuits/)                   │
│  merkle_proof.circom  →  .wasm + .zkey + vk.json         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Component Status Summary

| Component | Status | Completion |
|-----------|--------|------------|
| `GhostPool.sol` | ✅ Deployed (BSC Testnet) | 100% |
| `GhostPaymaster.sol` | ✅ Deployed (BSC Testnet) | 100% |
| `PoseidonHasher.sol` | ✅ Deployed (BSC Testnet) | 100% |
| `Groth16Verifier.sol` | ✅ Deployed (BSC Testnet) | 100% |
| `AssociationSetProvider.sol` | ✅ Deployed (BSC Testnet) | 100% |
| `GhostNameService.sol` | ✅ Deployed (BSC Testnet) | 100% |
| Contract deploy scripts | ✅ `deploy.ts` + `deploy-new-contracts.ts` | 100% |
| Contract tests | ❌ Not started | 0% |
| `RailgunAdapter.sol` | ❌ Not started | 0% |
| Backend API routes (relay + pool) | ✅ Complete | 100% |
| Backend compliance (OFAC + ASP) | ✅ Complete | 100% |
| Backend ZK verifier (off-chain) | ✅ Complete | 100% |
| Backend Merkle tree manager | ✅ Complete | 100% |
| Backend BullMQ relay worker | ✅ Complete (permissionless removed) | 100% |
| Backend bundler client | ✅ Rewritten — direct JSON-RPC (no permissionless) | 100% |
| Backend Prisma schema + repos | ✅ Complete — all 5 models, field names aligned | 100% |
| Backend middleware & config | ✅ Complete | 100% |
| Backend `src/index.ts` | ✅ Fully wired (Railgun, indexer, queue, routes) | 100% |
| **Backend Railgun module** | ✅ **Complete — engine, shield, unshield, routes** | 100% |
| Backend deposit indexer | ✅ `depositIndexer.ts` — event-based + historical sync | 100% |
| Backend Venus yield module | ❌ Not started | 0% |
| Backend tests | ❌ Not started | 0% |
| ZK circuits (`merkle_proof.circom`) | ✅ Compiled, trusted setup done, WASM in browser | 100% |
| `@ghost-privacy/sdk` rewrites | ✅ GhostWallet, ProofBuilder, GhostClient, UserOpBuilder | 100% |
| Frontend DApp (views) | ✅ All views wired; RailgunView calls real backend | 95% |
| `web/` marketing landing page | ✅ Complete | 100% |
| Chrome Extension | ❌ Not started | 0% |
| Docker Compose | ✅ Created | 100% |
| GitHub Actions CI/CD | ❌ Not started | 0% |

---

## 3. What Is Done

### 3.1 Smart Contracts (`contracts/`)

#### `GhostPool.sol` ✅
- Incremental Poseidon Merkle tree (depth configurable, default 20 → ~1M leaves)
- Ring-buffer of 30 historical roots to handle race conditions
- Multi-token deposits: USDC + USDT (extensible via `setTokenAllowed`)
- Minimum deposit: 1 USDC (1,000,000 with 6 decimals)
- `deposit(commitment, amount, token)` — accepts stablecoin, inserts leaf, emits event
- `deductFee(nullifierHash, amount, token)` — called by GhostPaymaster post-relay
- `isKnownRoot()`, `getLastRoot()`, `isCommitmentInserted()`, `nextLeafIndex()`, `poolBalance()`
- Admin: `setPaymaster()`, `setTokenAllowed()`, `emergencyWithdraw()`

#### `GhostPaymaster.sol` ✅
- Inherits ERC-4337 `BasePaymaster` (EntryPoint v0.6)
- `_validatePaymasterUserOp()`:
  - Decodes `paymasterAndData` layout (validUntil / validAfter / feeToken / ZKProof)
  - Timing checks (proof expiry, future validity)
  - On-chain Groth16 proof verification via `IGroth16Verifier`
  - Merkle root validation via `GhostPool.isKnownRoot()`
  - Nullifier double-spend prevention
  - Recipient binding (proof bound to `userOp.sender`)
- `_postOp()`: marks nullifier spent, converts BNB gas cost → USDC fee, calls `GhostPool.deductFee()`
- Toggle: `zkVerificationEnabled` for MVP testing with MockVerifier
- Admin: `depositToEntryPoint()`, `setRate()`, `setZkVerificationEnabled()`, `blacklistNullifier()`

#### `PoseidonHasher.sol` ✅
- Thin wrapper around the Poseidon T3 circuit
- `poseidon(left, right)` → matches on-chain and off-chain (circomlibjs) hashing

#### Interfaces & Mocks ✅
- `IGhostPool.sol`, `IGroth16Verifier.sol`, `IPoseidonHasher.sol`
- `MockERC20.sol`, `MockGroth16Verifier.sol`, `MockPoseidonHasher.sol`

---

### 3.2 Backend (`backend/`)

#### API Routes
- `POST /v1/relay` — accepts UserOp + ZK proof, validates everything, enqueues BullMQ job, returns `jobId`
- `GET  /v1/relay/status/:jobId` — polls relay job status (QUEUED/PROCESSING/SUBMITTED/COMPLETED/FAILED)
- `POST /v1/pool/deposit` — registers an on-chain deposit commitment, inserts into off-chain Merkle tree
- `GET  /v1/pool/status` — returns totalDeposits, anonymitySet size, current Merkle root
- `GET  /v1/pool/merkle-proof?leaf=0x...` — returns sibling path + indices for ZK proof generation

#### Compliance Module
- `ofac.ts` — downloads OFAC SDN XML, extracts ETH/BNB addresses, upserts to `BlockedAddress` table, 1-hour refresh cycle
- `blocklist.ts` — unified blocklist API (OFAC + Chainalysis + manual), CRUD helpers
- `asp.ts` — ASP compliance check: local blocklist → optional Chainalysis API → allow/deny with reason

#### ZK Module
- `verifier.ts` — off-chain snarkjs Groth16 verification (fast pre-screen before bundler submission), `parsePublicSignals()`, `validateProofShape()`
- `merkleTree.ts` — `MerkleTreeManager` class: incremental Poseidon Merkle tree mirroring on-chain state, DB-persisted (`MerkleTreeState` table), `insert()`, `getMerkleProof()`, `getCurrentRoot()`

#### Relayer Module
- `userOpBuilder.ts` — Zod schemas for UserOp and ZK proof, `toUserOperation()`, `validatePaymasterAddress()`, `validateChainId()`
- `bundlerClient.ts` — Pimlico/permissionless client, `sendUserOperation()`, `waitForUserOperation()`, `estimateUserOperationGas()`
- `paymasterClient.ts` — on-chain read client for GhostPool: `isKnownRoot()`, `getOnChainRoot()`, `getPoolBalance()`, health check
- `queue.ts` — BullMQ `RELAY_QUEUE_NAME`, worker (3 retries, exponential backoff), `enqueueRelayJob()`, job status flow

#### Database
- Prisma schema: `Deposit`, `Nullifier`, `RelayOperation`, `BlockedAddress`, `MerkleTreeState`
- `depositRepo.ts` — create, findByCommitment, findByTxHash, listByToken, countTotal, findAllOrdered
- `nullifierRepo.ts` — create, isSpent, markPending, markSpent, markReverted
- `operationRepo.ts` — create, findById, updateStatus, markFailed, markCompleted

#### Config & Utilities
- `config.ts` — Zod-validated environment schema (PORT, DATABASE_URL, REDIS_URL, BNB_RPC_URL, RELAYER_PRIVATE_KEY, contract addresses, ZK paths, compliance keys, etc.)
- `logger.ts` — Pino structured logger
- `address.ts` — EVM address validation and checksum helpers
- `bn.ts` — BigNumber formatting utilities
- Middleware: `rateLimiter.ts`, `requestLogger.ts`

---

### 3.3 Frontend (`web/`)

- Marketing/landing page with brutalist design, updated typography (Manrope & Press Start 2P fonts), and text-based logos
- Header with nav links, Connect button, and updated icon labels
- Hero section ("Privacy Limitless for BNB Chain") with integrated `FlickeringGrid` background
- Three-feature grid (Gas Relayer / Privacy SDK / Private Transactions)
- "How It Works" and "Compliance" sections
- Footer with social links

---

## 4. What Is Remaining

### 4.1 Smart Contracts — Missing Files

| File | Purpose |
|------|---------|
| `contracts/AssociationSetProvider.sol` | 0xbow-style ASP: maintains a Merkle root of "clean set" commitments. Only OFAC-clean deposits enter the set. Relayer calls `verifyASPMembership()` before sponsoring gas. |
| `contracts/Groth16Verifier.sol` | Auto-generated by snarkjs. Placeholder needed for compilation; final version comes from `snarkjs zkey export solidityverifier`. |
| `contracts/RailgunAdapter.sol` | Bridge between GhostPool stablecoin balance and Railgun's UTXO shielded pool. Handles `shield()` (move USDC from GhostPool → Railgun) and the Paymaster sponsoring Railgun gas. |
| `contracts/GhostNameService.sol` | On-chain `ghost://username` registry: register a name, resolve name → address, reverse-resolve address → name. |
| `scripts/deploy.ts` | Hardhat deploy script: deploys all contracts in correct order, sets cross-references (Paymaster address in Pool, etc.), logs addresses. |
| `scripts/verify-contracts.ts` | Etherscan/BscScan verification script using `hardhat-verify`. |
| `test/GhostPool.ts` | Unit + integration tests for all GhostPool functionality |
| `test/GhostPaymaster.ts` | Unit + integration tests for all GhostPaymaster functionality |
| `test/AssociationSetProvider.ts` | Unit tests for ASP |

### 4.2 Backend — Missing Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main Fastify server entrypoint: register plugins (CORS, rate-limit, swagger), mount routes, start OFAC sync job, initialise Merkle tree, start HTTP server, graceful shutdown |
| `src/railgun/broadcaster.ts` | Waku P2P broadcaster: submit Railgun transactions via the Waku network (alternative to direct on-chain submission for privacy) |
| `src/railgun/poi.ts` | Proof of Innocence: generate ZK proof that a Railgun UTXO's history never touched OFAC-flagged inputs |
| `src/railgun/routes.ts` | `POST /v1/railgun/shield`, `POST /v1/railgun/unshield`, `POST /v1/railgun/transfer` API routes |
| `src/yield/venus.ts` | Venus Protocol integration: deposit idle GhostPool USDC into Venus vUSDC to earn yield; redeem when fee deductions require liquidity |
| `src/indexer/depositIndexer.ts` | On-chain event listener: watches `GhostPool.Deposit` events, inserts new commitments into the DB Merkle tree automatically (so users don't need to call `POST /v1/pool/deposit` manually) |
| `scripts/sync-ofac.ts` | Standalone CLI script for manual OFAC sync (already referenced in `package.json`) |
| `test/` | Unit tests (compliance, ZK verifier, Merkle tree) and integration tests (relay flow, pool routes) |

### 4.3 ZK Circuits — Entire Directory Missing

| File | Purpose |
|------|---------|
| `circuits/merkle_proof.circom` | Core Poseidon Merkle membership circuit. Inputs: `secret`, `nullifier`, `pathElements[20]`, `pathIndices[20]`. Public outputs: `merkleRoot`, `nullifierHash`, `recipient`. Groth16 compatible. |
| `circuits/build/` | Compiled `.r1cs`, `.wasm`, `.sym` artifacts (generated via `circom`) |
| `circuits/keys/` | `circuit_final.zkey` (trusted setup), `verification_key.json` (exported for snarkjs + Solidity) |
| `circuits/README.md` | Circuit compilation + trusted setup instructions |

### 4.4 SDK (`@ghost-privacy/sdk`) — Entire Package Missing

| File | Purpose |
|------|---------|
| `sdk/src/GhostWallet.ts` | Spending key (BabyJubJub) + viewing key derivation, Note serialization/deserialization |
| `sdk/src/ProofBuilder.ts` | In-browser WASM Groth16 proving via snarkjs; loads `.wasm` + `.zkey`; progress callback for UI progress bar |
| `sdk/src/UserOpBuilder.ts` | Constructs ERC-4337 `UserOperation` with `paymasterAndData` containing the ZK proof (matches `GhostPaymaster._decodePaymasterData()` layout) |
| `sdk/src/GhostClient.ts` | High-level API: `deposit()`, `relay()`, `getPoolStatus()`, `getMerkleProof()` |
| `sdk/src/react/PrivacyProvider.tsx` | React context provider: wraps any DApp and injects Ghost Mode toggle. Detects wallet, sets up `GhostWallet`, routes txs through Ghost when enabled |
| `sdk/src/react/useGhostWallet.ts` | React hook: exposes `ghostWallet`, `deposit()`, `relay()`, `privacyScore`, `ghostMode` state |
| `sdk/src/types.ts` | Shared TypeScript types: `Note`, `GhostWalletConfig`, `RelayResult`, `DepositResult` |
| `sdk/package.json` | SDK package config: dual CJS/ESM build, peer deps (`react`, `viem`), npm publish config |
| `sdk/tsup.config.ts` | Build config using tsup for dual CJS/ESM output |

### 4.5 Frontend DApp (`frontend/`) — Functional Pages Missing

The `frontend/app/page.tsx` is currently a Next.js default placeholder. All functional pages need to be built:

| Page / Component | Purpose |
|-----------------|---------|
| `app/deposit/page.tsx` | Deposit flow: connect wallet → select denomination → compute `commitment = Poseidon(secret, nullifier)` → approve USDC → call `GhostPool.deposit()` → download Note file |
| `app/relay/page.tsx` | Use flow: paste Note → generate ZK proof in-browser (with WASM progress bar) → sign UserOp → submit to Ghost backend → poll status |
| `app/railgun/page.tsx` | Railgun tab: shield USDC (Ghost pays gas), private transfer/swap, unshield + Proof of Innocence |
| `app/dashboard/page.tsx` | Privacy Score (0–100 meter), wallet exposure analysis, shareable score card |
| `app/names/page.tsx` | Ghost Name Service: register `ghost://username`, lookup, transfer ownership |
| `app/compliance/page.tsx` | Compliance Report: enter viewing key → generate PDF showing full tx history for auditors |
| `components/WalletProvider.tsx` | wagmi + viem wallet connection, chain switching to BSC |
| `components/ProofProgress.tsx` | WASM proof generation progress bar with time estimate |
| `components/NoteBackup.tsx` | Note download prompt (encrypted JSON), clear warning about irrecoverability |
| `components/PrivacyScore.tsx` | 0–100 radial gauge, shareable link, breakdown tooltip |

### 4.6 Chrome Extension — Entire Directory Missing

| File | Purpose |
|------|---------|
| `extension/manifest.json` | Manifest V3: permissions (`storage`, `tabs`, `activeTab`), content script declaration, background service worker |
| `extension/popup/index.html` | Extension popup shell |
| `extension/popup/Popup.tsx` | Ghost Mode toggle, Privacy Score badge, "Shielded this session: N txs" counter |
| `extension/content/interceptor.ts` | Injects into every page; overrides `window.ethereum.request` to intercept `eth_sendTransaction`; wraps the raw tx as a UserOp and routes through Ghost Paymaster when Ghost Mode is ON |
| `extension/background/serviceWorker.ts` | Manages Ghost Mode state in `chrome.storage.local`, handles messages from content script |
| `extension/build/` | Webpack/Vite output (gitignored) |

### 4.7 Infrastructure — Missing

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Spins up: Postgres, Redis, Ghost Backend, Ghost Worker |
| `.env.example` (backend already has one) | Document all required environment variables |
| `.github/workflows/ci.yml` | On PR: lint + compile contracts + run Hardhat tests + run backend unit tests |
| `.github/workflows/deploy.yml` | On merge to `main`: build Docker images, push to registry, deploy to BNB testnet |
| `contracts/scripts/deploy.ts` | Full deployment script (all contracts in order) |

---

## 5. Detailed Implementation Plan

### Phase 1 — ZK Circuits (Foundation)

> **Why first:** Everything else depends on the proving/verifying key artifacts.

**Tasks:**

1. **Write `circuits/merkle_proof.circom`**
   - Template inputs: `secret` (private), `nullifier` (private), `pathElements[levels]` (private), `pathIndices[levels]` (private), `recipient` (public)
   - Template outputs: `merkleRoot` (public), `nullifierHash` (public)
   - Use `circomlib` Poseidon T3 component
   - Depth: 20 levels (matches `GhostPool.sol` default)

2. **Compile and trusted setup:**
   ```bash
   cd circuits
   circom merkle_proof.circom --r1cs --wasm --sym -o build/
   snarkjs powersoftau new bn128 12 pot12_0000.ptau
   snarkjs powersoftau contribute pot12_0000.ptau pot12_final.ptau
   snarkjs groth16 setup build/merkle_proof.r1cs pot12_final.ptau keys/circuit_0000.zkey
   snarkjs zkey contribute keys/circuit_0000.zkey keys/circuit_final.zkey
   snarkjs zkey export verificationkey keys/circuit_final.zkey keys/verification_key.json
   snarkjs zkey export solidityverifier keys/circuit_final.zkey ../contracts/contracts/Groth16Verifier.sol
   ```

3. **Copy artifacts to backend:**
   ```bash
   cp circuits/build/merkle_proof_js/merkle_proof.wasm backend/src/zk/circuits/
   cp circuits/keys/circuit_final.zkey backend/src/zk/circuits/merkle_proof_final.zkey
   cp circuits/keys/verification_key.json backend/src/zk/circuits/
   ```

4. **Copy `Groth16Verifier.sol`** to `contracts/contracts/` (auto-generated by snarkjs above)

**Outputs:** `.wasm`, `.zkey`, `verification_key.json`, `Groth16Verifier.sol`

---

### Phase 2 — Smart Contracts

> **Dependencies:** Phase 1 (Groth16Verifier.sol)

**Tasks:**

1. **`contracts/contracts/Groth16Verifier.sol`**
   - Auto-generated from snarkjs (Phase 1)
   - Implements `IGroth16Verifier.verifyProof(pA, pB, pC, pubSignals)`

2. **`contracts/contracts/AssociationSetProvider.sol`**
   - Stores a Merkle root of the "clean set" — commitments that passed OFAC screening
   - `updateRoot(bytes32 newRoot)` — callable by owner (Ghost backend after each OFAC sync)
   - `verifyMembership(bytes32[] calldata proof, bytes32 leaf)` — verify clean-set membership
   - `currentRoot()` — returns current clean-set root
   - Event: `RootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot)`

3. **`contracts/contracts/RailgunAdapter.sol`**
   - `shieldToRailgun(address token, uint256 amount, bytes calldata railgunNote)` — moves tokens from GhostPool → Railgun shielded pool
   - `requestGasSponsorship(address railgunContract, bytes calldata txData)` — asks GhostPaymaster to sponsor Railgun tx gas
   - Links back to GhostPool to pull tokens and to GhostPaymaster for gas sponsorship
   - Event: `Shielded(address indexed token, uint256 amount)`

4. **`contracts/contracts/GhostNameService.sol`**
   - `register(string calldata name)` — register `ghost://name` → `msg.sender` (one name per address)
   - `resolve(string calldata name)` → `address`
   - `reverseLookup(address)` → `string name`
   - `transfer(string calldata name, address newOwner)`
   - Annual registration fee in USDC (optional for MVP)
   - Events: `Registered`, `Transferred`

5. **`contracts/scripts/deploy.ts`**
   - Deploy order:
     1. `MockPoseidonHasher` (testnet) or production Poseidon T3 (mainnet)
     2. `MockERC20` (testnet USDC + USDT) or real token addresses
     3. `GhostPool`
     4. `MockGroth16Verifier` (testnet) or `Groth16Verifier` (production)
     5. `AssociationSetProvider`
     6. `GhostPaymaster`
     7. `RailgunAdapter`
     8. `GhostNameService`
     9. Wire: `GhostPool.setPaymaster(GhostPaymaster.address)`
     10. Log all addresses to `deployments/<network>.json`

6. **`contracts/test/GhostPool.ts`**
   - Deposit happy path, duplicate commitment, wrong token, tree-full scenario
   - `isKnownRoot()` ring buffer wraparound
   - `deductFee()` caller restriction, balance accounting
   - Merkle root consistency (TypeScript off-chain vs. on-chain)

7. **`contracts/test/GhostPaymaster.ts`**
   - `validatePaymasterUserOp`: happy path, expired proof, spent nullifier, wrong recipient, invalid root
   - `_postOp`: fee deduction, nullifier marking
   - Rate update, ZK toggle

---

### Phase 3 — Backend (Relayer)

> **Dependencies:** Phase 1 (circuit artifacts), Phase 2 (contract ABIs + addresses)

**Tasks:**

1. **`backend/src/index.ts`** — Main Fastify server
   ```typescript
   // Register plugins: @fastify/cors, @fastify/rate-limit, @fastify/swagger
   // Mount routes: relayRoutes, poolRoutes, railgunRoutes, healthRoutes
   // On startup: merkleTree.init(), startOfacSyncJob(), startContractIndexer()
   // Graceful shutdown: SIGTERM handler
   ```

2. **`backend/src/api/routes/health.ts`**
   - `GET /health` — returns `{ status: 'ok', db, redis, bundler, contracts }`

3. **`backend/src/indexer/depositIndexer.ts`** — Contract event listener
   - Uses `viem.watchContractEvent` on `GhostPool.Deposit`
   - On each event: insert commitment into `depositRepo` + `merkleTree.insert()`
   - Handles restarts: reads `nextLeafIndex` from DB on init, catches up missed events

4. **`backend/src/railgun/broadcaster.ts`** — Waku P2P broadcaster
   - Integrates with `@railgun-community/wallet` or Waku REST API
   - `broadcastRailgunTx(tx)` — encodes and broadcasts via Waku topic
   - Returns `txHash` once included on-chain

5. **`backend/src/railgun/poi.ts`** — Proof of Innocence
   - Integrates with Railgun SDK's POI generation
   - `generatePOI(utxo, merkleProof)` → ZK proof bytes
   - Validates that the UTXO's full tx graph never touched flagged inputs

6. **`backend/src/railgun/routes.ts`** — Railgun API routes
   - `POST /v1/railgun/shield` — shield USDC: debit from GhostPool → call `RailgunAdapter.shieldToRailgun()`
   - `POST /v1/railgun/unshield` — unshield + POI + optional compliance export
   - `POST /v1/railgun/transfer` — private Railgun transfer via Waku

7. **`backend/src/yield/venus.ts`** — Venus Protocol yield
   - `depositToVenus(token, amount)` — converts idle USDC to vUSDC
   - `redeemFromVenus(token, amount)` — redeems vUSDC back to USDC
   - Called from deposit handler (after GhostPool.deposit) and fee deduction handler
   - Uses Venus vToken ABI + BNB Chain addresses

8. **`backend/scripts/sync-ofac.ts`** — Standalone OFAC sync
   - CLI wrapper around `syncOfacList()`
   - Used for manual runs and CI jobs

9. **Backend Tests**
   - `test/unit/compliance.test.ts` — OFAC parsing, ASP logic
   - `test/unit/merkleTree.test.ts` — insert, getMerkleProof, root consistency with circuit
   - `test/unit/verifier.test.ts` — proof shape validation, valid/invalid snarkjs verify
   - `test/integration/relay.test.ts` — full relay flow with mock contracts
   - `test/integration/pool.test.ts` — deposit registration, merkle proof endpoint

---

### Phase 4 — SDK (`@ghost-privacy/sdk`)

> **Dependencies:** Phase 1 (WASM + zkey artifacts), Phase 2 (contract ABIs)

**Tasks:**

1. **`sdk/src/GhostWallet.ts`**
   - BabyJubJub key generation (using `@zk-kit/baby-jubjub`)
   - `spendingKey`, `viewingKey` derivation from mnemonic or random seed
   - `generateNote(amount, token)` → `Note { secret, nullifier, commitment }`
   - `exportViewingKey()` → hex string for compliance sharing
   - Note serialization: `encodeNote(note)` → Base64 string (portable, shareable)
   - Note deserialization: `decodeNote(encoded)` → `Note`

2. **`sdk/src/ProofBuilder.ts`**
   - Loads circuit WASM + zkey via URL (CDN-hosted or inline)
   - `generate(note, merkleProof, recipient)` → `{ proof, publicSignals }`
   - Uses `snarkjs.groth16.fullProve()` in a Web Worker to avoid blocking UI
   - Emits progress events: `{ percent: number, message: string }`

3. **`sdk/src/UserOpBuilder.ts`**
   - Encodes `paymasterAndData` matching `GhostPaymaster._decodePaymasterData()` layout:
     `[validUntil:32][validAfter:32][feeToken:32][abi.encode(ZKProof)]`
   - `buildUserOp(callData, proof, publicSignals, feeToken, options)` → `UserOperation`
   - Uses permissionless SDK for EntryPoint interactions

4. **`sdk/src/GhostClient.ts`**
   - `deposit(amount, token, wallet)` → sends tx to GhostPool, returns Note
   - `relay(wallet, userOp)` → submits to Ghost backend `/v1/relay`, polls status
   - `getPoolStatus()` → calls `/v1/pool/status`
   - `getMerkleProof(commitment)` → calls `/v1/pool/merkle-proof`

5. **`sdk/src/react/PrivacyProvider.tsx`**
   - React context providing `GhostWallet` instance, Ghost Mode state, deposit/relay actions
   - Renders Ghost Mode toggle button overlay on wrapped DApp
   - Props: `chainId`, `rpcUrl`, `backendUrl`, `children`

6. **`sdk/src/react/useGhostWallet.ts`**
   - `const { ghostWallet, ghostMode, setGhostMode, deposit, relay, privacyScore } = useGhostWallet()`
   - `privacyScore`: computes 0–100 score from on-chain tx history of connected wallet

7. **`sdk/package.json` + `sdk/tsup.config.ts`**
   - Dual build: ESM + CJS
   - Peer deps: `react`, `viem`, `@wagmi/core`
   - Exports: `@ghost-privacy/sdk`, `@ghost-privacy/sdk/react`

---

### Phase 5 — Frontend DApp (`frontend/`)

> **Dependencies:** Phase 4 (SDK), Phase 3 (backend running)

**Tasks:**

1. **Wallet connection setup (`components/WalletProvider.tsx`)**
   - wagmi + viem, BSC + BSC Testnet chains
   - MetaMask, WalletConnect, Coinbase Wallet connectors

2. **Deposit page (`app/deposit/page.tsx`)**
   - Step 1: Select token (USDC / USDT) and denomination (1 / 10 / 100 / 1000)
   - Step 2: `commitment = Poseidon(secret, nullifier)` generated client-side via WASM
   - Step 3: ERC-20 approval flow
   - Step 4: `GhostPool.deposit()` transaction
   - Step 5: Download Note (encrypted JSON backup with scary warning)
   - Step 6: OFAC check indicator

3. **Relay (Use) page (`app/relay/page.tsx`)**
   - Step 1: Paste Note (or import from file)
   - Step 2: Enter recipient address and calldata
   - Step 3: ZK proof generation (WASM in Web Worker + progress bar)
   - Step 4: Build and sign UserOp
   - Step 5: Submit to `/v1/relay` → poll status
   - Step 6: Show tx hash + block explorer link

4. **Railgun page (`app/railgun/page.tsx`)**
   - Tab: Shield (USDC → Railgun, Ghost pays gas)
   - Tab: Private Swap (inside Railgun)
   - Tab: Unshield (Railgun → destination) with Proof of Innocence generation
   - Tab: Transfer (private address-to-address)

5. **Dashboard (`app/dashboard/page.tsx`)**
   - Privacy Score (0–100 radial gauge)
   - Score breakdown: anonymity set size, deposit age, transaction graph exposure
   - Shareable score card (OG image generation)
   - Transaction history (filtered by viewing key)

6. **Ghost Name Service (`app/names/page.tsx`)**
   - Search `ghost://name`
   - Register name (USDC fee)
   - Manage owned names

7. **Compliance Report (`app/compliance/page.tsx`)**
   - Enter viewing key
   - Fetch all transactions for that key
   - Generate + download PDF compliance report

---

### Phase 6 — Chrome Extension

> **Dependencies:** Phase 4 (SDK), Phase 5 (Ghost backend running)

**Tasks:**

1. **`extension/manifest.json`**
   - Manifest V3
   - Content script: `"matches": ["<all_urls>"]`, `"run_at": "document_start"`
   - Permissions: `storage`, `tabs`

2. **`extension/background/serviceWorker.ts`**
   - State management in `chrome.storage.local`: `ghostModeEnabled`, `sessionStats`
   - Message handler for content script ↔ popup communication

3. **`extension/content/interceptor.ts`**
   - Overrides `window.ethereum.request` at `document_start` (before page scripts load)
   - When Ghost Mode ON and method is `eth_sendTransaction`:
     - Intercepts the raw tx
     - Calls background worker to fetch a Note + generate proof + build UserOp
     - Submits via Ghost backend
     - Returns the UserOp hash as the tx hash (transparent to DApp)
   - When Ghost Mode OFF: passthrough to original `window.ethereum.request`

4. **`extension/popup/Popup.tsx`**
   - Ghost Mode toggle switch
   - Privacy Score badge (live, from backend)
   - "Shielded this session: N txs" counter
   - Link to open full DApp

---

### Phase 7 — Infrastructure & DevOps

**Tasks:**

1. **`docker-compose.yml`**
   ```yaml
   services:
     postgres:   # PostgreSQL 16
     redis:      # Redis 7
     backend:    # Ghost API server (port 3001)
     worker:     # BullMQ relay worker
   ```

2. **`.github/workflows/ci.yml`**
   - On PR:
     - `contracts`: `hardhat compile` + `hardhat test`
     - `backend`: `tsc --noEmit` + `vitest run`
     - `frontend`: `next build` (lint check)

3. **`.github/workflows/deploy.yml`**
   - On push to `main`:
     - Build + push Docker images
     - Deploy contracts to BNB Testnet (dry-run or actual)

4. **`.env.example` (all packages)**
   - Document every required and optional env variable with inline comments

5. **OpenAPI / Swagger docs**
   - Register `@fastify/swagger` in `src/index.ts`
   - Auto-generates from route schemas
   - Served at `/docs`

---

### Phase 8 — Testing & Audit

**Tasks:**

1. **Contract fuzzing** — Foundry fuzz tests on GhostPool edge cases (tree-full, ring-buffer wraparound)
2. **ZK soundness test** — verify that a fake proof correctly fails on-chain
3. **End-to-end test** — full flow: deposit → generate proof → relay → confirm on testnet
4. **Load test** — 100 concurrent relay requests to check BullMQ + rate-limiting behaviour
5. **Security audit** — focus areas: reentrancy in `deductFee()`, nullifier race condition, proof malleability
6. **Gas benchmarking** — `REPORT_GAS=true hardhat test`

---

## 6. File-by-File Gap Analysis

```
BNB/
├── contracts/
│   ├── contracts/
│   │   ├── GhostPool.sol              ✅ Complete
│   │   ├── GhostPaymaster.sol         ✅ Complete
│   │   ├── PoseidonHasher.sol         ✅ Complete
│   │   ├── Groth16Verifier.sol        ❌ Missing (auto-gen from snarkjs)
│   │   ├── AssociationSetProvider.sol ❌ Missing
│   │   ├── RailgunAdapter.sol         ❌ Missing
│   │   ├── GhostNameService.sol       ❌ Missing
│   │   ├── interfaces/
│   │   │   ├── IGhostPool.sol         ✅ Complete
│   │   │   ├── IGroth16Verifier.sol   ✅ Complete
│   │   │   └── IPoseidonHasher.sol    ✅ Complete
│   │   └── mocks/
│   │       ├── MockERC20.sol          ✅ Complete
│   │       ├── MockGroth16Verifier.sol✅ Complete
│   │       └── MockPoseidonHasher.sol ✅ Complete
│   ├── scripts/
│   │   ├── deploy.ts                  ❌ Missing
│   │   └── verify-contracts.ts        ❌ Missing
│   ├── test/
│   │   ├── GhostPool.ts               ❌ Missing
│   │   ├── GhostPaymaster.ts          ❌ Missing
│   │   └── AssociationSetProvider.ts  ❌ Missing
│   ├── hardhat.config.ts              ✅ Complete
│   └── package.json                   ✅ Complete
│
├── circuits/                          ❌ Entire directory missing
│   ├── merkle_proof.circom
│   ├── build/                        (generated)
│   └── keys/                         (generated)
│
├── backend/
│   ├── src/
│   │   ├── index.ts                   ❌ Missing
│   │   ├── config.ts                  ✅ Complete
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── relay.ts           ✅ Complete
│   │   │   │   ├── pool.ts            ✅ Complete
│   │   │   │   ├── railgun.ts         ❌ Missing
│   │   │   │   └── health.ts          ❌ Missing
│   │   │   └── middleware/
│   │   │       ├── rateLimiter.ts     ✅ Complete
│   │   │       └── requestLogger.ts   ✅ Complete
│   │   ├── compliance/
│   │   │   ├── ofac.ts                ✅ Complete
│   │   │   ├── asp.ts                 ✅ Complete
│   │   │   └── blocklist.ts           ✅ Complete
│   │   ├── db/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma      ✅ Complete
│   │   │   │   └── client.ts          ✅ Complete
│   │   │   └── repositories/
│   │   │       ├── depositRepo.ts     ✅ Complete
│   │   │       ├── nullifierRepo.ts   ✅ Complete
│   │   │       └── operationRepo.ts   ✅ Complete
│   │   ├── relayer/
│   │   │   ├── userOpBuilder.ts       ✅ Complete
│   │   │   ├── bundlerClient.ts       ✅ Complete
│   │   │   ├── paymasterClient.ts     ✅ Complete
│   │   │   └── queue.ts               ✅ Complete
│   │   ├── railgun/
│   │   │   ├── broadcaster.ts         ❌ Missing
│   │   │   ├── poi.ts                 ❌ Missing
│   │   │   └── routes.ts              ❌ Missing
│   │   ├── yield/
│   │   │   └── venus.ts               ❌ Missing
│   │   ├── indexer/
│   │   │   └── depositIndexer.ts      ❌ Missing
│   │   ├── zk/
│   │   │   ├── verifier.ts            ✅ Complete
│   │   │   ├── merkleTree.ts          ✅ Complete
│   │   │   └── circuits/              ❌ Missing (artifact files from Phase 1)
│   │   └── utils/
│   │       ├── address.ts             ✅ Complete
│   │       ├── bn.ts                  ✅ Complete
│   │       └── logger.ts              ✅ Complete
│   ├── scripts/
│   │   └── sync-ofac.ts               ❌ Missing
│   ├── test/
│   │   ├── unit/                      ❌ Missing
│   │   └── integration/               ❌ Missing
│   ├── .env.example                   ✅ Complete
│   └── package.json                   ✅ Complete
│
├── sdk/                               ❌ Entire directory missing
│   ├── src/
│   │   ├── GhostWallet.ts
│   │   ├── ProofBuilder.ts
│   │   ├── UserOpBuilder.ts
│   │   ├── GhostClient.ts
│   │   ├── types.ts
│   │   └── react/
│   │       ├── PrivacyProvider.tsx
│   │       └── useGhostWallet.ts
│   ├── package.json
│   └── tsup.config.ts
│
├── frontend/                          ⚠️  Placeholder only (Next.js default)
│   ├── app/
│   │   ├── page.tsx                   ⚠️  Placeholder
│   │   ├── deposit/page.tsx           ❌ Missing
│   │   ├── relay/page.tsx             ❌ Missing
│   │   ├── railgun/page.tsx           ❌ Missing
│   │   ├── dashboard/page.tsx         ❌ Missing
│   │   ├── names/page.tsx             ❌ Missing
│   │   └── compliance/page.tsx        ❌ Missing
│   └── components/                    ❌ Missing
│
├── web/                               ✅ Marketing landing page complete
│
├── extension/                         ❌ Entire directory missing
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   └── background/
│
├── docker-compose.yml                 ❌ Missing
├── IMPLEMENTATION_PLAN.md             ✅ This file
└── README.md                          ✅ Complete
```

---

## 7. Integration Diagram

```
DEPOSIT FLOW
────────────
User (KYC wallet)
  │ computeCommitment() via SDK
  │ approve USDC
  ▼
GhostPool.deposit(commitment, amount, USDC)
  │ inserts leaf → Merkle root updated
  │ emits Deposit event
  ▼
backend/indexer picks up event → insertIntoMerkleTree() → DB
  │
  ▼
User gets Note { secret, nullifier, commitment }

RELAY FLOW
──────────
Fresh wallet (0 BNB)
  │ pasteNote()
  │ ProofBuilder.generate(note, merkleProof, recipient)  ← WASM in browser
  │   → proof, publicSignals = [merkleRoot, nullifierHash, recipient]
  │ UserOpBuilder.buildUserOp(callData, proof)
  │   → paymasterAndData = [GhostPaymaster][validUntil][validAfter][feeToken][ZKProof]
  ▼
POST /v1/relay { userOp, zkProof, publicSignals, chainId }
  │ validateChainId, validatePaymasterAddress
  │ nullifierRepo.isSpent()
  │ isKnownRoot() (on-chain check)
  │ verifyProof() (snarkjs off-chain)
  │ aspCheckBatch() (OFAC + Chainalysis)
  │ operationRepo.create(), nullifierRepo.markPending()
  ▼
BullMQ queue → worker
  │ bundlerClient.sendUserOperation()
  │ waitForUserOperation()
  │ operationRepo.markCompleted()
  │ nullifierRepo.markSpent()
  ▼
EntryPoint (ERC-4337) calls GhostPaymaster
  │ validatePaymasterUserOp(): verifyProof (on-chain), isKnownRoot, nullifier check
  │ executes UserOp
  │ _postOp(): marks nullifier, deductFee() from GhostPool
  ▼
Fresh wallet tx confirmed 👻 (zero BNB spent, zero link to depositor)
```

---

## 8. Dependency Order

Build these in order to avoid blockers:

```
Phase 1: ZK Circuits
        ↓
Phase 2: Smart Contracts (needs Groth16Verifier from Phase 1)
        ↓
Phase 3: Backend (needs circuit artifacts + contract ABIs)
        ↓
Phase 4: SDK (needs circuit WASM + backend + contract ABIs)
        ↓
Phase 5: Frontend DApp (needs SDK + backend running)
        ↓
Phase 6: Chrome Extension (needs SDK + backend running)
        ↓
Phase 7: Infrastructure (wraps everything)
        ↓
Phase 8: Testing & Audit
```

**Parallel tracks (can be done simultaneously after Phase 1):**
- Phase 2 (contracts) + Phase 3 backend skeleton can proceed in parallel
- `web/` (marketing) is complete — no blockers
- Docker Compose and CI can be written at any phase

---

*Last updated: February 2026*  
*Ghost Privacy Suite — BNB Chain × YZI Labs Hack Bengaluru*
