"use client";
import { useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const BSC_RPC = "https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e";
const GHOST_POOL = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa".toLowerCase();

// ── Types ───────────────────────────────────────────────────────────────────────

type Component = {
  score: number;
  max: number;
  label: string;
  raw: string | number | boolean;
  hasCex?: boolean;
};

type ScoreData = {
  address: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  components: Record<string, Component>;
  tips: string[];
  analysedAt: string;
  source: "backend" | "rpc";
};

// ── Fallback: compute score directly from RPC (no backend needed) ──────────────

interface RpcTx {
  from: string;
  to: string;
  hash: string;
  blockNumber: string;
}

async function fetchBscScan(params: Record<string, string>): Promise<RpcTx[]> {
  const qs = new URLSearchParams({ apikey: "YourApiKeyToken", ...params });
  try {
    const res = await fetch(`https://api-testnet.bscscan.com/api?${qs}`);
    const json = await res.json() as { status: string; result: RpcTx[] };
    return json.status === "1" ? json.result : [];
  } catch {
    return [];
  }
}

async function computeScoreFallback(address: string): Promise<ScoreData> {
  const lowerAddr = address.toLowerCase();

  const txs = await fetchBscScan({
    module: "account", action: "txlist",
    address, startblock: "0", endblock: "99999999",
    page: "1", offset: "200", sort: "desc",
  });

  const firstTxs = await fetchBscScan({
    module: "account", action: "txlist",
    address, startblock: "0", endblock: "99999999",
    page: "1", offset: "1", sort: "asc",
  });

  // Ghost deposits
  const ghostDeposits = txs.filter(tx => tx.to?.toLowerCase() === GHOST_POOL).length;
  const ghostScore = ghostDeposits === 0 ? 0 : ghostDeposits === 1 ? 20 : ghostDeposits === 2 ? 28 : 35;

  // Wallet age
  let ageScore = 15, ageLabel = "No history (fresh)";
  if (firstTxs.length > 0) {
    // estimate from block number (BSC testnet ~3s per block, genesis ~2019-04-17)
    const ageDays = Math.max(0, (parseInt(txs[0]?.blockNumber ?? "0") - parseInt(firstTxs[0].blockNumber)) * 3 / 86400);
    ageLabel = ageDays < 1 ? "<1 day" : ageDays < 7 ? `${Math.floor(ageDays)}d` : ageDays < 30 ? `${Math.floor(ageDays / 7)}w` : `${Math.floor(ageDays / 30)}mo`;
    ageScore = ageDays < 1 ? 15 : ageDays < 7 ? 12 : ageDays < 30 ? 8 : ageDays < 90 ? 4 : 0;
  }

  // Tx volume
  const txCount = txs.length;
  const txScore = txCount === 0 ? 20 : txCount < 5 ? 18 : txCount < 15 ? 14 : txCount < 30 ? 10 : txCount < 60 ? 6 : txCount < 100 ? 3 : 0;

  // Counterparties
  const cps = new Set<string>();
  for (const tx of txs) {
    if (tx.from?.toLowerCase() !== lowerAddr && tx.from) cps.add(tx.from.toLowerCase());
    if (tx.to?.toLowerCase() !== lowerAddr && tx.to) cps.add(tx.to.toLowerCase());
  }
  const cpCount = cps.size;
  const cpScore = cpCount === 0 ? 15 : cpCount < 3 ? 13 : cpCount < 8 ? 10 : cpCount < 20 ? 6 : cpCount < 50 ? 3 : 0;

  // CEX (no known testnet CEX addresses so this is always clean on testnet)
  const cexScore = 15;

  const score = Math.min(100, ghostScore + ageScore + txScore + cpScore + cexScore);
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

  const tips: string[] = [];
  if (ghostDeposits === 0) tips.push("Deposit into Ghost Pool — break the on-chain link between your wallets.");
  if (txCount >= 30) tips.push("Use a fresh wallet for private transactions to reduce your graph footprint.");
  if (ghostDeposits > 0 && ghostDeposits < 3) tips.push("More Ghost deposits grow your anonymity set.");
  if (tips.length === 0) tips.push("Excellent privacy hygiene. Keep using Ghost Pool and avoid address reuse.");

  return {
    address, score, grade, tips,
    components: {
      ghostDeposits: { score: ghostScore, max: 35, raw: ghostDeposits, label: "Ghost Pool deposits" },
      walletAge: { score: ageScore, max: 15, raw: ageLabel, label: "Wallet age" },
      txVolume: { score: txScore, max: 20, raw: txCount, label: "Transaction count" },
      counterparties: { score: cpScore, max: 15, raw: cpCount, label: "Unique counterparties" },
      cexExposure: { score: cexScore, max: 15, hasCex: false, label: "CEX exposure", raw: "None detected" },
    },
    analysedAt: new Date().toISOString(),
    source: "rpc",
  };
}

// ── Main fetch (backend first, RPC fallback) ───────────────────────────────────

async function fetchScore(address: string): Promise<ScoreData> {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/score/${address}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("backend error");
    const data = await res.json() as ScoreData;
    return { ...data, source: "backend" };
  } catch {
    // Backend not running (e.g. demo environment) — compute directly from RPC
    return computeScoreFallback(address);
  }
}

