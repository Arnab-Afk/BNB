/**
 * ghost.ts — Core Ghost Protocol business logic
 *
 * Full ERC-4337 UserOperation flow:
 *   1. Wallet connection (MetaMask)
 *   2. Deposit: mint → approve → GhostPool.deposit() → Ghost Note
 *   3. Relay: parse note → ZK proof → build PackedUserOp → POST /api/bundle
 *      ↳ Bundler calls EntryPoint.handleOps()
 *      ↳ GhostPaymaster pays BNB gas from its EntryPoint deposit
 *      ↳ GhostPaymaster.postOp() calls GhostPool.deductFee() in USDC
 *      ↳ Fresh wallet executes its calldata with ZERO BNB from its own balance
 */

import { ethers } from "ethers";
import { ADDRESSES, BSC_TESTNET, TREE_DEPTH, ZERO_VALUE, ZEROS } from "./addresses";
import { ERC20_ABI, GHOST_POOL_ABI } from "./abis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GhostNote {
    secret: bigint;
    nullifier: bigint;
    amount: string;
    token: "USDC" | "USDT";
    tokenAddr: string;
    leafIndex: number;
    commitment: bigint;
    raw: string;
}

export interface DepositProgress {
    step: "checking" | "approving" | "committing" | "done" | "error";
    message: string;
    txHash?: string;
    note?: string;
    error?: string;
}

export interface RelayProgress {
    step: "tree" | "proving" | "building" | "submitting" | "done" | "error";
    message: string;
    pct: number;
    txHash?: string;
    smartAccount?: string;
    error?: string;
}

// ─── PackedUserOperation (ERC-4337 v0.7) ─────────────────────────────────────

export interface PackedUserOperation {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    accountGasLimits: string;
    preVerificationGas: string;
    gasFees: string;
    paymasterAndData: string;
    signature: string;
}

// ─── Providers ────────────────────────────────────────────────────────────────
//
//  getProvider()    → MetaMask BrowserProvider  (signing only)
//  getRpcProvider() → Direct JsonRpcProvider    (all read calls — bypasses MetaMask
//                                                to avoid eth_maxPriorityFeePerGas
//                                                and eth_getLogs range errors)

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
    ?? (() => { throw new Error("Missing env: NEXT_PUBLIC_RPC_URL — add it to frontend/.env.local"); })();

/** Read-only provider — talks directly to NodeReal, never through MetaMask. */
export function getRpcProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(RPC_URL);
}

/** MetaMask provider — only use for signing / sending wallet txs. */
export async function getProvider(): Promise<ethers.BrowserProvider> {
    if (typeof window === "undefined" || !window.ethereum)
        throw new Error("MetaMask not found. Install it from metamask.io");
    return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

export async function ensureBscTestnet(): Promise<void> {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
    if (chainId === BSC_TESTNET.chainId) return;
    try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_TESTNET.chainId }] });
    } catch {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [BSC_TESTNET] });
    }
}

export async function connectWallet(): Promise<string> {
    if (!window.ethereum) throw new Error("MetaMask not found");
    await ensureBscTestnet();
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    return accounts[0];
}

// ─── Poseidon (circomlibjs, lazy) ─────────────────────────────────────────────

let _poseidon: ((inputs: bigint[]) => bigint) | null = null;

export async function getPoseidon(): Promise<(inputs: bigint[]) => bigint> {
    if (_poseidon) return _poseidon;
    const { buildPoseidon } = await import("circomlibjs");
    const p = await buildPoseidon();
    _poseidon = (inputs: bigint[]) => p.F.toObject(p(inputs));
    return _poseidon;
}

// ─── Incremental Merkle Tree ──────────────────────────────────────────────────


export interface MerklePath {
    pathElements: bigint[];
    pathIndices: number[];
    root: bigint;
}

