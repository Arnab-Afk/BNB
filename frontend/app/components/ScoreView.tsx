"use client";
import { useState } from "react";

const SAMPLE_ADDRESS = "0x742d35Cc6634C0532925a3b8D4C9B8D2E1f4c3a7";

type ScoreData = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  metrics: { label: string; value: string; detail: string; fill: number; color: string }[];
  breakdown: { label: string; pct: number; color: string; desc: string }[];
  tips: { title: string; desc: string }[];
};

function buildScore(address: string): ScoreData {
  const seed = address.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const score = ((seed * 1337) % 60) + 30; // 30–89
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  return {
    score,
    grade,
    metrics: [
      { label: "UTXO privacy", value: `${Math.min(score + 5, 99)}%`, detail: "Tokens held in shielded pools", fill: Math.min(score + 5, 99), color: "bg-purple-500" },
      { label: "Address reuse", value: `${Math.max(100 - score - 10, 10)}%`, detail: "Same address used multiple times", fill: Math.max(100 - score - 10, 10), color: "bg-red-400" },
      { label: "Tx graph leakage", value: `${Math.min(score - 5, 95)}%`, detail: "Links found in transaction graph", fill: Math.min(score - 5, 95), color: "bg-amber-400" },
      { label: "POI coverage", value: `${Math.min(score + 12, 99)}%`, detail: "Transactions with Proof of Innocence", fill: Math.min(score + 12, 99), color: "bg-green-500" },
    ],
    breakdown: [
      { label: "Shielded", pct: Math.min(score, 60), color: "bg-purple-500", desc: "Value held in ZK pools" },
      { label: "Private txns", pct: Math.min(score - 10, 20), color: "bg-green-500", desc: "Transactions with privacy" },
      { label: "Exposed", pct: Math.max(40 - score + 20, 10), color: "bg-red-400", desc: "Linkable on-chain history" },
      { label: "Unknown", pct: 5, color: "bg-gray-300", desc: "Unable to classify" },
    ],
    tips:
      grade === "A"
        ? [{ title: "Keep it up", desc: "Your wallet demonstrates excellent privacy hygiene." }]
        : [
            { title: "Use Ghost Deposit", desc: "Shield funds with Ghost to break the on-chain link." },
            { title: "Avoid address reuse", desc: "Rotate receiving addresses after each transaction." },
            { title: "Exit with POI", desc: "Unshield through Railgun to get a Proof of Innocence." },
          ],
  };
}

export default function ScoreView() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCheck() {
    if (!address.trim()) return;
    setLoading(true);
    setData(null);
    setTimeout(() => { setLoading(false); setData(buildScore(address)); }, 900);
  }

  const scoreColor =
    !data ? "" :
    data.score >= 80 ? "text-green-600" :
    data.score >= 55 ? "text-amber-500" : "text-red-500";

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        <h2 className="text-3xl font-light tracking-tight mb-2">
          Privacy <span className="font-bold">Score</span>
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
          Enter any wallet address to instantly see its on-chain privacy exposure, broken down by UTXO coverage, address reuse, and transaction graph leakage.
        </p>

        <label className="block text-sm font-semibold text-gray-700 mb-1">Wallet address</label>
        <p className="text-sm text-gray-400 mb-3">Works with any BNB Chain address — yours or anyone else's.</p>
        <div className={`flex border-2 rounded-sm overflow-hidden mb-8 transition-colors ${address ? "border-black" : "border-[#e5e7eb]"}`}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder={SAMPLE_ADDRESS}
            className="flex-1 p-4 text-sm font-mono bg-white focus:outline-none"
          />
          <button
            onClick={handleCheck}
            disabled={loading || !address.trim()}
            className="bg-black text-white px-6 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning
              </span>
            ) : "Check score"}
          </button>
        </div>

        {!data && !loading && (
          <div className="text-center py-16 text-gray-300">
            <p className="text-6xl mb-4">🔍</p>
            <p className="text-sm font-medium text-gray-400">Enter an address to see its privacy score</p>
          </div>
        )}

        {data && (
          <>
            {/* Big score */}
            <div className="flex items-end gap-4 mb-8">
              <p className={`text-9xl font-bold leading-none tabular-nums ${scoreColor}`}>{data.score}</p>
              <div className="pb-3">
                <div className={`w-12 h-12 rounded-sm flex items-center justify-center text-xl font-bold mb-1 ${
                  data.grade === "A" ? "bg-green-100 text-green-700" :
                  data.grade === "B" ? "bg-blue-100 text-blue-700" :
                  data.grade === "C" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>{data.grade}</div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-[0.15em]">out of 100</p>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {data.metrics.map(({ label, value, detail, fill, color }) => (
                <div key={label} className="bg-[#f3f4f6] border border-[#e5e7eb] rounded-sm p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">{label}</p>
                  <p className="text-2xl font-bold mb-0.5 tabular-nums">{value}</p>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">{detail}</p>
                  <div className="w-full bg-white rounded-full h-1.5 border border-[#e5e7eb]">
                    <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${fill}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(`${address} — Privacy Score: ${data.score}/100 (Grade ${data.grade})`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-sm text-sm font-semibold transition-all ${
                  copied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"
                }`}
              >
                {copied ? "✓ Copied!" : "⎘ Share score"}
              </button>
              <button onClick={() => { setAddress(""); setData(null); }} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-black">
                Check another →
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        {!data ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Score breakdown</p>
            <div className="bg-white border border-[#e5e7eb] rounded-sm divide-y divide-[#e5e7eb] mb-6">
              {["UTXO privacy (40pts)", "Address reuse (25pts)", "Tx graph (20pts)", "POI coverage (15pts)"].map((item) => (
                <div key={item} className="flex justify-between items-center px-5 py-3.5">
                  <span className="text-sm text-gray-600">{item.split("(")[0].trim()}</span>
                  <span className="text-xs font-semibold text-gray-400">{item.match(/\(([^)]+)\)/)?.[1]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">What affects your score</p>
            <div className="space-y-3 text-sm text-gray-500">
              <p className="leading-relaxed">A high score means an on-chain observer cannot reconstruct your financial history.</p>
              <p className="leading-relaxed">Shielding funds through Railgun and using Ghost deposits are the fastest ways to improve your score.</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Breakdown</p>
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
              {data.breakdown.map(({ label, pct, color, desc }) => (
                <div key={label} className="px-5 py-4 border-b border-[#e5e7eb] last:border-b-0">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-700">{label}</span>
                    <span className="font-bold tabular-nums">{pct}%</span>
                  </div>
                  <div className="w-full bg-[#f3f4f6] rounded-full h-2 mb-1.5">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              ))}
            </div>

            {data.grade !== "A" && (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Improve your score</p>
                <div className="space-y-3">
                  {data.tips.map(({ title, desc }) => (
                    <div key={title} className="bg-white border border-[#e5e7eb] rounded-sm p-4 flex gap-3">
                      <span className="text-purple-500 mt-0.5">→</span>
                      <div>
                        <p className="text-sm font-semibold mb-0.5">{title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                      </div>
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
