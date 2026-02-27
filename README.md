<div align="center">

# 👻 Ghost Paymaster

### Privacy-Preserving Gas Relayer on BNB Chain

[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-F0B90B?style=for-the-badge&logo=binance&logoColor=black)](https://www.bnbchain.org/)
[![ERC-4337](https://img.shields.io/badge/ERC--4337-Account%20Abstraction-blueviolet?style=for-the-badge)](https://eips.ethereum.org/EIPS/eip-4337)
[![Zero Knowledge](https://img.shields.io/badge/ZK-Circom%20%2B%20Groth16-00c4cc?style=for-the-badge)](https://docs.circom.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](./LICENSE)

> **BNB Hack 2026 · Privacy Solutions Track (PS4)**

*Break the doxxing trail between your KYC'd wallet and your private wallet — forever.*

[Overview](#-overview) · [Architecture](#-architecture) · [Modules](#-modules) · [Quick Start](#-quick-start) · [How It Works](#-how-it-works) · [Compliance](#-compliance) · [Roadmap](#-roadmap)

</div>

---

## 🔍 Overview

Every time you send BNB from a KYC'd exchange (Binance, Coinbase) to a "fresh" private wallet, that transfer is **permanently recorded on the public blockchain**. Anyone — from analytics firms to bad actors — can link your identity to your private wallet address.

**Ghost Paymaster solves this at the entry point.**

Instead of funding your new wallet from your KYC'd account, Ghost Paymaster acts as an **ERC-4337 Paymaster** that pays gas on your behalf. You reimburse it privately via a **Zero-Knowledge proof** backed by a shielded stablecoin pool — leaving **zero on-chain link** between your old and new wallet.

| Without Ghost Paymaster | With Ghost Paymaster |
|------------------------|----------------------|
| KYC Wallet → Gas → New Wallet | ❌ Link created forever | ✅ No link ever exists |
| Gas Sponsor | Your own KYC'd funds | Communal ZK Privacy Pool |
| Transaction "From" | Your address | Relayer / Bundler address |
| Compliance | No controls | OFAC + ASP screening |

---

## 🏛 Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         GHOST PAYMASTER SYSTEM                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─────────────────┐     ┌─────────────────────────────────────────┐    ║
║  │   USER BROWSER  │     │          GHOST PAYMASTER BACKEND         │    ║
║  │                 │     │                                         │    ║
║  │  1. Deposit     │────▶│  REST API (Fastify)                     │    ║
║  │     USDC into   │     │  ├── POST /v1/relay   ◀── UserOp + Proof│    ║
║  │     Privacy Pool│     │  ├── POST /v1/pool/deposit              │    ║
║  │                 │     │  └── GET  /v1/health                    │    ║
║  │  2. New wallet  │     │                                         │    ║
║  │     generates   │     │  ZK Verifier (snarkjs Groth16)          │    ║
║  │     ZK proof    │     │  Merkle Tree Manager                    │    ║
║  │     locally     │     │  Compliance Module (OFAC / ASP)         │    ║
║  │                 │     │  Bundler Client (Pimlico)               │    ║
║  │  3. Signs       │     │  BullMQ Queue + Workers                 │    ║
║  │     UserOp with │     └────────────────┬────────────────────────┘    ║
║  │     ZK proof in │                      │  eth_sendUserOperation       ║
║  │     paymaster   │                      ▼                             ║
║  │     data        │     ┌─────────────────────────────────────────┐    ║
║  └─────────────────┘     │            BNB CHAIN (ON-CHAIN)          │    ║
║                          │                                         │    ║
║  ┌─────────────────┐     │  ┌──────────────┐  ┌─────────────────┐ │    ║
║  │  FRONTEND dApp  │     │  │  EntryPoint  │  │ GhostPaymaster  │ │    ║
║  │  (Next.js)      │     │  │  (ERC-4337)  │─▶│ .sol            │ │    ║
║  │                 │     │  └──────────────┘  │ - verifyZKProof │ │    ║
║  │  Privacy Toggle │     │                    │ - payGas (BNB)  │ │    ║
║  │  ZK Proof Gen   │     │  ┌──────────────┐  │ - postOp deduct │ │    ║
║  │  Pool Deposit   │     │  │  GhostPool   │  └─────────────────┘ │    ║
║  │  Status Track   │     │  │  .sol        │                       │    ║
║  └─────────────────┘     │  │ (USDC pool + │  ┌─────────────────┐ │    ║
║                          │  │  Merkle tree)│  │ Groth16Verifier │ │    ║
║                          │  └──────────────┘  │ .sol (auto-gen) │ │    ║
║                          │                    └─────────────────┘ │    ║
║                          └─────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 📦 Modules

This is a monorepo with four top-level modules:

```
BNB/
├── 📄 README.md          ← You are here
├── 📄 LICENSE
│
├── 🔧 backend/           ← Node.js Gas Relayer & ZK Verifier
├── 📜 contracts/         ← Solidity Smart Contracts (Hardhat)
├── 🖥️  frontend/          ← Next.js dApp (Privacy Toggle UI)
└── 🌐 web/               ← Landing page / Marketing site
```

| Module | Tech Stack | Description |
|--------|------------|-------------|
| [`backend/`](./backend/) | Node.js · TypeScript · Fastify · snarkjs · Prisma | Relayer server, ZK proof verifier, BullMQ worker, OFAC compliance |
| [`contracts/`](./contracts/) | Solidity 0.8 · Hardhat · OpenZeppelin | GhostPaymaster, GhostPool, Groth16Verifier |
| [`frontend/`](./frontend/) | Next.js 16 · React 19 · TypeScript · Tailwind | User-facing dApp with privacy toggle and ZK proof generation |
| [`web/`](./web/) | Next.js 16 · React 19 · TypeScript · Tailwind | Marketing landing page |

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`
- **PostgreSQL** `>= 15`
- **Redis** `>= 7`

### 1. Clone & Install

```bash
git clone https://github.com/your-org/ghost-paymaster.git
cd ghost-paymaster

# Install dependencies for all modules
npm install --prefix backend
npm install --prefix contracts
npm install --prefix frontend
npm install --prefix web
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# → Fill in: DATABASE_URL, REDIS_URL, BNB_RPC_URL, RELAYER_PRIVATE_KEY, BUNDLER_URL

# Contracts
cp contracts/.env.example contracts/.env
# → Fill in: DEPLOYER_PRIVATE_KEY, BNB_RPC_URL, BSCSCAN_API_KEY

# Frontend
cp frontend/.env.example frontend/.env.local
# → Fill in: NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_PAYMASTER_ADDRESS
```

### 3. Start the Database

```bash
# Run PostgreSQL and Redis locally (example with Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d -p 6379:6379 redis:7

# Apply database migrations
cd backend && npx prisma migrate dev && cd ..
```

### 4. Deploy Contracts (Testnet)

```bash
cd contracts

# Compile
npx hardhat compile

# Deploy to BNB Testnet
npx hardhat run scripts/deploy.ts --network bsc-testnet

# Fund the Paymaster with BNB via EntryPoint
npx hardhat run scripts/fund-paymaster.ts --network bsc-testnet

cd ..
```

### 5. Run Everything

Open **four terminals**:

```bash
# Terminal 1 — Backend API server
cd backend && npm run dev

# Terminal 2 — Background relay queue worker
cd backend && npm run worker

# Terminal 3 — Frontend dApp
cd frontend && npm run dev

# Terminal 4 — Landing page (optional)
cd web && npm run dev
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Frontend dApp | http://localhost:3000 |
| Landing page | http://localhost:3002 |

---

## 🔐 How It Works

### The Doxxing Problem

```
👤 You (KYC'd)                    Public Blockchain
      │                                  │
      │──[Send 0.01 BNB for gas]────────▶│──▶ FOREVER LINKED ❌
      │                                  │
🔒 New "Private" Wallet ◀───────────────┘
```

### The Ghost Paymaster Solution

```
Step 1 — DEPOSIT (one time, from any wallet)
──────────────────────────────────────────────
👤 Any Wallet ──[Deposit 10 USDC]──▶ GhostPool.sol
                                          │
                              commitment = Poseidon(secret, nullifier)
                              → inserted into on-chain Merkle tree
                              → secret & nullifier stored ONLY by you

Step 2 — USE (from fresh anonymous wallet, zero BNB needed)
────────────────────────────────────────────────────────────
🔒 Fresh Wallet (0 BNB)
      │
      │  Generate ZK Proof locally (never leaves browser)
      │  Proof says: "I own a commitment in the Merkle tree"
      │              "This nullifier is unspent"
      │              WITHOUT revealing WHICH commitment
      │
      │──[Signed UserOp + ZK Proof]──▶ Ghost Paymaster Backend
                                              │
                                    Verify proof (snarkjs)
                                    OFAC compliance check
                                    Check nullifier unspent
                                              │
                                    ──▶ Pimlico Bundler
                                              │
                                    ──▶ BNB Chain EntryPoint
                                              │
                              GhostPaymaster.validatePaymasterUserOp()
                              → Verifies ZK proof on-chain
                              → Pays BNB gas ✅
                                              │
                              GhostPaymaster.postOp()
                              → Marks nullifier as spent
                              → Deducts USDC fee from pool
```

**Result:** The fresh wallet transacts on BNB Chain. Gas is paid by the Paymaster. Zero BNB ever flowed from your KYC'd wallet to your private wallet. **The link is broken. 👻**

---

## 📜 Smart Contracts

| Contract | Description |
|----------|-------------|
| `GhostPaymaster.sol` | ERC-4337 Paymaster. Validates ZK proofs, sponsors gas, calls `postOp` to settle fee. |
| `GhostPool.sol` | Privacy pool. Accepts USDC/USDT deposits. Maintains Poseidon Merkle tree of commitments. |
| `Groth16Verifier.sol` | Auto-generated by `snarkjs`. Verifies `merkle_proof.circom` proofs on-chain in O(1). |

### Key Solidity Interface

```solidity
// GhostPaymaster.sol
function validatePaymasterUserOp(
    UserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
) external override returns (bytes memory context, uint256 validationData) {
    // 1. Decode ZK proof from userOp.paymasterAndData
    (Proof memory proof, uint256[3] memory publicSignals) = _decodeProof(userOp.paymasterAndData);

    // 2. Verify proof on-chain via Groth16Verifier
    require(verifier.verifyProof(proof.a, proof.b, proof.c, publicSignals), "Invalid ZK proof");

    // 3. Check merkle root is canonical
    require(ghostPool.isKnownRoot(bytes32(publicSignals[0])), "Unknown Merkle root");

    // 4. Check nullifier not spent
    require(!nullifiers[bytes32(publicSignals[1])], "Proof already spent");

    return (abi.encode(publicSignals[1]), 0); // pass nullifier to postOp
}
```

---

## 🔬 ZK Circuit

**Circuit:** `circuits/merkle_proof.circom`  
**Proving scheme:** Groth16  
**Hash function:** Poseidon (ZK-friendly, gas-efficient)  
**Tree depth:** 20 levels (supports up to 1,048,576 commitments)

```
Private Inputs:
  - secret          (random 32-byte value, generated at deposit)
  - nullifier       (random 32-byte value, generated at deposit)
  - pathElements[]  (sibling nodes along the Merkle path)
  - pathIndices[]   (left/right flags at each level)

Public Inputs:
  - merkle_root     (current root of the privacy pool Merkle tree)
  - nullifier_hash  (Poseidon(nullifier) — marks this proof as "used")
  - recipient       (destination address for the UserOperation)

The circuit proves — without revealing private inputs:
  ✅ commitment = Poseidon(secret, nullifier) exists in the tree at root
  ✅ nullifier_hash = Poseidon(nullifier) (links proof to nullifier)
  ✅ The prover knows both secret and nullifier
```

---

## ✅ Compliance

Ghost Paymaster implements the **Oxbow / Association Set Provider (ASP)** model — the same compliance philosophy as 0xbow. Privacy is for everyone except bad actors.

### Screening Layers

```
Any deposit or relay request goes through:

  Layer 1: OFAC SDN List
    → Address checked against US Treasury sanctions list
    → List synced every 60 minutes

  Layer 2: Custom ASP Blocklist
    → Protocol-level bans for known scammers / exploiters

  Layer 3: (Optional) Chainalysis Risk Score
    → API-based risk scoring for high-value transactions

  → PASS: Commitment accepted / Relay proceeds
  → FAIL: Request rejected with compliance error
```

### Why This Matters

> "This is not a mixer. Users prove they belong to a *clean set*, not just any set."

- Regulators can be granted **Viewing Keys** to audit transaction history
- No funds are ever "mixed" — users retain custody at all times
- The ZK proof only proves *membership*, not *identity*

---

## 🗺 Roadmap

### Phase 1 — Foundation *(Hackathon MVP)*
- [x] Monorepo structure
- [x] Backend README & API design
- [ ] `GhostPool.sol` — deposit & Merkle tree
- [ ] `GhostPaymaster.sol` — ERC-4337 Paymaster (token fee)
- [ ] Backend relayer — accepts UserOps, forwards to Pimlico
- [ ] Frontend — basic Privacy Toggle UI

### Phase 2 — ZK Integration
- [ ] `merkle_proof.circom` — Poseidon Merkle proof circuit
- [ ] Trusted setup (Powers of Tau ceremony)
- [ ] `Groth16Verifier.sol` — generated & deployed
- [ ] Backend ZK verifier (snarkjs off-chain pre-check)
- [ ] Frontend ZK proof generation in-browser (WASM)

### Phase 3 — Compliance & Polish
- [ ] OFAC SDN sync service
- [ ] ASP blocklist API
- [ ] Viewing key support
- [ ] Frontend Merkle proof fetcher & nullifier tracker

### Phase 4 — Production
- [ ] Mainnet deployment
- [ ] Multi-token fee support (USDT, USDC, BUSD)
- [ ] Privacy NFT gating option
- [ ] Multi-chain expansion (Ethereum, Polygon)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `git commit -m "feat: add ZK proof batch verification"`
4. Open a pull request

---

## 📚 References & Inspiration

| Resource | Relevance |
|----------|-----------|
| [EIP-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337) | Account Abstraction standard used for UserOperations |
| [Tornado Cash / Semaphore](https://github.com/semaphore-protocol/semaphore) | ZK group membership pattern |
| [Railgun Protocol](https://railgun.org/) | Broadcaster/ZK relay architecture inspiration |
| [0xbow / Oxbow Model](https://0xbow.io/) | ASP compliance framework |
| [Pimlico Bundler](https://docs.pimlico.io/) | ERC-4337 bundler used in this project |
| [Circom Documentation](https://docs.circom.io/) | ZK circuit toolchain |
| [Permissionless.js](https://docs.pimlico.io/permissionless) | AA SDK for UserOperation building |

---

## 📄 License

MIT — see [LICENSE](./LICENSE)

---

<div align="center">

Built with ❤️ for **BNB Hack 2026 · Privacy Solutions Track (PS4)**

*"Privacy is not about hiding. It's about choosing what to share, and with whom."*

</div>