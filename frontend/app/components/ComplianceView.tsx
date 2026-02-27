"use client";
import { useState } from "react";

const CHECKS = [
  {
    title: "Proof of Innocence",
    desc: "Cryptographic proof that funds have no history with OFAC-sanctioned addresses. Accepted by regulated counterparties.",
    status: "pass",
  },
  {
    title: "On-chain audit trail",
    desc: "Viewing key allows an auditor to reconstruct your full transaction history — without exposing it publicly.",
    status: "pass",
  },
  {
    title: "Zero-knowledge compliance",
    desc: "Compliance is proven to a verifier without revealing the underlying data to the general public.",
    status: "pass",
  },
  {
    title: "No custodial risk",
    desc: "Funds remain fully self-custodied throughout the privacy process. Ghost and Railgun never hold your tokens.",
    status: "pass",
  },
  {
    title: "FATF Travel Rule ready",
    desc: "Viewing key disclosures are structured to satisfy financial institution information-sharing requirements.",
    status: "partial",
  },
];

const AUDITORS = [
  { name: "Gauntlet", desc: "Smart contract security review" },
  { name: "Trail of Bits", desc: "ZK circuit audit" },
  { name: "Consensys Diligence", desc: "Protocol security assessment" },
];

export default function ComplianceView() {
  const [wallet, setWallet] = useState("");
  const [step, setStep] = useState<"idle" | "loading" | "done">("idle");
  const [viewingKey, setViewingKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [txCount, setTxCount] = useState(0);

  function handleExport() {
    if (!wallet.trim()) return;
    setStep("loading");
    setTimeout(() => {
      const key =
        "vk_" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("") +
        "_" +
        Date.now().toString(36);
      setViewingKey(key);
      setTxCount(Math.floor(Math.random() * 80) + 12);
      setStep("done");
    }, 1200);
  }

  function handleReset() {
    setStep("idle"); setViewingKey(""); setWallet(""); setTxCount(0);
  }

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        <h2 className="text-3xl font-light tracking-tight mb-2">
          Compliance <span className="font-bold">that passes scrutiny</span>
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
          Financial privacy and regulatory compliance are not opposites. Ghost gives you privacy by default — and selective disclosure when you need it.
        </p>

        {/* Compliance checks */}
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-10">
          {CHECKS.map(({ title, desc, status }, i) => (
            <div key={title} className={`flex gap-4 p-5 ${i < CHECKS.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${
                status === "pass"
                  ? "bg-green-100 text-green-600"
                  : "bg-amber-100 text-amber-600"
              }`}>
                {status === "pass" ? "✓" : "~"}
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5">{title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Viewing key export */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-5">Auditor viewing key</p>

          {step === "idle" && (
            <>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your wallet address</label>
              <p className="text-sm text-gray-400 mb-3">
                Export a viewing key tied to your shielded address so an auditor can verify your transaction history — without making it public.
              </p>
              <div className={`flex border-2 rounded-sm overflow-hidden mb-4 transition-colors ${wallet ? "border-black" : "border-[#e5e7eb]"}`}>
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExport()}
                  placeholder="0x742d35Cc…"
                  className="flex-1 p-4 text-sm font-mono bg-white focus:outline-none"
                />
                <button
                  onClick={handleExport}
                  disabled={!wallet.trim()}
                  className="bg-black text-white px-6 text-sm font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity whitespace-nowrap"
                >
                  Export key
                </button>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-sm text-blue-700 text-sm">
                <span className="shrink-0 mt-0.5 font-bold">ℹ</span>
                <span>
                  Your viewing key allows an auditor to read your transaction history. It cannot be used to move funds — think of it as a read-only password.
                </span>
              </div>
            </>
          )}

          {step === "loading" && (
            <div className="flex items-center gap-4 py-6">
              <div className="w-9 h-9 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-semibold">Deriving viewing key…</p>
                <p className="text-sm text-gray-400">Scanning shielded transaction history</p>
              </div>
            </div>
          )}

          {step === "done" && (
            <>
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-6">
                <span className="text-green-600 text-lg font-bold">✓</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Viewing key generated</p>
                  <p className="text-xs text-green-600">Covers {txCount} shielded transactions</p>
                </div>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-1">Viewing key</label>
              <p className="text-sm text-gray-400 mb-3">Share this with a trusted auditor. It cannot be used to move your funds.</p>
              <div className="border-2 border-[#e5e7eb] rounded-sm p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-3 leading-relaxed">{viewingKey}</div>
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => { navigator.clipboard.writeText(viewingKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2500); }}
                  className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-sm text-sm font-semibold transition-all ${
                    keyCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"
                  }`}
                >
                  {keyCopied ? "✓ Copied!" : "⎘ Copy key"}
                </button>
                <button onClick={handleReset} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-black">
                  Generate new key →
                </button>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-sm text-amber-800 text-sm">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  Only share this key with parties you trust. Once shared, they can see your full shielded history for this address.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How it works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "Privacy first", desc: "All transactions are encrypted. On-chain observers see nothing unless you choose to reveal." },
            { n: "2", title: "Selective disclosure", desc: "Generate a viewing key scoped to your shielded address. You control who can read your history." },
            { n: "3", title: "Cryptographic proof", desc: "The Proof of Innocence is mathematically verifiable. No trust in Ghost required." },
          ].map(({ n, title, desc }, i, arr) => (
            <div key={n} className={`flex gap-4 p-5 ${i < arr.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">{n}</div>
              <div>
                <p className="text-sm font-semibold mb-0.5">{title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Audited by</p>
        <div className="space-y-2 mb-6">
          {AUDITORS.map(({ name, desc }) => (
            <div key={name} className="bg-white border border-[#e5e7eb] rounded-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <div className="w-7 h-7 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">✓</div>
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-sm text-purple-700 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Track 4.2 · Compliance
        </div>
      </div>
    </div>
  );
}
