"use client";
import { useState } from "react";

const BREAKDOWN = [
  { label: "ZK Pool Deposits", weight: 30, desc: "Each deposit increases anonymity set" },
  { label: "Relay Transactions", weight: 25, desc: "Gasless relays from fresh wallets" },
  { label: "Railgun Shields", weight: 20, desc: "Funds invisibly shielded on-chain" },
  { label: "Proof of Innocence", weight: 15, desc: "CK-verified clean exit history" },
  { label: "OFAC Screening", weight: 10, desc: "All addresses verified clean" },
];

const scoreLabel = (s: number) => {
  if (s >= 80) return { label: "PRIVATE", color: "text-green-600" };
  if (s >= 50) return { label: "MODERATE", color: "text-yellow-600" };
  return { label: "EXPOSED", color: "text-red-500" };
};

const SAMPLE = { score: 87, depositsShielded: 3, relayTxs: 12, railgunShields: 2, ofacClean: true };

export default function ScoreView() {
  const [address, setAddress] = useState("");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(SAMPLE.score);
  const [copied, setCopied] = useState(false);

  const data = checked ? { ...SAMPLE, score } : SAMPLE;

  function handleCheck() {
    if (!address) return;
    setLoading(true);
    setTimeout(() => { setScore(Math.floor(Math.random() * 40) + 50); setChecked(true); setLoading(false); }, 1500);
  }

  function handleShare() {
    navigator.clipboard.writeText(`My Ghost Privacy Score: ${data.score}/100 — ${scoreLabel(data.score).label}\n\nCheck yours at ghost.privacy`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        <h2 className="text-3xl font-light tracking-tight mb-2">
          Wallet <span className="font-bold">Exposure Meter</span>
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">
          A 0–100 on-chain exposure score for any wallet. Ghost users score higher — because
          privacy is provable.
        </p>

        {/* Address input */}
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Wallet Address</h3>
        <div className="flex border border-[#e5e7eb] mb-10 focus-within:border-black transition-colors">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... enter wallet address"
            className="flex-1 p-4 text-xs font-mono focus:outline-none border-r border-[#e5e7eb]"
          />
          <button onClick={handleCheck} disabled={!address || loading}
            className="px-6 py-4 bg-black text-white text-xs font-bold uppercase tracking-widest disabled:bg-gray-300 btn-brutalist">
            {loading ? "···" : "Check →"}
          </button>
        </div>

        {/* Score display */}
        <div className="border border-black bg-white p-8 mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">
            {checked ? "Wallet Score" : "Sample Score"}
          </p>
          <div className="flex items-end gap-4 mb-3">
            <span className="text-8xl font-bold tracking-tighter text-purple-500">{data.score}</span>
            <span className="text-gray-400 text-sm font-medium mb-3">/ 100</span>
          </div>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${scoreLabel(data.score).color}`}>
            {scoreLabel(data.score).label}
          </p>
          <div className="w-full bg-[#e5e7eb] h-2 mb-8">
            <div className="bg-purple-500 h-2 transition-all duration-700" style={{ width: `${data.score}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: "Deposits Shielded", val: String(data.depositsShielded) },
              { label: "Relay Txs", val: String(data.relayTxs) },
              { label: "Railgun Shields", val: String(data.railgunShields) },
              { label: "OFAC Clean", val: data.ofacClean ? "✓" : "✗" },
            ].map((s) => (
              <div key={s.label} className="bg-[#f3f4f6] border border-[#e5e7eb] p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className="text-lg font-bold">{s.val}</p>
              </div>
            ))}
          </div>
          <button onClick={handleShare} className="btn-brutalist w-full py-3 text-xs font-bold uppercase tracking-widest">
            {copied ? "Copied!" : "Share Score →"}
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-10 bg-[#f3f4f6]">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Score Breakdown</h3>
        <div className="border border-black bg-white mb-8">
          {BREAKDOWN.map((item, i, arr) => (
            <div key={item.label} className={`p-5 ${i < arr.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold">{item.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.weight}pts</span>
              </div>
              <div className="w-full bg-[#e5e7eb] h-1 mb-2">
                <div className="bg-purple-500 h-1 transition-all" style={{ width: `${data.score}%` }} />
              </div>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Improve Your Score</h3>
        <div className="border border-black bg-white p-5 mb-6">
          <div className="space-y-4">
            {[
              "Make a deposit into the Ghost Pool",
              "Use the relayer for your next transfer",
              "Shield assets in Railgun before withdrawal",
            ].map((tip) => (
              <div key={tip} className="flex gap-3 text-xs">
                <span className="text-purple-500 font-bold shrink-0">→</span>
                <span className="text-gray-600 leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest">
          Privacy Score v1
        </div>
      </div>
    </div>
  );
}