export async function getMerklePath(targetLeafIndex: number): Promise<MerklePath> {
    const provider = getRpcProvider();  // ← direct RPC, not MetaMask
    const pool = new ethers.Contract(ADDRESSES.GhostPool, GHOST_POOL_ABI, provider);
    const poseidon = await getPoseidon();
    // Use zeros read directly from the contract (in addresses.ts ZEROS array)
    const zeros = ZEROS;

    // ── Chunked eth_getLogs to stay within NodeReal's 5000-block limit ──────────
    // BSC testnet runs at ~3 blocks/sec. 60,000 blocks = ~5.5 hours back.
    // All our deposits happened today, so this window always covers them.
    const CHUNK = 5_000;
    const LOOK_BACK = 60_000;
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - LOOK_BACK);

    const allEvents: ethers.EventLog[] = [];
    for (let start = fromBlock; start <= latest; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, latest);
        const events = await pool.queryFilter(pool.filters.Deposit(), start, end);
        for (const ev of events) allEvents.push(ev as ethers.EventLog);
    }

    // ── Fill leaves ─────────────────────────────────────────────────────────────
    const leaves: bigint[] = Array(2 ** TREE_DEPTH).fill(ZEROS[0]);
    for (const ev of allEvents) {
        leaves[Number(ev.args.leafIndex)] = BigInt(ev.args.commitment);
    }

    // ── Build full Merkle tree ───────────────────────────────────────────────────
    const allLayers: bigint[][] = [leaves];
    for (let depth = 0; depth < TREE_DEPTH; depth++) {
        const prev = allLayers[depth];
        const nextLayer: bigint[] = [];
        for (let i = 0; i < prev.length; i += 2) {
            nextLayer.push(poseidon([prev[i] ?? zeros[depth], prev[i + 1] ?? zeros[depth]]));
        }
        allLayers.push(nextLayer);
    }

    const root = allLayers[TREE_DEPTH][0];

    // ── Sanity-check: compare with on-chain root ─────────────────────────────────
    const onChainRoot = await pool.getLastRoot();
    if (root !== BigInt(onChainRoot)) {
        console.warn("[ghost] computed root:", root.toString(16));
        console.warn("[ghost] on-chain root:", BigInt(onChainRoot).toString(16));
        throw new Error(
            `Merkle root mismatch — computed root doesn't match chain.\n` +
            `This usually means some Deposit events fell outside the ${LOOK_BACK}-block window.\n` +
            `Contact support or wait for the look-back window fix.`
        );
    }

    // ── Extract Merkle path for targetLeafIndex ──────────────────────────────────
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = targetLeafIndex;

    for (let depth = 0; depth < TREE_DEPTH; depth++) {
        const isRight = idx % 2;
        const sibling = isRight ? idx - 1 : idx + 1;
        pathIndices.push(isRight);
        pathElements.push(allLayers[depth][sibling] ?? zeros[depth]);
        idx = Math.floor(idx / 2);
    }

    return { pathElements, pathIndices, root };
}


// ─── Ghost Note encoding / decoding ──────────────────────────────────────────

export function encodeNote(
    secret: bigint,
    nullifier: bigint,
    amount: string,
    token: "USDC" | "USDT",
    leafIndex: number,
    commitment: bigint,
): string {
    return [
        "ghost:v1",
        secret.toString(16).padStart(64, "0"),
        nullifier.toString(16).padStart(64, "0"),
        amount,
        token,
        leafIndex.toString(),
        commitment.toString(16).padStart(64, "0"),
    ].join(":");
}

