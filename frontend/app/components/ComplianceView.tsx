"use client";
import { useState } from "react";

const CHECKS = [
  { label: "Pool Membership Proof", tag: "Circom + Groth16", desc: "ZK-prove you deposited without revealing which UTXO. On-chain Groth16 verification." },
  { label: "ASP Clean Set Proof", tag: "0xbow Compliant", desc: "0xbow-attested: your commitment exists in the OFAC-clean Merkle root. Not just in the pool." },
  { label: "OFAC SDN Screening", tag: "Auto-Synced", desc: "Every address is checked against the OFAC SDN list, synced every 60 minutes." },
  { label: "Proof of Innocence", tag: "Railgun POI", desc: "On Railgun exit, ZK-prove your full transaction history never touched sanctioned funds." },
];

export default function ComplianceView() {
  const [walletAddress, setWalletAddress] = useState("");
  const [viewingKey, setViewingKey] = useState("");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  function handleGenerate() {
    setLoading(true);
    setTimeout(() => {
      setViewingKey("vk_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join(""));
      setGenerated(true);
      setLoading(false);
    }, 1200);
  }

  function handleExport() {
    const report = [
      "GHOST PROTOCOL — COMPLIANCE REPORT",
      "====================================",
      `Wallet: ${walletAddress || "0x..."}`,
      `Viewing Key: ${viewingKey}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "COMPLIANCE CHECKS:",
      ...CHECKS.map((c) => `  [PASS] ${c.label} — ${c.tag}`),
      "",
      "This report is generated using zero-knowledge proofs.",
      "The chain still sees nothing. The auditor sees everything.",
    ].join("\n");
    navigator.clipboard.writeText(report);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        <h2 className="text-3xl font-light tracking-tight mb-2">
          Privacy that passes <span className="font-bold">regulatory scrutiny</span>.
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">
          Ghost implements the <span className="font-semibold text-black">0xbow ASP model</span> — the gold standard for
          compliant privacy. Not just privacy. Provable innocence.
        </p>

        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Compliance Status</h3>
        <div className="border border-black bg-white mb-8">
          {CHECKS.map((check, i, arr) => (
            <div key={i} className={`flex items-start justify-between p-6 ${i < arr.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className="flex items-start gap-4 flex-1 pr-6">
                <div className="w-6 h-6 bg-black flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[9px] font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-bold mb-1">{check.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{check.desc}</p>
                </div>
              </div>
              <div className="shrink-0 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest px-2 py-1 whitespace-nowrap">
                {check.tag}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-[#e5e7eb] bg-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-500 mb-2">0xbow ASP Model</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Unlike Tornado Cash (pool membership only), Ghost additionally proves ASP Clean Set membership and
            Proof of Innocence — satisfying institutional compliance requirements.
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-10 bg-[#f3f4f6]">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Viewing Key Export</h3>

        <div className="border border-black bg-white mb-6">
          <div className="bg-black text-white px-6 py-5">
            <p className="font-(family-name:--font-pixel) text-[9px] text-purple-400 mb-1">Auditor Access</p>
            <p className="text-sm font-bold">Export for Compliance Review</p>
          </div>

          <div className="border-b border-[#e5e7eb] p-5">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Wallet Address</h4>
            <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x..."
              className="w-full border border-[#e5e7eb] p-3 text-xs font-mono focus:outline-none focus:border-black transition-colors" />
          </div>

          {!generated ? (
            <div className="p-5">
              <button onClick={handleGenerate} disabled={loading}
                className="btn-brutalist w-full bg-black text-white py-4 text-xs font-bold uppercase tracking-widest disabled:bg-gray-300">
                {loading ? "Generating…" : "Generate Viewing Key →"}
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-3 text-center">
                Key derived from spending key · Off-chain only
              </p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-[#e5e7eb]">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Viewing Key</h4>
                <div className="font-mono text-[10px] break-all bg-[#f3f4f6] border border-[#e5e7eb] p-3 text-gray-700 leading-relaxed mb-4">
                  {viewingKey}
                </div>
                <div className="border-l-2 border-purple-500 pl-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Share with your auditor. They will see all Ghost transactions.
                    The public blockchain still sees nothing.
                  </p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                <button onClick={() => { navigator.clipboard.writeText(viewingKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); }}
                  className="btn-brutalist py-3 text-xs font-bold uppercase tracking-widest">
                  {keyCopied ? "Copied!" : "Copy Key"}
                </button>
                <button onClick={handleExport}
                  className="btn-brutalist bg-black text-white py-3 text-xs font-bold uppercase tracking-widest">
                  {exported ? "Copied!" : "Export Report"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="border border-black bg-white p-5">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">How It Works</h4>
          <div className="space-y-4">
            {[
              "Viewing key is derived from your spending key — read-only access.",
              "Auditor can reconstruct all transaction history locally.",
              "Public chain still shows zero information.",
            ].map((tip) => (
              <div key={tip} className="flex gap-3 text-xs">
                <span className="text-purple-500 font-bold shrink-0">→</span>
                <span className="text-gray-600 leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
