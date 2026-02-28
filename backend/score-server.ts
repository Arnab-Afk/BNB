/**
 * score-server.ts — Standalone privacy score API server
 *
 * All data fetched via batched NodeReal BSC Testnet JSON-RPC calls.
 * No BscScan, no Prisma, no Redis.
 *
 * Strategy:
 *   Batch-1 (1 HTTP):  eth_blockNumber + eth_getTransactionCount + eth_getBalance
 *   Batch-2 (1 HTTP):  eth_getLogs ×4  (Ghost deposits, withdrawals, ERC-20 sent/recv)
 *   Batch-3 (1 HTTP):  eth_getTransactionByHash × ghost deposit txs (resolve senders)
 *   Wallet-age:        binary-search with 4 batched nonce probes per HTTP round-trip
 *
 * Run: npx tsx score-server.ts
 * API: GET http://localhost:3001/v1/score/:address
 *      GET http://localhost:3001/v1/profile/:address  — full wallet profile
 *      GET http://localhost:3001/v1/health
 */

import Fastify from "fastify";
import cors from "@fastify/cors";

const PORT = 3001;
const GHOST_POOL    = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa".toLowerCase();
const NODEREAL_RPC  = "https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e";

// Event topic signatures
const DEPOSIT_TOPIC    = "0x0cd0d2a9a5f11cb2e2c580eb62a04a7c5a1a7e78baecf2e94c6e8bf3b65f0dce"; // Deposit(bytes32,uint32,uint256,address,uint256)
const TRANSFER_TOPIC   = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)
const WITHDRAWAL_TOPIC = "0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364"; // Withdrawal(address,bytes32,uint256)

// Known CEX hot wallets — any interaction reveals KYC linkage
const KNOWN_CEX = new Map<string, string>([
    ["0x8894e0a0c962cb723c1976a4421c95949be2d4e3", "Binance Hot Wallet"],
    ["0x28c6c06298d514db089934071355e5743bf21d60", "Binance 14"],
    ["0xdfd5293d8e347dfe59e90efd55b2956a1343963d", "Binance 16"],
    ["0x21a31ee1afc51d94c2efccaa2092ad1028285549", "Binance 15"],
    ["0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be", "Binance 7"],
    ["0xcffad3200574698b78f32232aa9d63eabd290703", "OKX"],
    ["0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", "OKX 2"],
    ["0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43", "Coinbase"],
]);

// ── Batch JSON-RPC engine ──────────────────────────────────────────────────────

interface RpcRequest  { method: string; params: unknown[] }
interface RpcResponse<T = unknown> {
    id: number;
    result?: T;
    error?: { code: number; message: string };
}

let _nextId = 1;

async function batchRpc(requests: RpcRequest[]): Promise<RpcResponse[]> {
    const ids  = requests.map(() => _nextId++);
    const body = requests.map((r, i) => ({
        jsonrpc: "2.0", id: ids[i], method: r.method, params: r.params,
    }));
    try {
        const res = await fetch(NODEREAL_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) return ids.map((id) => ({ id }));
        const raw = await res.json();
        const arr: RpcResponse[] = Array.isArray(raw) ? raw : [raw];
        const byId = new Map(arr.map((r) => [r.id, r]));
        return ids.map((id) => byId.get(id) ?? { id });
    } catch (err) {
        console.error("batchRpc error:", err);
        return ids.map((id) => ({ id }));
    }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
    const [r] = await batchRpc([{ method, params }]);
    if (r?.error) console.error(`RPC ${method}:`, r.error.message);
    return (r?.result as T) ?? null;
}

interface Log {
    transactionHash: string;
    blockNumber: string;
    topics: string[];
    address: string;
    data: string;
}

interface TxInfo {
    from: string;
    to: string | null;
    hash: string;
    blockNumber: string;
    value: string;
    input: string;
}

// ── Wallet age: binary-search with 4 batched probes per round-trip ─────────────

async function findFirstTxBlock(address: string, hi: number): Promise<number | null> {
    let lo = 0;
    while (lo < hi) {
        const span  = hi - lo;
        const count = Math.min(4, span);
        // Evenly-spaced probes within [lo, hi]
        const probes = Array.from({ length: count }, (_, i) =>
            lo + Math.floor((span * (i + 1)) / (count + 1))
        );
        const results = await batchRpc(
            probes.map((block) => ({
                method: "eth_getTransactionCount",
                params: [address, "0x" + block.toString(16)],
            }))
        );
        let narrowed = false;
        for (let i = 0; i < probes.length; i++) {
            const n = parseInt((results[i]?.result as string) ?? "0x0", 16);
            if (n > 0) { hi = probes[i]; narrowed = true; break; }
        }
        if (!narrowed) lo = probes[probes.length - 1] + 1;
    }
    const check = await rpc<string>("eth_getTransactionCount", [address, "0x" + lo.toString(16)]);
    return parseInt(check ?? "0x0", 16) > 0 ? lo : null;
}

// ── Full wallet profile ────────────────────────────────────────────────────────