export function decodeNote(raw: string): GhostNote {
    // Format: ghost:v1:secretHex:nullifierHex:amount:token:leafIndex:commitmentHex = 8 parts
    const parts = raw.trim().split(":");
    if (parts.length !== 8 || parts[0] !== "ghost" || parts[1] !== "v1")
        throw new Error(`Invalid Ghost Note - got ${parts.length} parts, need 8: ghost:v1:secret:nullifier:amount:token:leafIndex:commitment`);
    return {
        secret: BigInt("0x" + parts[2]),
        nullifier: BigInt("0x" + parts[3]),
        amount: parts[4],
        token: parts[5] as "USDC" | "USDT",
        tokenAddr: parts[5] === "USDC" ? ADDRESSES.USDC : ADDRESSES.USDT,
        leafIndex: Number(parts[6]),
        commitment: BigInt("0x" + parts[7]),
        raw,
    };
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

export async function deposit(
    amount: string,
    token: "USDC" | "USDT",
    onProgress: (p: DepositProgress) => void,
): Promise<void> {
    try {
        const provider = await getProvider();
        await ensureBscTestnet();
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const tokenAddr = token === "USDC" ? ADDRESSES.USDC : ADDRESSES.USDT;
        const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
        const pool = new ethers.Contract(ADDRESSES.GhostPool, GHOST_POOL_ABI, signer);
        const decimals = await erc20.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);

        onProgress({ step: "checking", message: `Checking ${token} balance…` });
        const balance = await erc20.balanceOf(address);
        if (balance < amountWei) {
            const have = ethers.formatUnits(balance, decimals);
            throw new Error(
                `Insufficient ${token} balance. You have ${have} ${token}, need ${amount}.\n` +
                `Get testnet USDC from the PancakeSwap testnet faucet or bridge from another testnet.`
            );
        }

        onProgress({ step: "approving", message: `Approving GhostPool to spend ${amount} ${token}…` });
        await (await erc20.approve(ADDRESSES.GhostPool, amountWei)).wait();

        onProgress({ step: "committing", message: "Generating Poseidon commitment…" });
        const poseidon = await getPoseidon();

        const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
        const secret = BigInt("0x" + toHex(crypto.getRandomValues(new Uint8Array(31))));
        const nullifier = BigInt("0x" + toHex(crypto.getRandomValues(new Uint8Array(31))));
        const commitment = poseidon([secret, nullifier]);

        const leafIndexBefore = Number(await new ethers.Contract(ADDRESSES.GhostPool, GHOST_POOL_ABI, getRpcProvider()).nextLeafIndex());
        // ethers.toBeHex(bigint, 32) correctly pads to 32 bytes — avoids "invalid BytesLike"
        // when commitment.toString(16) is odd-length (e.g. 63 hex chars = 31.5 bytes)
        const commitBytes32 = ethers.toBeHex(commitment, 32) as `0x${string}`;
        const receipt = await (await pool.deposit(commitBytes32, amountWei, tokenAddr)).wait();

        onProgress({
            step: "done",
            message: "Deposit confirmed!",
            txHash: receipt.hash,
            note: encodeNote(secret, nullifier, amount, token, leafIndexBefore, commitment),
        });
    } catch (e: unknown) {
        const err = e as { message?: string; reason?: string };
        onProgress({ step: "error", message: "Deposit failed", error: err.reason ?? err.message ?? String(e) });
    }
}

// ─── ZK Proof generation ──────────────────────────────────────────────────────

import type { Groth16Proof } from "snarkjs";

export interface ZKResult {
    proof: Groth16Proof;
    publicSignals: string[];
    nullifierHash: bigint;
    root: bigint;
}

export async function generateProof(
    noteRaw: string,
    recipient: string,           // the smart account address (userOp.sender)
    onProgress: (p: RelayProgress) => void,
): Promise<ZKResult> {
    onProgress({ step: "tree", pct: 10, message: "Fetching Merkle tree from chain…" });

    const note = decodeNote(noteRaw);
    const poseidon = await getPoseidon();
    const nullifierHash = poseidon([note.nullifier]);
    const { pathElements, pathIndices, root } = await getMerklePath(note.leafIndex);

    onProgress({ step: "proving", pct: 35, message: "Running Groth16 circuit (WASM in browser)…" });

    const snarkjs = await import("snarkjs");

    const [wasmBuf, zkeyBuf] = await Promise.all([
        fetch("/zk/merkle_proof.wasm").then(r => r.arrayBuffer()),
        fetch("/zk/merkle_proof_final.zkey").then(r => r.arrayBuffer()),
    ]);

    const input = {
        secret: note.secret.toString(),
        nullifier: note.nullifier.toString(),
        pathElements: pathElements.map(e => e.toString()),
        pathIndices,
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient: BigInt(recipient).toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        new Uint8Array(wasmBuf),
        new Uint8Array(zkeyBuf),
    );

    onProgress({ step: "proving", pct: 80, message: "Proof generated — verifying locally…" });

    const vk = await fetch("/zk/verification_key.json").then(r => r.json());
    const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
    if (!valid) throw new Error("Local proof verification failed!");

    return { proof, publicSignals, nullifierHash, root };
}

