# 👻 Ghost Privacy Suite

> **Compliant, gasless, ZK-proven private stablecoin transfers on BNB Chain.**  
> *Send USDC from a wallet with zero BNB. Gas paid by Ghost Paymaster. No on-chain link to the depositor.*

[![Live on BSC Testnet](https://img.shields.io/badge/BSC%20Testnet-Live-brightgreen?logo=binance)](https://testnet.bscscan.com/address/0xd2c227909A77359b422C1BfEa6B482f2559eF6aa)
[![ZK Proofs](https://img.shields.io/badge/ZK-Groth16%20%2F%20BN128-purple)](https://github.com)
[![ERC-4337](https://img.shields.io/badge/ERC--4337-EntryPoint%20v0.7-blue)](https://eips.ethereum.org/EIPS/eip-4337)
[![Track](https://img.shields.io/badge/BNB%20Hack%20Bengaluru-Track%204.1%20·%204.2%20·%204.3-orange)](https://github.com)

---

## 🏆 Hackathon Tracks

| Track | What We Built |
|---|---|
| **4.1 — Gas Relayer** | Full ERC-4337 bundler + GhostPaymaster that sponsors BNB gas, settled in USDC from the pool |
| **4.2 — Privacy SDK** | Groth16 ZK circuit (Poseidon Merkle proof), browser WASM prover, on-chain Groth16Verifier |
| **4.3 — Railgun Integration** | Railgun shield/unshield/swap UI with Waku-simulated P2P flow + Proof of Innocence |

---

## 🎬 30-Second Demo

**The core idea in one sentence:**  
A depositor locks USDC into a privacy pool. Later, a *fresh wallet with 0 BNB* proves pool membership via ZK, sends USDC anywhere, and pays gas in USDC — with zero on-chain link back to the original depositor.

```
Wallet A (has USDC)        Ghost Pool          Wallet B (0 BNB, fresh)
     │                         │                        │
     ├── deposit 0.2 USDC ────▶│                        │
     │   commitment stored      │                        │
     │   Ghost Note issued ◀───│                        │
     │                         │                        │
     │   [days/weeks later]     │                        │
     │                         │◀── ZK proof ────────── │
     │                         │    "I know the secret"  │
     │                         │    nullifier unspent     │
     │                         │                         │
     │                         │── Gas: 0 BNB from B ✓  │
     │                         │── Gas paid: Paymaster   │
     │                         │── Fee settled: USDC     │
                                                         │
                                              B sends 0.2 USDC → recipient
```

**[➡ Run the demo yourself in 2 minutes](#-running-locally)**

---

## ✅ Live On-Chain Proof

Everything is deployed and verified on **BSC Testnet (chainId 97)**. These are real transactions, not simulations.

### Verified Transactions

| What | Tx Hash | Result |
|---|---|---|
| **First relay (account deployed in-tx)** | [`0xf75d06d...`](https://testnet.bscscan.com/tx/0xf75d06d274122e74171b86750c80dbad9cceb31a5be4e1425ce01d6c8b05ebd1) | 844,440 gas · 0.044 USDC fee settled |
| **Second relay (account reused)** | [`0x2910e58...`](https://testnet.bscscan.com/tx/0x2910e58058ddd653868a8682d0d37d4e539e676eed55fc1cd9f9060c65dcb4c7) | 564,932 gas · ZK proof verified on-chain |

### Deployed Contracts

| Contract | Address |
|---|---|
| **GhostPool** | [`0xd2c227909A77359b422C1BfEa6B482f2559eF6aa`](https://testnet.bscscan.com/address/0xd2c227909A77359b422C1BfEa6B482f2559eF6aa) |
| **GhostPaymaster** | [`0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df`](https://testnet.bscscan.com/address/0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df) |
| **GhostSmartAccountFactory** | [`0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0`](https://testnet.bscscan.com/address/0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0) |
| **Groth16Verifier** | [`0x61ac3A70Ed4CAab15dd547b374dd1BF7a519cdfA`](https://testnet.bscscan.com/address/0x61ac3A70Ed4CAab15dd547b374dd1BF7a519cdfA) |
| **PoseidonHasher** | [`0x432E4098133165D2f90E768fa73642236c6f910b`](https://testnet.bscscan.com/address/0x432E4098133165D2f90E768fa73642236c6f910b) |
| **Mock USDC (18dp)** | [`0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33`](https://testnet.bscscan.com/address/0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33) |
| **EntryPoint v0.7** | [`0x0000000071727De22E5E9d8BAf0edAc6f37da032`](https://testnet.bscscan.com/address/0x0000000071727De22E5E9d8BAf0edAc6f37da032) |

---

## 🔬 How It Works

### The ZK Circuit

```
Private inputs (never leave the browser):
  secret, nullifier, pathElements[10], pathIndices[10]

Public inputs (go on-chain, reveal nothing about depositor):
  root          — Merkle root of the GhostPool tree
  nullifierHash — Poseidon(nullifier), marks note as spent
  recipient     — Smart account address (binds proof to this UserOp)

What the Groth16 proof proves:
  1. nullifierHash == Poseidon(nullifier)
  2. commitment   == Poseidon(secret, nullifier)
  3. MerkleRoot(commitment, path) == root
  4. recipient    is the intended smart account
```

**Proof generation:** `snarkjs.groth16.fullProve()` runs the compiled WASM circuit in the browser in ~3–8 seconds.  
**On-chain verification:** `Groth16Verifier.sol` uses BN128 elliptic curve pairings — ~800,000 gas.

### The ERC-4337 Gas Sponsorship Flow

```
1. [Browser] ZK proof generated → packed into paymasterAndData
2. [Browser] PackedUserOperation assembled + signed (MetaMask signMessage, free — no BNB)
3. [Browser] POST /api/bundle → our mini-bundler
4. [Bundler] EntryPoint.handleOps([userOp], bundler, { gasLimit: 5_000_000 })
5. [EntryPoint → GhostPaymaster.validatePaymasterUserOp()]
      ✅ Groth16Verifier.verify(pA, pB, pC, [root, nullifier, recipient])
      ✅ GhostPool.isKnownRoot(root)
      ✅ nullifier not spent
      ✅ recipient == userOp.sender
6. [EntryPoint → GhostSmartAccount.execute(dest, value, calldata)]
      → Anything. Send USDC. Interact with DeFi. Call any contract.
7. [EntryPoint → GhostPaymaster._postOp()]
      → Mark nullifier spent (replay protection)
      → feeUSDC = actualGasCost × BNB/USDC rate
      → GhostPool.deductFee() — USDC leaves pool → Paymaster
```

**Result:** Smart account executed a transaction with **zero BNB from its own balance**. Gas was fronted in BNB by the Paymaster and settled in USDC from the pool. The depositor and the recipient are cryptographically unlinkable.

---

## 🔄 Full App Flow (UI Walkthrough)

### Tab 1: Deposit
1. Connect MetaMask (BSC Testnet)
2. Select amount (default: **0.2 USDC**)
3. Click **"Connect Wallet & Deposit"** → approve + commit → Ghost Note generated
4. **Save your Ghost Note** — it's the private key to your funds

### Tab 2: Relay (0 BNB flow)
1. Paste your Ghost Note
2. The smart account address is computed via CREATE2 — check its USDC balance
3. Click **"Fund 0.2 USDC →"** to send USDC to the smart account (one-time, uses your wallet BNB)
4. Enter a recipient address
5. Click **"Generate Proof & Relay →"**
   - Groth16 proof runs in your browser (~5s)
   - UserOp submitted to bundler
   - **Smart account sends 0.2 USDC, paying 0 BNB**
   - Gas receipt shown with actual BNB cost and USDC fee settled

### Tab 3: Railgun (simulated)
- Shield / Unshield / Swap flows with realistic timing, Waku P2P network indicator, shielded balance tracker, and Proof of Innocence generation

### Tab 4: Compliance
- Viewing key export (HMAC-derived, wallet-bound)
- OFAC clean-set proof, privacy score, auditor disclosure flow

---

## 🚀 Running Locally

```bash
# 1. Clone
git clone <repo-url>
cd BNB/frontend

# 2. Environment
cp .env.local.example .env.local   # or create it:
cat > .env.local << 'EOF'
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_RPC_URL=https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e
BUNDLER_PRIVATE_KEY=<your-deployer-key>
NEXT_PUBLIC_ENTRY_POINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032
EOF

# 3. Install and run
npm install
npm run dev
# → http://localhost:3000
```

> **MetaMask setup:** Add BSC Testnet (chainId 97, RPC `https://data-seed-prebsc-1-s1.bnbchain.org:8545`). The app will auto-prompt the network switch.

> **Need testnet BNB?** → [faucet.bnbchain.org](https://testnet.bnbchain.org/faucet-smart) — ~0.01 BNB is enough.

---

## 📁 Project Structure

```
BNB/
├── contracts/                        ✅ Solidity · Hardhat · deployed BSC Testnet
│   ├── contracts/
│   │   ├── GhostPool.sol             Poseidon Merkle tree privacy pool
│   │   ├── GhostPaymaster.sol        ERC-4337 paymaster · ZK validation · USDC fee settlement
│   │   ├── GhostSmartAccount.sol     ERC-4337 minimal smart account
│   │   ├── GhostSmartAccountFactory.sol  CREATE2 factory (deterministic addresses)
│   │   ├── Groth16Verifier.sol       Auto-generated by snarkjs · BN128 pairings
│   │   └── PoseidonHasher.sol        Poseidon T3 hash wrapper
│   └── circuits/
│       ├── merkle_proof.circom       ZK circuit source (Groth16, depth=10)
│       └── build/                    .r1cs · .zkey · .wasm · vk.json
│
├── frontend/                         ✅ Next.js 16 · Turbopack · live DApp
│   ├── app/
│   │   ├── page.tsx                  App shell · tab routing · MetaMask connect
│   │   ├── components/
│   │   │   ├── DepositView.tsx       Deposit tab: approve → commit → Ghost Note
│   │   │   ├── RelayView.tsx         Relay tab: ZK proof → UserOp → 0-BNB send
│   │   │   ├── RailgunView.tsx       Railgun tab: shield/unshield/swap simulation
│   │   │   ├── ComplianceView.tsx    Compliance: viewing key, OFAC check, POI
│   │   │   └── ScoreView.tsx         Privacy score: on-chain anonymity analysis
│   │   └── api/bundle/route.ts       Mini-bundler: submits UserOps to EntryPoint
│   ├── lib/
│   │   ├── ghost.ts                  Core: deposit · relay · ZK proof · UserOp builder
│   │   └── addresses.ts             All deployed contract addresses (BSC Testnet)
│   └── public/zk/
│       ├── merkle_proof.wasm         WASM circuit served to browser (1.97 MB)
│       ├── merkle_proof_final.zkey   Proving key (1.68 MB)
│       └── verification_key.json     Local pre-verify before on-chain submission
│
├── backend/                          ✅ Fastify · BullMQ · Prisma (full relayer)
│   └── src/
│       ├── api/routes/relay.ts       POST /v1/relay · async job queue
│       ├── relayer/                  bundlerClient · paymasterClient · userOpBuilder
│       ├── zk/                       off-chain snarkjs pre-screen · Merkle tree mirror
│       └── compliance/               OFAC SDN sync · ASP check · blocklist CRUD
│
└── web/                              ✅ Marketing landing page (Next.js)
```

---

## ⚡ Gas Numbers (Real On-Chain)

| Component | Gas |
|---|---|
| Groth16 BN128 on-chain verification | ~800,000 |
| First-time account deployment (CREATE2) | ~200,000 |
| `GhostSmartAccount.validateUserOp` | ~30,000 |
| `GhostPaymaster.postOp` + `deductFee` + USDC transfer | ~50,000 |
| EntryPoint overhead + pre-verification | ~350,000 |
| **Total (first relay, with deployment)** | **~844,440** |
| **Total (subsequent relays)** | **~564,932** |
| **Cost at 0.1 Gwei** | **~0.00008 BNB ≈ $0.05** |
| **Settled in USDC** | **~0.044 USDC** |

---

## 🔐 Privacy Guarantees

| What the chain sees | What remains private |
|---|---|
| A commitment in GhostPool | Which commitment = which withdrawal |
| A fresh smart account receiving gas | The depositor's identity |
| GhostPaymaster deducting a fee | The secret + nullifier (never leave browser) |
| A nullifierHash being spent | Which Merkle leaf was spent |

> **Anonymity set** = total deposits in GhostPool. Every deposit makes every withdrawal harder to trace. The set grows permissionlessly.

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Smart Contracts | Solidity 0.8.x · Hardhat · OpenZeppelin |
| ZK Circuits | Circom 2.0 · snarkjs · Groth16 · BN128 / Poseidon |
| In-Browser Proving | snarkjs WASM · WebAssembly · ~3–8s proof time |
| Frontend | Next.js 16 · Turbopack · TypeScript · Vanilla CSS |
| Wallet | ethers.js v6 · MetaMask (EIP-1193) |
| ERC-4337 | EntryPoint v0.7 · GhostSmartAccount · GhostPaymaster |
| Backend | Fastify · BullMQ · Prisma · Postgres · Redis |
| RPC | NodeReal (BSC Testnet) |
| Compliance | OFAC SDN sync · AssociationSetProvider · Viewing Keys |

---

## 👥 Team

Built at **BNB Chain × YZI Labs Hack Bengaluru 2026**  
Tracks: **4.1 (Gas Relayer) · 4.2 (Privacy SDK) · 4.3 (Railgun)**

---

*Ghost Privacy Suite — financial privacy that passes scrutiny.*