async function buildProfile(address: string) {
    const lowerAddr  = address.toLowerCase();
    const paddedAddr = "0x" + lowerAddr.slice(2).padStart(64, "0");

    // ── Batch-1: block + nonce + balance  (1 HTTP request) ────────────────────
    const [b1Block, b1Nonce, b1Balance] = await batchRpc([
        { method: "eth_blockNumber",         params: [] },
        { method: "eth_getTransactionCount", params: [address, "latest"] },
        { method: "eth_getBalance",          params: [address, "latest"] },
    ]);

    const currentBlock = parseInt((b1Block.result   as string) ?? "0x0", 16);
    const nonce        = parseInt((b1Nonce.result    as string) ?? "0x0", 16);
    const balanceWei   = BigInt((b1Balance.result    as string) ?? "0x0");
    const balanceBnb   = Number(balanceWei) / 1e18;
    const toBlock      = "0x" + currentBlock.toString(16);

    // ── Batch-2: four log queries  (1 HTTP request) ────────────────────────────
    const [b2Dep, b2Wdr, b2Sent, b2Recv] = await batchRpc([
        // All Ghost Pool Deposit events — we filter by sender in Batch-3
        { method: "eth_getLogs", params: [{ address: GHOST_POOL, topics: [DEPOSIT_TOPIC], fromBlock: "0x0", toBlock }] },
        // Ghost Pool Withdrawal events with this address as first indexed arg
        { method: "eth_getLogs", params: [{ address: GHOST_POOL, topics: [WITHDRAWAL_TOPIC, paddedAddr], fromBlock: "0x0", toBlock }] },
        // ERC-20 Transfer sent by this address (topic[1] = from)
        { method: "eth_getLogs", params: [{ topics: [TRANSFER_TOPIC, paddedAddr], fromBlock: "0x0", toBlock }] },
        // ERC-20 Transfer received by this address (topic[2] = to)
        { method: "eth_getLogs", params: [{ topics: [TRANSFER_TOPIC, null, paddedAddr], fromBlock: "0x0", toBlock }] },
    ]);

    const ghostDepositLogs  = (b2Dep.result  as Log[]) ?? [];
    const ghostWithdrawLogs = (b2Wdr.result  as Log[]) ?? [];
    const erc20SentLogs     = (b2Sent.result as Log[]) ?? [];
    const erc20RecvLogs     = (b2Recv.result as Log[]) ?? [];

    // ── Batch-3: resolve Ghost Pool deposit senders  (1 HTTP request) ─────────
    let ghostDeposits = 0;
    const ghostTxDetails: Array<{ hash: string; blockNumber: number }> = [];

    if (ghostDepositLogs.length > 0) {
        const uniqueHashes = [...new Set(ghostDepositLogs.map((l) => l.transactionHash))];
        const batch3 = await batchRpc(
            uniqueHashes.map((h) => ({ method: "eth_getTransactionByHash", params: [h] }))
        );
        for (let i = 0; i < uniqueHashes.length; i++) {
            const tx = batch3[i]?.result as TxInfo | null;
            if (tx?.from?.toLowerCase() === lowerAddr) {
                ghostDeposits++;
                ghostTxDetails.push({ hash: uniqueHashes[i], blockNumber: parseInt(tx.blockNumber, 16) });
            }
        }
    }

    const ghostWithdrawals = ghostWithdrawLogs.length;

    // ── Analyze ERC-20 activity ───────────────────────────────────────────────
    const sentTokens     = new Set<string>();
    const recvTokens     = new Set<string>();
    const counterparties = new Set<string>();
    const cexHits: string[] = [];

    for (const log of erc20SentLogs) {
        sentTokens.add(log.address.toLowerCase());
        const to = log.topics[2] ? "0x" + log.topics[2].slice(26).toLowerCase() : null;
        if (to && to !== lowerAddr) {
            counterparties.add(to);
            const name = KNOWN_CEX.get(to);
            if (name && !cexHits.includes(name)) cexHits.push(name);
        }
    }
    for (const log of erc20RecvLogs) {
        recvTokens.add(log.address.toLowerCase());
        const from = log.topics[1] ? "0x" + log.topics[1].slice(26).toLowerCase() : null;
        if (from && from !== lowerAddr) {
            counterparties.add(from);
            const name = KNOWN_CEX.get(from);
            if (name && !cexHits.includes(name)) cexHits.push(name);
        }
    }

    const uniqueTokens = new Set([...sentTokens, ...recvTokens]);
    const cpCount      = counterparties.size;
    const hasCex       = cexHits.length > 0;

    // ── Wallet age  (binary search, batched probes) ───────────────────────────
    let walletAge     = "No history";
    let walletAgeDays: number | null = null;
    let firstTxBlock: number | null  = null;

    if (nonce > 0) {
        firstTxBlock = await findFirstTxBlock(address, currentBlock);
        if (firstTxBlock !== null) {
            const blk = await rpc<{ timestamp: string }>(
                "eth_getBlockByNumber", ["0x" + firstTxBlock.toString(16), false]
            );
            if (blk?.timestamp) {
                const ts  = parseInt(blk.timestamp, 16);
                walletAgeDays = (Date.now() / 1000 - ts) / 86400;
                walletAge = walletAgeDays < 1  ? "<1 day"
                    : walletAgeDays < 7  ? `${Math.floor(walletAgeDays)}d`
                    : walletAgeDays < 30 ? `${Math.floor(walletAgeDays / 7)}w`
                    : `${Math.floor(walletAgeDays / 30)}mo`;
            }
        }
    }

    // ── Score components ──────────────────────────────────────────────────────
    const ghostScore = ghostDeposits === 0 ? 0 : ghostDeposits === 1 ? 20 : ghostDeposits === 2 ? 28 : 35;

    const ageScore = walletAgeDays === null ? 15
        : walletAgeDays < 1  ? 15 : walletAgeDays < 7  ? 12
        : walletAgeDays < 30 ? 8  : walletAgeDays < 90 ? 4 : 0;

    const txScore = nonce === 0 ? 20 : nonce < 5 ? 18 : nonce < 15 ? 14
        : nonce < 30 ? 10 : nonce < 60 ? 6 : nonce < 100 ? 3 : 0;

    const cpScore = cpCount === 0 ? 15 : cpCount < 3 ? 13 : cpCount < 8 ? 10
        : cpCount < 20 ? 6 : cpCount < 50 ? 3 : 0;

    const cexScore = hasCex ? 0 : 15;

    const score = Math.min(100, ghostScore + ageScore + txScore + cpScore + cexScore);
    const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

    // ── Tips ──────────────────────────────────────────────────────────────────
    const tips: string[] = [];
    if (ghostDeposits === 0)
        tips.push("Deposit into Ghost Pool — break the on-chain link between your wallets.");
    if (hasCex)
        tips.push(`CEX interaction detected (${cexHits.join(", ")}). Deposit address may be KYC-linked.`);
    if (nonce >= 30)
        tips.push("High tx count. Use a fresh wallet for private operations.");
    if (uniqueTokens.size > 5)
        tips.push("Many token contracts used — correlates wallets across protocols.");
    if (ghostDeposits > 0 && ghostDeposits < 3)
        tips.push("More Ghost deposits grow your anonymity set.");
    if (tips.length === 0)
        tips.push("Excellent privacy hygiene. Keep using Ghost Pool and avoid address reuse.");

    return {
        address,
        score,
        grade,
        components: {
            ghostDeposits:  { score: ghostScore, max: 35, raw: ghostDeposits,  label: "Ghost Pool deposits" },
            walletAge:      { score: ageScore,   max: 15, raw: walletAge,      label: "Wallet age" },
            txVolume:       { score: txScore,    max: 20, raw: nonce,          label: "Outgoing tx count" },
            counterparties: { score: cpScore,    max: 15, raw: cpCount,        label: "Unique ERC-20 counterparties" },
            cexExposure:    { score: cexScore,   max: 15, raw: hasCex ? `Detected: ${cexHits.join(", ")}` : "None", hasCex, label: "CEX exposure" },
        },
        profile: {
            balanceBnb:    Number(balanceBnb.toFixed(6)),
            nonce,
            walletAge,
            walletAgeDays: walletAgeDays !== null ? Math.round(walletAgeDays * 10) / 10 : null,
            firstTxBlock,
            currentBlock,
        },
        activity: {
            outgoingTxs:    nonce,
            erc20Sent:      erc20SentLogs.length,
            erc20Received:  erc20RecvLogs.length,
            uniqueTokens:   uniqueTokens.size,
            tokenContracts: [...uniqueTokens],
            counterparties: cpCount,
            ghostDeposits,
            ghostWithdrawals,
            ghostTxs:       ghostTxDetails,
            cex: { detected: hasCex, exchanges: cexHits },
        },
        tips,
        analysedAt: new Date().toISOString(),
    };
}

