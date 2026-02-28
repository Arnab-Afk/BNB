/**
 * score-server.ts — Standalone privacy score API server
 *
 * Zero external dependencies: no Postgres, no Redis, no Prisma.
 * Just Fastify + viem + BscScan public API.
 *
 * Run: npx tsx score-server.ts
 * API: GET http://localhost:3001/v1/score/:address
 *      GET http://localhost:3001/v1/health
 */

import Fastify from "fastify";
import cors from "@fastify/cors";

const PORT = 3001;
const GHOST_POOL = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa".toLowerCase();
const BSCSCAN_API = "https://api-testnet.bscscan.com/api";

// ── BscScan helpers ────────────────────────────────────────────────────────────

interface TxRecord {
    from: string;
    to: string;
    blockNumber: string;
    timeStamp: string;
    isError: string;
}

async function fetchBscScan(params: Record<string, string>): Promise<TxRecord[]> {
    const qs = new URLSearchParams({ apikey: "YourApiKeyToken", ...params });
    try {
        const res = await fetch(`${BSCSCAN_API}?${qs}`);
        if (!res.ok) return [];
        const json = await res.json() as { status: string; result: TxRecord[] };
        return json.status === "1" && Array.isArray(json.result) ? json.result : [];
    } catch {
        return [];
    }
}

// ── Score computation ──────────────────────────────────────────────────────────

async function computeScore(address: string) {
    const lowerAddr = address.toLowerCase();

    const [txs, firstTxs] = await Promise.all([
        fetchBscScan({
            module: "account", action: "txlist", address,
            startblock: "0", endblock: "99999999",
            page: "1", offset: "200", sort: "desc",
        }),
        fetchBscScan({
            module: "account", action: "txlist", address,
            startblock: "0", endblock: "99999999",
            page: "1", offset: "1", sort: "asc",
        }),
    ]);

    // Ghost Pool interactions
    const ghostDeposits = txs.filter(
        (tx) => tx.to?.toLowerCase() === GHOST_POOL && tx.isError === "0"
    ).length;
    const ghostScore = ghostDeposits === 0 ? 0
        : ghostDeposits === 1 ? 20
            : ghostDeposits === 2 ? 28
                : 35;

    // Wallet age (from first tx timestamp)
    let ageScore = 15, ageLabel = "No history (fresh wallet)";
    if (firstTxs.length > 0) {
        const firstTs = Number(firstTxs[0].timeStamp);
        const ageDays = (Date.now() / 1000 - firstTs) / 86400;
        ageLabel = ageDays < 1 ? "<1 day old"
            : ageDays < 7 ? `${Math.floor(ageDays)}d old`
                : ageDays < 30 ? `${Math.floor(ageDays / 7)}w old`
                    : `${Math.floor(ageDays / 30)}mo old`;
        ageScore = ageDays < 1 ? 15 : ageDays < 7 ? 12 : ageDays < 30 ? 8 : ageDays < 90 ? 4 : 0;
    }

    // Transaction volume
    const txCount = txs.length;
    const txScore = txCount === 0 ? 20 : txCount < 5 ? 18 : txCount < 15 ? 14
        : txCount < 30 ? 10 : txCount < 60 ? 6 : txCount < 100 ? 3 : 0;

    // Unique counterparties
    const cps = new Set<string>();
    for (const tx of txs) {
        if (tx.from?.toLowerCase() !== lowerAddr) cps.add(tx.from?.toLowerCase());
        if (tx.to?.toLowerCase() !== lowerAddr && tx.to) cps.add(tx.to?.toLowerCase());
    }
    const cpCount = cps.size;
    const cpScore = cpCount === 0 ? 15 : cpCount < 3 ? 13 : cpCount < 8 ? 10
        : cpCount < 20 ? 6 : cpCount < 50 ? 3 : 0;

    // CEX exposure (known BSC mainnet CEX addresses, cross-checked)
    const KNOWN_CEX = new Set([
        "0x8894e0a0c962cb723c1976a4421c95949be2d4e3",
        "0x28c6c06298d514db089934071355e5743bf21d60",
        "0xdfd5293d8e347dfe59e90efd55b2956a1343963d",
        "0x21a31ee1afc51d94c2efccaa2092ad1028285549",
        "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
    ]);
    const hasCex = txs.some(
        (tx) => KNOWN_CEX.has(tx.from?.toLowerCase()) || KNOWN_CEX.has(tx.to?.toLowerCase())
    );
    const cexScore = hasCex ? 0 : 15;

    const score = Math.min(100, ghostScore + ageScore + txScore + cpScore + cexScore);
    const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

    // Tips
    const tips: string[] = [];
    if (ghostDeposits === 0)
        tips.push("Deposit into Ghost Pool — break the on-chain link between your wallets.");
    if (hasCex)
        tips.push("You've interacted with a known exchange. Your deposit address may be KYC-linked.");
    if (txCount >= 30)
        tips.push("Use a fresh wallet for private transactions to reduce your graph footprint.");
    if (ghostDeposits > 0 && ghostDeposits < 3)
        tips.push("More Ghost deposits grow your anonymity set — making your withdrawal harder to trace.");
    if (tips.length === 0)
        tips.push("Excellent privacy hygiene. Keep using Ghost Pool and avoid address reuse.");

    return {
        address,
        score,
        grade,
        components: {
            ghostDeposits: { score: ghostScore, max: 35, raw: ghostDeposits, label: "Ghost Pool deposits" },
            walletAge: { score: ageScore, max: 15, raw: ageLabel, label: "Wallet age" },
            txVolume: { score: txScore, max: 20, raw: txCount, label: "Transaction count" },
            counterparties: { score: cpScore, max: 15, raw: cpCount, label: "Unique counterparties" },
            cexExposure: { score: cexScore, max: 15, raw: hasCex ? "Detected" : "None detected", hasCex, label: "CEX exposure" },
        },
        tips,
        analysedAt: new Date().toISOString(),
    };
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = Fastify({ logger: true });

await server.register(cors, {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "OPTIONS"],
});

server.get("/v1/health", async () => ({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    service: "ghost-score-server",
}));

server.get<{ Params: { address: string } }>("/v1/score/:address", async (req, reply) => {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return reply.status(400).send({ error: "INVALID_ADDRESS", message: "Provide a valid EVM address" });
    }
    try {
        const result = await computeScore(address);
        return result;
    } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: "SCORE_FAILED" });
    }
});

try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`\n👻 Ghost Score Server running at http://localhost:${PORT}`);
    console.log(`   GET http://localhost:${PORT}/v1/score/0xYourAddress`);
    console.log(`   GET http://localhost:${PORT}/v1/health\n`);
} catch (err) {
    server.log.error(err);
    process.exit(1);
}