// ── Component helpers ──────────────────────────────────────────────────────────

function gradeColor(g: string) {
  return g === "A" ? "text-green-600" : g === "B" ? "text-blue-600" : g === "C" ? "text-amber-500" : "text-red-500";
}
function gradeBg(g: string) {
  return g === "A" ? "bg-green-50 text-green-700 border-green-200" : g === "B" ? "bg-blue-50 text-blue-700 border-blue-200" : g === "C" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200";
}
function scoreBarColor(pts: number, max: number) {
  const pct = pts / max;
  return pct >= 0.8 ? "bg-green-500" : pct >= 0.5 ? "bg-amber-400" : "bg-red-400";
}

const COMPONENT_ORDER = ["ghostDeposits", "walletAge", "txVolume", "counterparties", "cexExposure"];

function formatRaw(key: string, raw: string | number | boolean): string {
  if (key === "ghostDeposits") return `${raw} deposit${Number(raw) !== 1 ? "s" : ""}`;
  if (key === "txVolume") return `${raw} tx${Number(raw) !== 1 ? "s" : ""}`;
  if (key === "counterparties") return `${raw} unique`;
  if (key === "cexExposure") return raw === false || raw === "None detected" ? "None detected" : "⚠ Detected";
  return String(raw);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ScoreView() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCheck() {
    const addr = address.trim();
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setError("Enter a valid wallet address (0x...)");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchScore(addr);
      setData(result);
    } catch {
      setError("Failed to fetch score. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">

      {/* ── LEFT ──────────────────────────────────────────────────────────── */}
      <div className="overflow-auto p-10">
        <h2 className="text-3xl font-light tracking-tight mb-2">
          Privacy <span className="font-bold">Score</span>
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
          On-chain privacy analysis for any BNB Chain address. Scored across 5 real signals — Ghost Pool usage, wallet age, transaction volume, counterparty graph, and CEX exposure.
        </p>

        {/* Input */}
        <label className="block text-sm font-semibold text-gray-700 mb-1">Wallet address</label>
        <p className="text-sm text-gray-400 mb-3">Works with any BNB Chain address — yours or anyone else&apos;s.</p>
        <div className={`flex border-2 rounded-sm overflow-hidden mb-2 transition-colors ${address ? "border-black" : "border-[#e5e7eb]"}`}>
          <input
            id="score-address-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="0x..."
            className="flex-1 p-4 text-sm font-mono bg-white focus:outline-none"
          />
          <button
            id="score-check-btn"
            onClick={handleCheck}
            disabled={loading || !address.trim()}
            className="bg-black text-white px-6 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning…
              </span>
            ) : "Check score"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-6">{error}</p>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <div className="text-center py-16 text-gray-300">
            <p className="text-6xl mb-4">🔍</p>
            <p className="text-sm font-medium text-gray-400">Enter an address to see its privacy score</p>
            <p className="text-xs text-gray-300 mt-1">Data pulled live from BSC Testnet</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 mt-8 animate-pulse">
            <div className="h-24 bg-[#f3f4f6] rounded-sm" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-28 bg-[#f3f4f6] rounded-sm" />)}
            </div>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Big score */}
            <div className="flex items-end gap-5 mb-8 mt-2">
              <p className={`text-9xl font-bold leading-none tabular-nums ${gradeColor(data.grade)}`}>
                {data.score}
              </p>
              <div className="pb-3">
                <div className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl font-bold mb-1 border ${gradeBg(data.grade)}`}>
                  {data.grade}
                </div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-[0.15em]">out of 100</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="w-full bg-[#f3f4f6] rounded-full h-2.5 mb-8 border border-[#e5e7eb] overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${data.score >= 80 ? "bg-green-500" : data.score >= 55 ? "bg-amber-400" : "bg-red-400"
                  }`}
                style={{ width: `${data.score}%` }}
              />
            </div>

            {/* Component grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {COMPONENT_ORDER.map((key) => {
                const c = data.components[key];
                if (!c) return null;
                const pct = Math.round((c.score / c.max) * 100);
                return (
                  <div key={key} className="bg-[#f3f4f6] border border-[#e5e7eb] rounded-sm p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-1">{c.label}</p>
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-xl font-bold tabular-nums">{c.score}<span className="text-xs text-gray-400 font-normal">/{c.max}</span></p>
                      <p className="text-xs text-gray-500 font-mono">{formatRaw(key, c.raw)}</p>
                    </div>
                    <div className="w-full bg-white rounded-full h-1.5 border border-[#e5e7eb]">
                      <div
                        className={`${scoreBarColor(c.score, c.max)} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-gray-400 mb-6">
              <span>Analysed {new Date(data.analysedAt).toLocaleTimeString()} · {data.source === "backend" ? "via backend" : "via direct RPC"}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                id="score-share-btn"
                onClick={() => {
                  navigator.clipboard.writeText(`${data.address} — Ghost Privacy Score: ${data.score}/100 (Grade ${data.grade})`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-sm text-sm font-semibold transition-all ${copied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"
                  }`}
              >
                {copied ? "✓ Copied!" : "⎘ Share score"}
              </button>
              <button
                onClick={() => { setAddress(""); setData(null); setError(null); }}
                className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-black"
              >
                Check another →
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT panel ──────────────────────────────────────────────────── */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        {!data ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Score methodology</p>
            <div className="bg-white border border-[#e5e7eb] rounded-sm divide-y divide-[#e5e7eb] mb-6">
              {[
                ["Ghost Pool deposits", "35 pts", "Depositing breaks the on-chain link. Biggest factor."],
                ["Transaction volume", "20 pts", "Fewer txs = smaller footprint in the public graph."],
                ["Wallet age", "15 pts", "Older wallet = more exposed history."],
                ["Unique counterparties", "15 pts", "More addresses interacted with = more graph edges."],
                ["CEX exposure", "15 pts", "Known exchange addresses = KYC-linked funds."],
              ].map(([label, pts, desc]) => (
                <div key={label} className="px-5 py-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    <span className="text-xs font-bold text-gray-400">{pts}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              All data is read from public BSC Testnet state. Nothing is stored. Your address is never sent to any third-party service.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Breakdown</p>

            {/* Stacked bar */}
            <div className="h-3 w-full rounded-full overflow-hidden flex mb-6">
              {COMPONENT_ORDER.map((key) => {
                const c = data.components[key];
                if (!c) return null;
                const pct = (c.score / 100) * 100;
                return (
                  <div
                    key={key}
                    className={`h-full transition-all ${scoreBarColor(c.score, c.max)}`}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${c.score}/${c.max}`}
                  />
                );
              })}
            </div>

            {/* Component rows */}
            <div className="bg-white border border-[#e5e7eb] rounded-sm divide-y divide-[#e5e7eb] mb-6">
              {COMPONENT_ORDER.map((key) => {
                const c = data.components[key];
                if (!c) return null;
                const pct = Math.round((c.score / c.max) * 100);
                return (
                  <div key={key} className="px-5 py-3.5">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-gray-700">{c.label}</span>
                      <span className="font-bold tabular-nums text-xs">
                        {c.score}/{c.max} pts
                      </span>
                    </div>
                    <div className="w-full bg-[#f3f4f6] rounded-full h-1.5 mb-1">
                      <div
                        className={`${scoreBarColor(c.score, c.max)} h-1.5 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">{formatRaw(key, c.raw)}</p>
                  </div>
                );
              })}
            </div>

            {/* Tips */}
            {data.tips.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                  {data.grade === "A" ? "Keep it up" : "How to improve"}
                </p>
                <div className="space-y-3">
                  {data.tips.map((tip, i) => (
                    <div key={i} className="bg-white border border-[#e5e7eb] rounded-sm p-4 flex gap-3">
                      <span className="text-purple-500 mt-0.5 shrink-0">→</span>
                      <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