// ── Fastify server ─────────────────────────────────────────────────────────────

const server = Fastify({ logger: true });

await server.register(cors, {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    methods: ["GET", "OPTIONS"],
});

server.get("/v1/health", async () => ({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    service: "ghost-score-server",
    rpc: NODEREAL_RPC.replace(/\/v1\/.*/, ""),
}));

server.get<{ Params: { address: string } }>("/v1/score/:address", async (req, reply) => {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
        return reply.status(400).send({ error: "INVALID_ADDRESS" });
    try { return await buildProfile(address); }
    catch (err) { req.log.error(err); return reply.status(500).send({ error: "SCORE_FAILED" }); }
});

server.get<{ Params: { address: string } }>("/v1/profile/:address", async (req, reply) => {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
        return reply.status(400).send({ error: "INVALID_ADDRESS" });
    try { return await buildProfile(address); }
    catch (err) { req.log.error(err); return reply.status(500).send({ error: "PROFILE_FAILED" }); }
});

try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`\n👻 Ghost Score Server  →  http://localhost:${PORT}`);
    console.log(`   /v1/score/:address   — privacy score + full profile`);
    console.log(`   /v1/profile/:address — same, explicit route`);
    console.log(`   /v1/health           — health check\n`);
} catch (err) {
    server.log.error(err);
    process.exit(1);
}

