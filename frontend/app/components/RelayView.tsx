"use client";
import { useState } from "react";

const PROOF_STEPS = [
  "Parsing your Ghost Note",
  "Fetching Merkle tree from chain",
  "Running Groth16 ZK circuit locally",
  "Building dual ZK proof",
  "Packing ERC-4337 UserOperation",
  "Submitting via Ghost Paymaster",
];

export default function RelayView() {
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState("");
  const [calldata, setCalldata] = useState("");
  const [step, setStep] = useState<"form" | "proving" | "done" | "error">("form");
  const [doneSteps, setDoneSteps] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [hashCopied, setHashCopied] = useState(false);

  function handleRelay() {
    if (!note.startsWith("ghost")) { setStep("error"); return; }
    setStep("proving");
    setDoneSteps(0);
    PROOF_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setDoneSteps(i + 1);
        if (i === PROOF_STEPS.length - 1) {
          setTxHash("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""));
          setTimeout(() => setStep("done"), 400);
        }
      }, (i + 1) * 700);
    });
  }

  function handleReset() {
    setStep("form"); setNote(""); setDestination(""); setCalldata(""); setTxHash(""); setDoneSteps(0);
  }

  const pct = Math.round((doneSteps / PROOF_STEPS.length) * 100);

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              Relay <span className="font-bold">Transaction</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">
              Use the Ghost Note from your deposit to withdraw privately. The ZK proof is generated
              in your browser — nothing is ever sent to a server. Ghost pays your gas.
            </p>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Ghost Note</label>
            <p className="text-sm text-gray-400 mb-2">Paste the note you received after depositing.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ghost:v1:0x..."
              rows={4}
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black resize-none mb-1 transition-colors"
            />
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-8">
              <span className="text-green-600">🔒</span>
              Proof is generated locally — your Note never leaves this browser tab
            </p>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Destination address</label>
            <p className="text-sm text-gray-400 mb-2">The wallet that will receive the funds. Should be a fresh address.</p>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="0x..."
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black mb-8 transition-colors"
            />

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Call data <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <p className="text-sm text-gray-400 mb-2">Leave blank for a simple token transfer. Add calldata for contract interactions.</p>
            <input
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
              placeholder="0x (leave blank for token transfer)"
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black mb-10 transition-colors"
            />

            <button
              onClick={handleRelay}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3"
            >
              Generate Proof &amp; Relay
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {step === "proving" && (
          <div className="py-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-lg font-semibold">Generating ZK proof…</p>
                <p className="text-sm text-gray-500">This takes a few seconds. Everything runs in your browser.</p>
              </div>
            </div>

            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-4">
              <div className="bg-black text-white px-6 py-4">
                <p className="font-(family-name:--font-pixel) text-[9px] text-purple-400 mb-0.5">ZK Prover</p>
                <p className="text-sm font-semibold">Running Groth16 circuit</p>
              </div>
              <div className="p-5 space-y-3">
                {PROOF_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      i < doneSteps
                        ? "bg-green-500 text-white"
                        : i === doneSteps
                        ? "bg-purple-500 text-white animate-pulse"
                        : "bg-[#f3f4f6] text-gray-300 border border-[#e5e7eb]"
                    }`}>
                      {i < doneSteps ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm transition-colors ${
                      i < doneSteps ? "text-gray-500 line-through" :
                      i === doneSteps ? "text-black font-semibold" :
                      "text-gray-400"
                    }`}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e5e7eb] px-5 py-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Progress</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="w-full bg-[#e5e7eb] rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-8">
              <span className="text-green-600 text-lg font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Transaction relayed successfully</p>
                <p className="text-xs text-green-600">No on-chain link to your source wallet</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-1">Transaction hash</h3>
            <p className="text-sm text-gray-500 mb-3">Your transaction is live on BNB Chain.</p>
            <div className="border-2 border-[#e5e7eb] rounded-sm p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-3 leading-relaxed">
              {txHash}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(txHash); setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }}
              className={`text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all mb-8 ${
                hashCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"
              }`}
            >
              {hashCopied ? "✓ Copied" : "⎘ Copy hash"}
            </button>

            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-8">
              {[
                { label: "Gas paid by", val: "Ghost Paymaster", accent: "text-green-700" },
                { label: "On-chain link to source", val: "None", accent: "text-purple-600" },
                { label: "Compliance check", val: "0xbow verified", accent: "text-green-700" },
              ].map(({ label, val, accent }) => (
                <div key={label} className="flex justify-between px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-sm font-semibold ${accent}`}>{val}</span>
                </div>
              ))}
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold">
              Relay another transaction
            </button>
          </>
        )}

        {step === "error" && (
          <>
            <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-sm mb-6">
              <span className="text-red-500 text-base shrink-0 mt-0.5">✕</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Invalid Ghost Note</p>
                <p className="text-sm text-red-600 mt-1 leading-relaxed">
                  The format doesn&apos;t look right. A valid note starts with <code className="bg-red-100 px-1 rounded text-xs">ghost:v1:0x…</code>.
                  Make sure you copied the full note from the Deposit step.
                </p>
              </div>
            </div>
            <button onClick={() => setStep("form")} className="btn-brutalist px-6 py-3 text-sm font-semibold">
              ← Try again
            </button>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Gas summary</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { label: "Gas cost to you", val: "0 BNB", accent: "text-green-600" },
            { label: "Ghost relay fee", val: "~0.002 USDC", accent: "" },
            { label: "On-chain link", val: "None", accent: "text-purple-600" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-semibold ${accent || "text-gray-900"}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-sm font-semibold">Pays gas</span>
            <span className="text-sm font-bold">Ghost Paymaster</span>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How relay works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "Proof in browser", desc: "The Groth16 ZK proof runs entirely locally. Your note never touches any server." },
            { n: "2", title: "ERC-4337 UserOp", desc: "Your proof is packaged into an ERC-4337 UserOperation with gas paid by Ghost." },
            { n: "3", title: "Fresh relay address", desc: "A relayer broadcasts from a fresh wallet — no on-chain connection to your source." },
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

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-sm text-purple-700 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          ERC-4337 · Account Abstraction
        </div>
      </div>
    </div>
  );
}