// ─── paymasterAndData builder ─────────────────────────────────────────────────
//
// Layout (after EntryPoint's 52 bytes of address+gasLimits):
//   [0:32]   validUntil  (uint256, 0 = no expiry)
//   [32:64]  validAfter  (uint256, 0 = no delay)
//   [64:96]  feeToken    (address, 0-padded to 32 bytes)
//   [96:]    abi.encode(pA, pB, pC, pubSignals)
//
// Full paymasterAndData = GhostPaymaster addr (20B) + verGasLimit (16B) + postOpGasLimit (16B) + above
// The first 52 bytes are stripped by BasePaymaster (PAYMASTER_DATA_OFFSET = 52).

function buildPaymasterAndData(
    proof: Groth16Proof,
    root: bigint,
    nullifierHash: bigint,
    recipient: string,
    feeToken: string,
): string {
    const validUntil = 0n;
    const validAfter = 0n;

    const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])], // note: B is swapped for Groth16 on-chain
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
    // pubSignals = [root, nullifierHash, recipient]
    const pubSignals: [bigint, bigint, bigint] = [root, nullifierHash, BigInt(recipient)];

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[3]"],
        [pA, pB, pC, pubSignals],
    );

    // Header: validUntil(32) + validAfter(32) + feeToken(32)
    const header = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address"],
        [validUntil, validAfter, feeToken],
    );

    // EntryPoint strips first 52 bytes (20 addr + 16 verGasLimit + 16 postOpGasLimit)
    // So paymasterAndData = GhostPaymaster(20) + verGasLim(16) + postOpGasLim(16) + header + proofEncoded
    // Groth16 on-chain verification costs ~500k-800k gas.
    // AA23 revert with empty inner data = out-of-gas in validatePaymasterUserOp.
    const verificationGasLimit = ethers.zeroPadValue(ethers.toBeHex(900_000n), 16);
    const postOpGasLimit = ethers.zeroPadValue(ethers.toBeHex(200_000n), 16);

    return ethers.concat([
        ADDRESSES.GhostPaymaster,
        verificationGasLimit,
        postOpGasLimit,
        header,
        encoded,
    ]);
}

// ─── Pack accountGasLimits and gasFees (ERC-4337 v0.7 packed format) ─────────

function packGasLimits(verificationGas: bigint, callGas: bigint): string {
    // accountGasLimits = verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
    const hi = ethers.zeroPadValue(ethers.toBeHex(verificationGas), 16);
    const lo = ethers.zeroPadValue(ethers.toBeHex(callGas), 16);
    return ethers.concat([hi, lo]);
}

function packGasFees(maxPriorityFee: bigint, maxFee: bigint): string {
    const hi = ethers.zeroPadValue(ethers.toBeHex(maxPriorityFee), 16);
    const lo = ethers.zeroPadValue(ethers.toBeHex(maxFee), 16);
    return ethers.concat([hi, lo]);
}

// ─── Smart Account address prediction ────────────────────────────────────────

const FACTORY_ABI = [
    "function getAddress(address owner, uint256 salt) view returns (address)",
    "function createAccount(address owner, uint256 salt) returns (address)",
];

export async function getSmartAccountAddress(owner: string, salt: bigint): Promise<string> {
    const factory = new ethers.Contract(ADDRESSES.GhostSmartAccountFactory, FACTORY_ABI, getRpcProvider());
    return await factory.getFunction("getAddress(address,uint256)")(owner, salt);
}

// ─── Build initCode (deploys smart account on first UserOp) ──────────────────

function buildInitCode(owner: string, salt: bigint): string {
    const iface = new ethers.Interface(FACTORY_ABI);
    const calldata = iface.encodeFunctionData("createAccount", [owner, salt]);
    return ethers.concat([ADDRESSES.GhostSmartAccountFactory, calldata]);
}

// ─── Relay via ERC-4337 ───────────────────────────────────────────────────────

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) view returns (uint256)",
    "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
];

