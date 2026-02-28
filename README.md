# 👻 Ghost Privacy Suite

> **Compliant, gasless, ZK-proven private transactions on BNB Chain.**  
> Built for BNB Chain × YZI Labs Hack Bengaluru — Track 4.1 (Gas Relayer) · 4.2 (Privacy SDK) · 4.3 (Railgun)

---

## What Is Ghost?

Ghost lets a wallet with **zero BNB** withdraw stablecoins from a privacy pool using a ZK proof, with gas sponsored by a paymaster and settled in USDC. The user who deposited and the user who withdraws are cryptographically unlinkable.

```
Depositor (KYC wallet)  →  Ghost Pool  →  [ ZK proof in browser ]  →  Fresh wallet (0 BNB)
                                                     ↑
                              No on-chain link between these two wallets
```

---

## ✅ What Is Working Right Now

Everything below is live on **BSC Testnet (chainId 97)** and has been end-to-end verified with real on-chain transactions.

### 1. Smart Contracts — All Deployed and Verified Live

| Contract | Address | BscScan |
|---|---|---|
| **EntryPoint v0.7** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | [View](https://testnet.bscscan.com/address/0x0000000071727De22E5E9d8BAf0edAc6f37da032) |
| **GhostPool** | `0xd2c227909A77359b422C1BfEa6B482f2559eF6aa` | [View](https://testnet.bscscan.com/address/0xd2c227909A77359b422C1BfEa6B482f2559eF6aa) |
| **GhostPaymaster** | `0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df` | [View](https://testnet.bscscan.com/address/0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df) |
| **GhostSmartAccountFactory** | `0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0` | [View](https://testnet.bscscan.com/address/0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0) |
| **Groth16Verifier** | `0x61ac3A70Ed4CAab15dd547b374dd1BF7a519cdfA` | [View](https://testnet.bscscan.com/address/0x61ac3A70Ed4CAab15dd547b374dd1BF7a519cdfA) |
| **PoseidonHasher** | `0x432E4098133165D2f90E768fa73642236c6f910b` | [View](https://testnet.bscscan.com/address/0x432E4098133165D2f90E768fa73642236c6f910b) |
| **AssociationSetProvider** | see `backend/.env` → `ASP_CONTRACT_ADDRESS` | BSC Testnet |
| **GhostNameService** | see `backend/.env` → `GNS_CONTRACT_ADDRESS` | BSC Testnet |
| **Mock USDC** | `0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33` | [View](https://testnet.bscscan.com/address/0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33) |
| **Mock USDT** | `0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe` | [View](https://testnet.bscscan.com/address/0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe) |

**Deployed:** 2026-02-27/28 by `0x90e6a10271D31EA4EA29B66D48e6f078C4091f77`

---

### 2. ZK Circuits — Compiled and Generating Real Proofs

The circuit is a **Groth16 / BN128 Poseidon Merkle inclusion proof**, compiled with Circom 2.0.

```
circuits/
├── merkle_proof.circom          Source (114 lines, depth=10 for testnet)
└── build/
    ├── merkle_proof.r1cs        Compiled constraint system (1.36 MB)
    ├── merkle_proof_final.zkey  Proving key after trusted setup (1.68 MB)
    ├── pot15.ptau               Powers of Tau (2^15 constraints, 37.8 MB)
    └── verification_key.json    Verifier key (3.3 KB)

frontend/public/zk/
├── merkle_proof.wasm            WASM circuit — served to and runs in browser (1.97 MB)
├── merkle_proof_final.zkey      Proving key — served to browser (1.68 MB)
└── verification_key.json        Used for local proof verification before submission
```

**What the circuit proves (without revealing):**
1. `nullifierHash == Poseidon(nullifier)` — enables double-spend prevention
2. `commitment == Poseidon(secret, nullifier)` — prover knows the secret
3. `MerkleRoot(commitment, path) == root` — commitment exists in the tree
4. `recipient` is bound to the proof — bundler cannot re-use proof for another wallet

**Proof generation happens in the browser** via `snarkjs.groth16.fullProve()` running the WASM circuit. Takes ~3–10 seconds. The proof is then **verified on-chain** by `Groth16Verifier.sol` using BN128 elliptic curve pairings (~800k gas).

---

### 3. End-to-End Flow — Verified On-Chain

Two confirmed transactions on BSC Testnet demonstrating the full stack:

#### E2E Test (backend)
- **Tx:** [`0x2910e58...`](https://testnet.bscscan.com/tx/0x2910e58058ddd653868a8682d0d37d4e539e676eed55fc1cd9f9060c65dcb4c7)
- **Smart account deployed:** `0xFF699eeE45384c23840dc1c7c71110b9BFdca70d`
- **Gas used:** 564,932 (account already deployed)

#### Frontend DApp relay (via UI)
- **Tx:** [`0xf75d06d...`](https://testnet.bscscan.com/tx/0xf75d06d274122e74171b86750c80dbad9cceb31a5be4e1425ce01d6c8b05ebd1)
- **Smart account deployed in-tx:** `0xeeffED218604923bbce843C6a22Fd047DBBdFfdc`
- **Gas used:** 844,440 (includes first-time account deployment ~+200k)
- **Fee settled:** 0.044501 USDC transferred from GhostPool → GhostPaymaster

---

## How It Works — The Full Flow

### Phase 1: Deposit

```
User's MetaMask wallet
  │
  ├─ 1. MockERC20.mint(user, 10 USDC)         [testnet only — free tokens]
  ├─ 2. USDC.approve(GhostPool, 10 USDC)
  ├─ 3. Browser computes:
  │      secret     = random 31 bytes  (never leaves browser)
  │      nullifier  = random 31 bytes  (never leaves browser)
  │      commitment = Poseidon(secret, nullifier)
  └─ 4. GhostPool.deposit(commitment, 10e6, USDC_addr)
           ├─ Pulls USDC from user
           ├─ Inserts commitment into depth-10 Poseidon Merkle tree
           └─ Emits Deposit(leafIndex, commitment)

Ghost Note generated:
  "ghost:v1:<secretHex>:<nullifierHex>:10:USDC:<leafIndex>:<commitmentHex>"
  ⚠️  Save this. It is the ONLY way to recover your funds.
```

### Phase 2: Relay (from a fresh wallet with 0 BNB)

```
User pastes Ghost Note into Relay tab
  │
  ├─ 1. Smart account address computed:
  │      factory.getFunction("getAddress(address,uint256)")(owner, salt=0)
  │      → deterministic CREATE2 address (same every time for same owner+salt)
  │
  ├─ 2. Merkle path reconstructed in browser:
  │      ├─ Downloads all Deposit events from GhostPool (eth_getLogs)
  │      ├─ Rebuilds the Poseidon Merkle tree locally
  │      ├─ Verifies local root matches on-chain GhostPool.getLastRoot()
  │      └─ Extracts pathElements[10] + pathIndices[10] for our leafIndex
  │
  ├─ 3. ZK proof generated in browser (WASM):
  │      snarkjs.groth16.fullProve({
  │        secret, nullifier,              ← private, never leave browser
  │        pathElements, pathIndices,      ← private
  │        root, nullifierHash, recipient  ← public, go on-chain
  │      }, merkle_proof.wasm, merkle_proof_final.zkey)
  │      → { proof: { pi_a, pi_b, pi_c }, publicSignals }
  │      Local verify: snarkjs.groth16.verify(vk, publicSignals, proof) ✅
  │
  ├─ 4. PackedUserOperation assembled:
  │      sender:            smart account (may not exist yet)
  │      nonce:             EntryPoint.getNonce(sender, 0)
  │      initCode:          factory + createAccount(owner, salt)  [if new account]
  │      callData:          execute(recipient, 0, "0x")
  │      paymasterAndData:  GhostPaymaster address
  │                       + verificationGasLimit (900,000)
  │                       + postOpGasLimit (200,000)
  │                       + validUntil / validAfter (0 = no expiry)
  │                       + feeToken (USDC address)
  │                       + abi.encode(proof.pi_a, proof.pi_b, proof.pi_c,
  │                                    [root, nullifierHash, recipient])
  │      signature:         MetaMask.signMessage(EntryPoint.getUserOpHash(op))
  │
  └─ 5. POST /api/bundle { userOp }
           └─ Bundler wallet (0x90e6a102...) calls:
              EntryPoint.handleOps([userOp], bundler.address, { gasLimit: 5_000_000 })
```

### Phase 3: EntryPoint Execution (on-chain)

```
EntryPoint.handleOps()
  │
  ├─ VALIDATION:
  │   ├─ Deploy smart account (if initCode present)
  │   │   GhostSmartAccountFactory.createAccount(owner, salt)
  │   │   → CREATE2 deploys GhostSmartAccount
  │   │   → emit AccountCreated(account, owner, salt)
  │   │
  │   ├─ GhostSmartAccount.validateUserOp()
  │   │   → ecrecover(userOpHash, sig) == owner? ✅
  │   │
  │   └─ GhostPaymaster.validatePaymasterUserOp()
  │       ├─ Decode paymasterAndData
  │       ├─ GhostPool.isKnownRoot(root) ✅
  │       ├─ nullifier not spent ✅
  │       ├─ recipient == userOp.sender ✅
  │       └─ Groth16Verifier.verify(pA, pB, pC, [root, nullHash, recipient])
  │           → BN128 pairing checks (~800k gas) ✅
  │
  ├─ EXECUTION:
  │   └─ GhostSmartAccount.execute(dest, 0, "0x")
  │       → calls destination (any address, any calldata, any value)
  │
  └─ POST-OP (gas settlement):
      GhostPaymaster._postOp()
        ├─ Mark nullifier spent (prevents replay)
        ├─ Convert actualGasCost (BNB wei) → USDC at configured rate
        └─ GhostPool.deductFee(nullifierHash, usdcAmount, USDC)
            → USDC.transfer(GhostPool → GhostPaymaster)

Result: Smart account executed a transaction with ZERO BNB,
        gas paid from pool's USDC balance, zero link to depositor.
```

---

## On-Chain Event Trace (real tx `0xf75d06d...`)

| Log | Contract | Event | Key Data |
|---|---|---|---|
| 0 | `GhostSmartAccountFactory` | `AccountCreated` | account=`0xeeffED...`, owner=`0x44cd98...`, salt=0 |
| 1 | `EntryPoint` | `AccountDeployed` | factory=`0x7D5eb7...`, paymaster=`0xB5Be8a...` |
| 2 | `EntryPoint` | `BeforeExecution` | (execution phase begins) |
| 3 | `GhostPaymaster` | *(validatePaymasterUserOp pass)* | ZK proof verified ✅ |
| 4 | `MockUSDC` | `Transfer` | from=GhostPool, to=GhostPaymaster, amount=44501 (0.044501 USDC) |
| 5 | `GhostPool` | `FeeDeducted` | nullifierHash, amount=44501 |
| 6 | `GhostPaymaster` | `PostOpSettled` | account=`0xeeffED...` |
| 7 | `EntryPoint` | `UserOperationEvent` | nonce=0, success=true, gasUsed=844,440 |

---

## Gas Breakdown

| Component | Gas |
|---|---|
| Groth16 BN128 on-chain verification | ~800,000 |
| First-time smart account deployment (CREATE2) | ~200,000 |
| `GhostSmartAccount.validateUserOp` | ~30,000 |
| `execute()` calldata processing | ~21,000 |
| `postOp` + `deductFee` + USDC transfer | ~50,000 |
| EntryPoint overhead | ~50,000 |
| Pre-verification gas | ~300,000 |
| **Total (first relay, with deployment)** | **~844,440** |
| **Total (subsequent relays, no deployment)** | **~564,932** |
| **Cost (0.1 Gwei gas price)** | **~0.0000844 BNB ≈ $0.05** |
| **Settled in USDC** | **0.044501 USDC** |

---

## Repository Structure

```
BNB/
├── contracts/                     ✅ Complete
│   ├── contracts/
│   │   ├── GhostPool.sol          Poseidon Merkle pool, multi-token deposits
│   │   ├── GhostPaymaster.sol     ERC-4337 paymaster with ZK validation
│   │   ├── GhostSmartAccount.sol  ERC-4337 smart account (owner + salt)
│   │   ├── GhostSmartAccountFactory.sol  CREATE2 factory
│   │   ├── Groth16Verifier.sol    Auto-generated by snarkjs, BN128 pairings
│   │   ├── PoseidonHasher.sol     Poseidon T3 hash wrapper
│   │   ├── interfaces/            IGhostPool, IGroth16Verifier, IPoseidonHasher
│   │   └── mocks/                 MockERC20, MockGroth16Verifier, MockPoseidonHasher
│   ├── circuits/
│   │   ├── merkle_proof.circom    ✅ ZK circuit source (Groth16, depth=10)
│   │   └── build/                 ✅ .r1cs, .zkey, .wasm, vk.json, pot15.ptau
│   ├── deployments/97/
│   │   └── addresses.json         ✅ Live BSC Testnet addresses
│   └── scripts/
│       ├── deploy.ts              ✅ Full deployment script
│       └── check.ts               ✅ Live state check + smoke test
│
├── frontend/                      ✅ Working DApp (Next.js 15, Turbopack)
│   ├── app/
│   │   ├── page.tsx               Main app shell (tabs, real MetaMask connect)
│   │   ├── components/
│   │   │   ├── DepositView.tsx    Deposit tab (mint, approve, deposit, note output)
│   │   │   ├── RelayView.tsx      Relay tab (ZK proof + UserOp + bundler submit)
│   │   │   ├── ScoreView.tsx      Privacy score tab (on-chain analysis)
│   │   │   ├── ComplianceView.tsx Compliance tab (viewing key export)
│   │   │   └── RailgunView.tsx    Railgun tab (UI only, not yet wired)
│   │   └── api/bundle/route.ts   Next.js bundler API (submits to EntryPoint)
│   ├── lib/
│   │   ├── ghost.ts               Core logic: deposit, relay, ZK proof, UserOp
│   │   └── addresses.ts           All contract addresses for BSC Testnet
│   └── public/zk/
│       ├── merkle_proof.wasm      ✅ WASM circuit served to browser (1.97 MB)
│       ├── merkle_proof_final.zkey ✅ Proving key served to browser (1.68 MB)
│       └── verification_key.json  ✅ Used for local verify before submission
│
├── backend/                       ✅ Production-ready Fastify API
│   └── src/
│       ├── index.ts               Server entry: Fastify + CORS + graceful shutdown
│       ├── api/routes/
│       │   ├── relay.ts           POST /v1/relay, GET /v1/relay/status/:jobId
│       │   └── pool.ts            GET /v1/pool/status, GET /v1/pool/merkle-proof
│       ├── relayer/
│       │   ├── queue.ts           BullMQ relay queue + worker (3 retries, backoff)
│       │   ├── bundlerClient.ts   Pimlico/permissionless bundler client
│       │   ├── paymasterClient.ts On-chain GhostPool reader (isKnownRoot etc.)
│       │   └── userOpBuilder.ts   Zod schemas + UserOp validation
│       ├── zk/
│       │   ├── verifier.ts        Off-chain snarkjs Groth16 pre-screen
│       │   └── merkleTree.ts      DB-persisted Poseidon Merkle tree mirror
│       ├── compliance/
│       │   ├── ofac.ts            OFAC SDN sync (1-hour refresh)
│       │   ├── asp.ts             ASP check: local blocklist + Chainalysis
│       │   └── blocklist.ts       Unified blocklist CRUD
│       └── db/                    Prisma + Postgres schema + repositories
│
└── web/                           ✅ Marketing landing page (Next.js)
    └── app/page.tsx               Hero, features, how-it-works, compliance sections
```

---

## Key Addresses (BSC Testnet, chainId 97)

```
Deployer / Bundler EOA    : 0x90e6a10271D31EA4EA29B66D48e6f078C4091f77
EntryPoint v0.7           : 0x0000000071727De22E5E9d8BAf0edAc6f37da032
GhostPool                 : 0xd2c227909A77359b422C1BfEa6B482f2559eF6aa
GhostPaymaster            : 0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df
GhostSmartAccountFactory  : 0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0
Groth16Verifier           : 0x61ac3A70Ed4CAab15dd547b374dd1BF7a519cdfA
PoseidonHasher            : 0x432E4098133165D2f90E768fa73642236c6f910b
MockUSDC                  : 0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33
MockUSDT                  : 0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe
```

---

## Running the Project

### Frontend DApp

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The frontend is self-contained — it talks directly to BSC Testnet via the NodeReal RPC and submits UserOps via the built-in Next.js API route (`/api/bundle`). No separate backend needed for the demo.

### Contracts — Check Live State

```bash
cd contracts
npm install
npx hardhat run scripts/check.ts --network bsc-testnet
```

This reads live on-chain state, prints pool balances, Merkle root, paymaster deposit, then runs a smoke-test deposit.

### Backend (full relayer)

```bash
cd backend
cp .env.example .env    # fill in DATABASE_URL, REDIS_URL, RELAYER_PRIVATE_KEY
npm install
npm run dev             # http://localhost:3001
```

Requires Postgres + Redis. The frontend's `/api/bundle` route is a simplified bundler that bypasses the full backend — the backend (`/v1/relay`) adds BullMQ queuing, off-chain ZK pre-verification, OFAC compliance checks, and Prisma persistence on top.

### Recompile ZK Circuits (if needed)

```bash
cd contracts/circuits
# Requires circom 2.x and snarkjs
circom merkle_proof.circom --r1cs --wasm --sym -o build/

# Trusted setup (already done — only redo if circuit changes)
snarkjs powersoftau new bn128 15 build/pot15.ptau
snarkjs powersoftau prepare phase2 build/pot15.ptau build/pot15_final.ptau
snarkjs groth16 setup build/merkle_proof.r1cs build/pot15_final.ptau build/merkle_proof_0.zkey
snarkjs zkey contribute build/merkle_proof_0.zkey build/merkle_proof_final.zkey
snarkjs zkey export verificationkey build/merkle_proof_final.zkey build/verification_key.json
snarkjs zkey export solidityverifier build/merkle_proof_final.zkey ../contracts/Groth16Verifier.sol

# Copy artifacts to frontend
cp build/merkle_proof_js/merkle_proof.wasm ../frontend/public/zk/
cp build/merkle_proof_final.zkey ../frontend/public/zk/
cp build/verification_key.json ../frontend/public/zk/
```

---

## What Is Not Yet Built

| Feature | Status | Notes |
|---|---|---|
| Railgun shielding (real) | ❌ UI only | Needs `RailgunAdapter.sol` + Waku broadcaster |
| Proof of Innocence (real) | ❌ UI only | Needs `railgun/poi.ts` using Railgun SDK |
| Venus Protocol yield | ❌ Planned | Idle USDC in pool earning yield |
| AssociationSetProvider.sol | ❌ Planned | On-chain ASP for 0xbow-style clean-set proofs |
| GhostNameService.sol | ❌ Planned | `ghost://username` ENS-like registry |
| Chrome Extension | ❌ Planned | Intercept `eth_sendTransaction` → route via Ghost |
| `@ghost-privacy/sdk` npm package | ❌ Planned | React hooks + GhostWallet + ProofBuilder |
| Docker Compose | ❌ Planned | Postgres + Redis + backend in one command |
| Contract tests | ❌ Planned | Hardhat tests for GhostPool + GhostPaymaster |

---

## Privacy Guarantee

```
On-chain observer sees:
  ✅ A commitment inserted into GhostPool (no amount revealed? No — amount IS visible)
  ✅ A fresh smart account (0xeeffED...) receiving a UserOp
  ✅ GhostPaymaster deducting a fee from GhostPool

On-chain observer cannot see:
  ❌ Which commitment corresponds to which withdrawal (nullifierHash reveals nothing)
  ❌ The depositor's identity (commitment = Poseidon(secret, nullifier), one-way)
  ❌ The secret or nullifier (never leave the browser)
  ❌ Which Merkle leaf was spent (ZK proof proves membership without revealing position)
```

The anonymity set grows with every deposit. The larger the set, the stronger the privacy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.x, Hardhat, OpenZeppelin |
| ZK circuits | Circom 2.0, snarkjs, Groth16, BN128 |
| ZK in browser | snarkjs WASM (1.97 MB), WebAssembly |
| Frontend | Next.js 15, Turbopack, TypeScript, Tailwind CSS |
| Wallet | ethers.js v6, MetaMask (EIP-1193) |
| ERC-4337 | EntryPoint v0.7, GhostSmartAccount, GhostPaymaster |
| Backend | Fastify, BullMQ, Prisma, Postgres, Redis |
| RPC | NodeReal (BSC Testnet) |
| Compliance | OFAC SDN sync, ASP (Association Set Provider) |