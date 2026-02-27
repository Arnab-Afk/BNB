# 👻 Ghost Paymaster — Backend

> **Privacy-Preserving Gas Relayer for BNB Chain**
> Built for **BNB Chain X YZI Labs Hack Bengaluru · Track 4 — Privacy Solutions (4.1 · 4.2 · 4.3)**

The Ghost Paymaster backend is the off-chain infrastructure that powers the privacy relay network. It acts as the **Broadcaster** — picking up signed UserOperations from anonymous wallets, verifying their attached Zero-Knowledge proofs, and submitting them to the BNB Chain bundler — all without ever linking the user's KYC'd source wallet to their private wallet.

---

## 📑 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How Privacy Is Achieved](#how-privacy-is-achieved)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Environment Variables](#environment-variables)
7. [Installation](#installation)
8. [Running the Relayer](#running-the-relayer)
9. [API Reference](#api-reference)
10. [ZK Proof Flow](#zk-proof-flow)
11. [ERC-4337 UserOperation Flow](#erc-4337-useroperation-flow)
12. [Compliance (Oxbow / ASP Model)](#compliance-oxbow--asp-model)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Security Considerations](#security-considerations)
16. [Roadmap](#roadmap)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER SIDE (Browser/CLI)                      │
│                                                                     │
│  1. User deposits USDC/USDT into the Privacy Pool (shielded)        │
│  2. User generates a ZK-Proof locally (Circom WASM circuit)         │
│  3. User signs a UserOperation (ERC-4337) with paymasterAndData     │
│     containing the ZK-proof                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  Signed UserOperation + ZK-Proof
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GHOST PAYMASTER RELAYER (This Repo)              │
│                                                                     │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────────┐  │
│  │  REST API /  │    │  ZK-Proof     │    │  Compliance Module   │  │
│  │  WebSocket   │───▶│  Verifier     │───▶│  (ASP / Oxbow Check) │  │
│  │  Listener    │    │  (snarkjs)    │    │  OFAC Blocklist      │  │
│  └──────────────┘    └───────────────┘    └──────────────────────┘  │
│                                │                                    │
│                                ▼                                    │
│                    ┌───────────────────────┐                        │
│                    │  Bundler Client       │                        │
│                    │  (Pimlico / Alchemy)  │                        │
│                    │  eth_sendUserOp       │                        │
│                    └──────────┬────────────┘                        │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BNB CHAIN (On-Chain)                           │
│                                                                     │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐  │
│  │  EntryPoint Contract │────▶│  GhostPaymaster Contract         │  │
│  │  (ERC-4337 Standard) │     │  - validatePaymasterUserOp()     │  │
│  └──────────────────────┘     │  - Verifies ZK-Proof on-chain    │  │
│                               │  - Pays BNB Gas                  │  │
│                               │  - Deducts from Privacy Pool     │  │
│                               └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How Privacy Is Achieved

### The Doxxing Problem
When a user sends BNB from a KYC'd exchange (Binance / Coinbase) to a fresh wallet, those two addresses are **permanently linked on-chain**. Anyone can trace:

```
KYC'd Exchange Account  ──[transfer]──▶  "Private" Wallet
```

### The Ghost Paymaster Solution

| Step | Traditional | Ghost Paymaster |
|------|-------------|-----------------|
| Fund new wallet gas | Send from KYC'd wallet → **link created** | Paymaster pays gas → **no link** |
| Pay for service | Direct on-chain debit → **traceable** | ZK-proof deducted from shielded pool → **untraceable** |
| Relayer identity | User submits from own wallet | Bundler submits; "From" = Relayer address |

**The Chain of Privacy:**
1. User deposits stable tokens (`USDC`/`USDT`) into the **Ghost Privacy Pool** from *any* wallet.
2. They receive a cryptographic **commitment** (not tied to their address).
3. Later, from a *fresh anonymous wallet*, they generate a ZK-proof against that commitment.
4. The Relayer/Paymaster verifies the proof and pays gas — **zero on-chain link** between old and new wallet.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript 5 |
| Web Framework | Fastify 4 |
| Blockchain Client | `viem` + `ethers.js v6` |
| ERC-4337 AA | `permissionless` (Pimlico SDK) |
| ZK Proof Verification | `snarkjs` (Groth16) |
| ZK Circuits | Circom 2.0 (in `/circuits`) |
| Queue | BullMQ + Redis |
| Database | PostgreSQL (via Prisma ORM) |
| Compliance | OFAC SDN API + custom ASP blocklist |
| Testing | Vitest + Hardhat fork |
| Linting | ESLint + Prettier |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                  # Fastify server entry point
│   ├── config.ts                 # Env config & validation (zod)
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── relay.ts          # POST /v1/relay — submit UserOperation
│   │   │   ├── pool.ts           # POST /v1/pool/deposit, GET /v1/pool/status
│   │   │   └── proof.ts          # POST /v1/proof/verify (debug only)
│   │   └── middleware/
│   │       ├── rateLimiter.ts    # Prevent abuse
│   │       └── requestLogger.ts
│   │
│   ├── relayer/
│   │   ├── bundlerClient.ts      # Sends UserOps to Pimlico bundler
│   │   ├── userOpBuilder.ts      # Constructs & validates UserOperation objects
│   │   ├── paymasterClient.ts    # Communicates with on-chain GhostPaymaster
│   │   └── queue.ts              # BullMQ worker — processes relay jobs
│   │
│   ├── zk/
│   │   ├── verifier.ts           # snarkjs Groth16 proof verification (off-chain)
│   │   ├── merkleTree.ts         # In-memory+DB incremental Merkle tree manager
│   │   └── circuits/             # Compiled circuit artifacts (.wasm, .zkey)
│   │       ├── merkle_proof.wasm
│   │       └── merkle_proof_final.zkey
│   │
│   ├── compliance/
│   │   ├── asp.ts                # Association Set Provider logic
│   │   ├── ofac.ts               # OFAC SDN list sync & check
│   │   └── blocklist.ts          # Combined blocklist management
│   │
│   ├── db/
│   │   ├── prisma/
│   │   │   └── schema.prisma     # DB schema for pool deposits, nullifiers, ops
│   │   └── repositories/
│   │       ├── depositRepo.ts
│   │       ├── nullifierRepo.ts  # Prevents double-spend of ZK commitments
│   │       └── operationRepo.ts
│   │
│   └── utils/
│       ├── logger.ts             # Pino structured logger
│       ├── bn.ts                 # BigNumber helpers
│       └── address.ts            # EVM address utilities
│
├── circuits/                     # Circom source files
│   ├── merkle_proof.circom       # Main privacy proof circuit
│   ├── poseidon.circom           # Poseidon hash gadget
│   └── build/                    # snarkjs compilation output
│
├── scripts/
│   ├── deploy-paymaster.ts       # Deploy GhostPaymaster to BNB Testnet
│   ├── fund-entrypoint.ts        # Deposit BNB into EntryPoint for paymaster
│   ├── compile-circuits.sh       # Circom → WASM + zkey compilation
│   └── sync-ofac.ts              # Sync OFAC SDN list to DB
│
├── test/
│   ├── unit/
│   │   ├── zk.verifier.test.ts
│   │   ├── merkleTree.test.ts
│   │   └── compliance.test.ts
│   └── integration/
│       ├── relay.flow.test.ts    # Full relay flow on Hardhat fork
│       └── pool.flow.test.ts
│
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md                     # ← You are here
```

---

## Prerequisites

Before running the backend, ensure you have the following installed:

- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`
- **PostgreSQL** `>= 15` (local or cloud, e.g. Supabase)
- **Redis** `>= 7` (local or cloud, e.g. Upstash)
- **Circom** `2.0.x` — for recompiling ZK circuits (optional; precompiled artifacts included)

```bash
# Check Node version
node --version  # Should be >= 20.0.0

# Install Circom (optional, for circuit changes)
cargo install circom
npm install -g snarkjs
```

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3001` |
| `NODE_ENV` | `development` / `production` | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/ghostpaymaster` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `BNB_RPC_URL` | BNB Chain RPC endpoint | `https://bsc-dataseed.binance.org/` |
| `BNB_TESTNET_RPC_URL` | BNB Testnet RPC endpoint | `https://data-seed-prebsc-1-s1.binance.org:8545/` |
| `RELAYER_PRIVATE_KEY` | Private key of the HOT relayer wallet | `0xabcd...` |
| `RELAYER_ADDRESS` | Address of the HOT relayer wallet | `0x1234...` |
| `PAYMASTER_CONTRACT_ADDRESS` | Deployed GhostPaymaster address | `0x...` |
| `ENTRYPOINT_ADDRESS` | ERC-4337 EntryPoint address | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d278` |
| `BUNDLER_URL` | Pimlico / Alchemy bundler RPC | `https://api.pimlico.io/v2/56/rpc?apikey=...` |
| `PIMLICO_API_KEY` | Pimlico API key | `pim_...` |
| `MERKLE_TREE_HEIGHT` | Depth of the privacy Merkle tree | `20` |
| `OFAC_SYNC_INTERVAL_MS` | How often to refresh OFAC SDN list | `3600000` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000,https://ghostpaymaster.xyz` |
| `CIRCUIT_WASM_PATH` | Path to compiled circuit WASM | `./src/zk/circuits/merkle_proof.wasm` |
| `CIRCUIT_ZKEY_PATH` | Path to circuit proving key | `./src/zk/circuits/merkle_proof_final.zkey` |

> ⚠️ **Never commit your `.env` file.** The `RELAYER_PRIVATE_KEY` controls the hot wallet that submits transactions. Use a dedicated relayer wallet with only enough BNB for operations.

---

## Installation

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate deploy

# 5. Sync OFAC blocklist (first-time setup)
npm run sync:ofac
```

---

## Running the Relayer

### Development Mode (with hot-reload)

```bash
npm run dev
```

The server will start on `http://localhost:3001`. You'll see structured JSON logs in the terminal.

### Production Mode

```bash
npm run build
npm start
```

### Background Queue Worker (BullMQ)

The relay queue worker processes UserOperations asynchronously. Run it in a separate terminal:

```bash
npm run worker
```

---

## API Reference

### Base URL
- **Development:** `http://localhost:3001/v1`
- **Production:** `https://api.ghostpaymaster.xyz/v1`

---

### `POST /v1/relay`

Submit a signed UserOperation for private gas relay.

**Request Body:**

```json
{
  "userOp": {
    "sender": "0x...",
    "nonce": "0x0",
    "initCode": "0x",
    "callData": "0x...",
    "callGasLimit": "0x55730",
    "verificationGasLimit": "0x55730",
    "preVerificationGas": "0xc350",
    "maxFeePerGas": "0x...",
    "maxPriorityFeePerGas": "0x...",
    "paymasterAndData": "0x<paymaster_address><zk_proof_payload>",
    "signature": "0x..."
  },
  "zkProof": {
    "pi_a": ["...", "...", "1"],
    "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
    "pi_c": ["...", "...", "1"],
    "publicSignals": ["<merkle_root>", "<nullifier_hash>", "<recipient>"]
  },
  "chainId": 56
}
```

**Response (Success `202 Accepted`):**

```json
{
  "jobId": "a1b2c3d4-e5f6-...",
  "status": "queued",
  "message": "UserOperation accepted. Use /v1/relay/status/:jobId to track."
}
```

**Response (Error `400 Bad Request`):**

```json
{
  "error": "INVALID_ZK_PROOF",
  "message": "The provided ZK proof failed on-chain verification.",
  "details": "Nullifier has already been spent."
}
```

---

### `GET /v1/relay/status/:jobId`

Poll the status of a submitted relay operation.

**Response:**

```json
{
  "jobId": "a1b2c3d4-e5f6-...",
  "status": "completed",
  "txHash": "0xabc...",
  "blockNumber": 12345678,
  "gasUsed": "0x5208",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**Status values:** `queued` → `processing` → `submitted` → `completed` | `failed`

---

### `POST /v1/pool/deposit`

Register a deposit commitment into the Ghost Privacy Pool.

**Request Body:**

```json
{
  "commitment": "0x<poseidon_hash>",
  "txHash": "0x<deposit_tx_on_bnb>",
  "amount": "10000000",
  "token": "USDC"
}
```

**Response (`201 Created`):**

```json
{
  "leafIndex": 42,
  "merkleRoot": "0x...",
  "message": "Commitment inserted. Merkle root updated."
}
```

---

### `GET /v1/pool/status`

Get overall pool statistics.

**Response:**

```json
{
  "totalDeposits": 1337,
  "activeCommitments": 1289,
  "merkleRoot": "0x...",
  "merkleTreeHeight": 20,
  "anonymitySetSize": 1289
}
```

---

### `GET /v1/health`

Health check for uptime monitoring.

**Response:**

```json
{
  "status": "ok",
  "uptime": 123456,
  "bundler": "connected",
  "database": "connected",
  "redis": "connected"
}
```

---

## ZK Proof Flow

The core of Ghost Paymaster's privacy comes from **Groth16 Zero-Knowledge Proofs** over a Poseidon Merkle tree.

### Circuit: `merkle_proof.circom`

```
                      ┌──────────────────────────────┐
 Private Inputs  ───▶ │  merkle_proof.circom          │
  - secret             │                              │
  - nullifier          │  Proves:                     │ ──▶  ZK Proof (π)
  - pathElements[]     │  1. commitment = H(secret,   │
  - pathIndices[]      │     nullifier) exists in tree│
                      │  2. nullifier is unspent      │ ──▶  Public Signals:
 Public Inputs   ───▶ │  3. sender controls secret   │       - merkle_root
  - merkle_root        │                              │       - nullifier_hash
  - nullifier_hash     │  WITHOUT revealing:          │       - recipient
  - recipient          │  - Which deposit it is       │
                      │  - The original depositor     │
                      └──────────────────────────────┘
```

### Step-by-Step Proof Generation (Client Side)

```typescript
// 1. Generate random secret and nullifier when depositing
const secret = crypto.getRandomValues(new Uint8Array(32));
const nullifier = crypto.getRandomValues(new Uint8Array(32));

// 2. Compute commitment (stored on-chain in Merkle tree)
const commitment = poseidon([secret, nullifier]);

// 3. Deposit USDC + commitment into GhostPool contract

// -- Later, from a fresh wallet --

// 4. Fetch Merkle proof from backend
const { pathElements, pathIndices, root } = await fetch('/v1/pool/merkle-proof?leaf=' + commitment);

// 5. Generate ZK proof locally (never leaves browser)
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  { secret, nullifier, pathElements, pathIndices },
  'merkle_proof.wasm',
  'merkle_proof_final.zkey'
);

// 6. Attach proof to UserOperation's paymasterAndData
const encodedProof = encodeAbiParameters(zkProofAbi, [proof.pi_a, proof.pi_b, proof.pi_c, publicSignals]);
```

### Nullifier Tracking (Double-Spend Prevention)

The backend tracks every spent `nullifier_hash` in PostgreSQL. Before forwarding any UserOperation:

1. Extract `nullifier_hash` from `publicSignals`
2. Query `nullifiers` table: `SELECT * FROM nullifiers WHERE hash = $1`
3. If found → reject with `PROOF_ALREADY_SPENT`
4. If not found → mark as pending, proceed with relay

---

## ERC-4337 UserOperation Flow

```
User (fresh wallet)
     │
     │  Signs UserOperation
     │  (no BNB needed)
     ▼
Ghost Paymaster Relayer (this server)
     │
     ├─ 1. Decode & validate UserOperation structure
     ├─ 2. Verify ZK-proof off-chain (snarkjs)
     ├─ 3. ASP compliance check (OFAC / blocklist)
     ├─ 4. Check nullifier not already spent
     ├─ 5. Estimate gas limits
     │
     ├─ 6. Call Pimlico Bundler: eth_sendUserOperation
     │
     ▼
Pimlico Bundler (3rd-party)
     │
     ├─ Batches with other UserOps
     │
     ▼
BNB Chain EntryPoint Contract (0x5FF1...)
     │
     ├─ Calls GhostPaymaster.validatePaymasterUserOp()
     │     ├─ Verifies ZK-proof on-chain (Groth16Verifier.sol)
     │     ├─ Checks nullifier not spent (nullifiers mapping)
     │     └─ Approves gas sponsorship
     │
     ├─ Executes user's callData
     │
     └─ Calls GhostPaymaster.postOp()
           └─ Marks nullifier as spent
           └─ Deducts fee from privacy pool balance
```

---

## Compliance (Oxbow / ASP Model)

Ghost Paymaster implements **Oxbow-style compliance** via Association Set Providers (ASPs). Privacy does **not** mean lawlessness.

### How It Works

```
User Deposit Address
        │
        ▼
┌───────────────────────────────┐
│  ASP Compliance Check         │
│                               │
│  1. OFAC SDN List Check       │──▶ BLOCKED (if matched)
│     (US sanctions list)       │
│                               │
│  2. CHAINALYSIS Risk Score    │──▶ BLOCKED (if high-risk)
│     (optional, API-based)     │
│                               │
│  3. Custom Blocklist          │──▶ BLOCKED (if blacklisted)
│     (protocol-level bans)     │
│                               │
│  4. PASSED ✓                  │──▶ Proof accepted for relay
└───────────────────────────────┘
```

### Key Compliance Properties

- **Selective Privacy:** Users are private from the *public*, not from *regulators*
- **Viewing Keys:** Pool operators can issue viewing keys that reveal transaction history to authorized parties (e.g., tax authorities)
- **No Direct Mixer:** The protocol never "mixes" funds — it uses ZK inclusion proofs. The user's money never leaves their control until they choose to spend it.
- **OFAC Sync:** The OFAC SDN list is synced every 60 minutes via `scripts/sync-ofac.ts`

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Integration Tests (requires Hardhat fork)

```bash
# In terminal 1: Start Hardhat fork of BNB mainnet
npx hardhat node --fork $BNB_RPC_URL

# In terminal 2: Run integration tests
npm run test:integration
```

### Test Coverage Targets

| Module | Target Coverage |
|--------|----------------|
| ZK Verifier | 95% |
| Merkle Tree | 90% |
| Relay API | 85% |
| Compliance | 90% |
| DB Repositories | 80% |

---

## Deployment

### BNB Testnet Deployment

```bash
# 1. Set up testnet env vars
export NODE_ENV=testnet
export BNB_RPC_URL=$BNB_TESTNET_RPC_URL

# 2. Deploy GhostPaymaster contract
npm run deploy:paymaster -- --network bsc-testnet

# 3. Fund the deployed Paymaster with BNB (for gas)
npm run fund:entrypoint -- --amount 0.5

# 4. Start the relayer
npm run build && npm start
```

### BNB Mainnet Deployment

```bash
# Ensure all environment variables are set for mainnet
# Run a final audit on the ZK circuit before going live
npm run audit:circuit

# Deploy
npm run deploy:paymaster -- --network bsc

# Fund Paymaster (recommend starting with 2-5 BNB)
npm run fund:entrypoint -- --amount 2.0
```

### Docker

```bash
# Build image
docker build -t ghost-paymaster-backend .

# Run with env file
docker run --env-file .env -p 3001:3001 ghost-paymaster-backend
```

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Nullifier replay attacks** | DB-level unique constraint on `nullifier_hash`; checked before relay |
| **Fake Merkle root** | Relayer fetches canonical root from on-chain contract, not user input |
| **Bundler front-running** | UserOps committed in batches; single-block execution |
| **Relayer key compromise** | Hot wallet holds minimal BNB; rotate keys via key management (HashiCorp Vault) |
| **ZK trusted setup** | Groth16 ceremony artifacts should be generated via multi-party computation (MPC) |
| **DoS / spam** | Rate-limiting per IP + per sender; BullMQ queue with concurrency caps |
| **OFAC violations** | SDN list synced hourly; all deposits screened before commitment insertion |

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| **Phase 1** | ERC-4337 Relayer (no ZK) | 🔧 In Progress |
| **Phase 1** | Basic Paymaster (USDC fee) | 🔧 In Progress |
| **Phase 2** | Circom ZK Circuit integration | ⏳ Planned |
| **Phase 2** | Poseidon Merkle Tree manager | ⏳ Planned |
| **Phase 3** | OFAC / ASP Compliance module | ⏳ Planned |
| **Phase 3** | Viewing Keys support | ⏳ Planned |
| **Phase 4** | Multi-chain support (ETH, Polygon) | 🔮 Future |
| **Phase 4** | Privacy NFT gating for Paymaster | 🔮 Future |

---

## Related Modules

| Module | Path | Description |
|--------|------|-------------|
| Smart Contracts | [`../contracts/`](../contracts/) | GhostPaymaster.sol, GhostPool.sol, Groth16Verifier.sol |
| Frontend dApp | [`../frontend/`](../frontend/) | React UI with Privacy Toggle & ZK proof generator |
| ZK Circuits | [`./circuits/`](./circuits/) | Circom source for merkle_proof.circom |

---

## License

MIT — see [LICENSE](../LICENSE)

---

*Built with ❤️ for BNB Chain X YZI Labs Hack Bengaluru · Track 4 — Privacy Solutions (4.1 · 4.2 · 4.3)*