export async function relay(
    noteRaw: string,
    callTarget: string,   // address the smart account should call
    callValue: bigint,   // BNB value to send
    callData: string,   // calldata for the target
    onProgress: (p: RelayProgress) => void,
): Promise<void> {
    try {
        // MetaMask — for signing only
        const mmProvider = await getProvider();
        await ensureBscTestnet();
        const signer = await mmProvider.getSigner();
        const ownerAddr = await signer.getAddress();

        // Direct RPC — for all reads (avoids MetaMask eth_maxPriorityFeePerGas / eth_getLogs limits)
        const rpc = getRpcProvider();
        const note = decodeNote(noteRaw);

        // ── 1. Compute smart account address ────────────────────────────────────
        onProgress({ step: "building", pct: 5, message: "Computing smart account address…" });

        const salt = 0n;
        const factory = new ethers.Contract(ADDRESSES.GhostSmartAccountFactory, FACTORY_ABI, rpc);
        const smartAccount = await factory.getFunction("getAddress(address,uint256)")(ownerAddr, salt);

        // ── 2. Check deployment ──────────────────────────────────────────────────
        const code = await rpc.getCode(smartAccount);
        const isDeployed = code !== "0x";
        const initCode = isDeployed ? "0x" : buildInitCode(ownerAddr, salt);

        // ── 3. Nonce ─────────────────────────────────────────────────────────────
        const ep = new ethers.Contract(ADDRESSES.entryPoint, ENTRY_POINT_ABI, rpc);
        const nonce = await ep.getNonce(smartAccount, 0n);

        // ── 4. BSC gas price (legacy — BSC does NOT support EIP-1559) ─────────────
        //    eth_gasPrice returns the current gas price in wei.
        //    We add a small 20% tip to avoid pending-tx issues.
        const gasPriceHex = await rpc.send("eth_gasPrice", []) as string;
        const gasPrice = BigInt(gasPriceHex);
        const gasFeeHigh = (gasPrice * 120n) / 100n;  // +20% bump

        // ── 5. callData to execute inside the smart account ──────────────────────
        const gsaIface = new ethers.Interface(["function execute(address target, uint256 value, bytes calldata data) external"]);
        const execCall = gsaIface.encodeFunctionData("execute", [callTarget, callValue, callData]);

        // ── 6. ZK proof ───────────────────────────────────────────────────────────
        onProgress({ step: "tree", pct: 10, message: "Fetching Merkle tree from chain…" });
        const zkResult = await generateProof(noteRaw, smartAccount, onProgress);

        // ── 7. paymasterAndData ────────────────────────────────────────────────────
        onProgress({ step: "building", pct: 88, message: "Building UserOperation…" });

        const paymasterAndData = buildPaymasterAndData(
            zkResult.proof,
            zkResult.root,
            zkResult.nullifierHash,
            smartAccount,
            note.tokenAddr,
        );

        // gasFees for BSC legacy: pack (gasPrice, gasPrice*1.2) as maxPriorityFee | maxFee
        const partialOp: PackedUserOperation = {
            sender: smartAccount,
            nonce: nonce.toString(),
            initCode,
            callData: execCall,
            accountGasLimits: packGasLimits(500_000n, 300_000n),
            preVerificationGas: "300000",
            gasFees: packGasFees(gasPrice, gasFeeHigh),
            paymasterAndData,
            signature: "0x",
        };

        // ── 8. Sign ───────────────────────────────────────────────────────────────
        const userOpHash = await ep.getUserOpHash(partialOp);
        const sig = await signer.signMessage(ethers.getBytes(userOpHash));
        const finalOp: PackedUserOperation = { ...partialOp, signature: sig };

        // ── 9. Submit to bundler API ───────────────────────────────────────────────
        onProgress({ step: "submitting", pct: 93, message: "Submitting via Ghost Bundler — BNB gas paid by Paymaster…" });

        const res = await fetch("/api/bundle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userOp: finalOp }),
        });
        const data = await res.json() as { txHash?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Bundler returned error");

        onProgress({ step: "done", pct: 100, message: "Transaction confirmed!", txHash: data.txHash, smartAccount });

    } catch (e: unknown) {
        const err = e as { message?: string; reason?: string; shortMessage?: string };
        onProgress({
            step: "error", pct: 0,
            message: "Relay failed",
            error: err.shortMessage ?? err.reason ?? err.message ?? String(e),
        });
    }
}


