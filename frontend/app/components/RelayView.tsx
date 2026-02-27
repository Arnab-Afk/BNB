"use client";
import { useState } from "react";

const PROOF_STEPS = [
  "Parsing Note",
  "Fetching Merkle tree",
  "Running Groth16 WASM circuit",
  "Building dual ZK proof",
  "Packing paymasterAndData",
  "Submitting UserOperation",
];

export default function RelayView() {
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState("");
  const [calldata, setCalldata] = useState("");
  const [step, setStep] = useState<"form" | "proving" | "done" | "error">("form");
  const [doneSteps, setDoneSteps] = useState(0);
  const [txHash, setTxHash] = useState("");

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
              Paste your Ghost Note. A ZK proof is generated locally — it never leaves your browser.
              Ghost Paymaster pays gas. Zero on-chain link to your source wallet.
            </p>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Ghost Note</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ghost:v1:0x..."
              rows={3}
              className="w-full border border-[#e5e7eb] p-4 text-xs font-mono focus:outline-none focus:border-black resize-none mb-1 transition-colors"
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-8">
              Proof generated locally · Never transmitted
            </p>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Destination Address</h3>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="0x..."
              className="w-full border border-[#e5e7eb] p-4 text-xs font-mono focus:outline-none focus:border-black mb-8 transition-colors"
            />

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Call Data (optional)</h3>
            <input
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
              placeholder="0x (leave blank for ETH transfer)"
              className="w-full border border-[#e5e7eb] p-4 text-xs font-mono focus:outline-none focus:border-black mb-10 transition-colors"
            />

            <button
              onClick={handleRelay}
              className="btn-brutalist bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3"
            >
              Generate Proof + Relay
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {step === "proving" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-8">
              Generating <span className="font-bold">ZK Proof</span>…
            </h2>
            <div className="border border-black bg-white mb-4">
              <div className="bg-black text-white px-6 py-4">
                <p className="font-(family-name:--font-pixel) text-[9px] text-purple-400 mb-1">ZK Prover</p>
                <p className="text-sm font-bold">Running Groth16 circuit locally</p>
              </div>
              <div className="p-6 space-y-4">
                {PROOF_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-8 h-8 border flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                      i < doneSteps ? "bg-black border-black text-white" : "border-[#e5e7eb] text-gray-300 bg-[#f3f4f6]"
                    }`}>
                      {i < doneSteps ? "✓" : String(i + 1).padStart(2, "0")}
                    </div>
                    <span className={`text-sm ${i < doneSteps ? "text-black font-medium" : "text-gray-400"}`}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e5e7eb] p-4">
                <div className="w-full bg-[#e5e7eb] h-1.5">
                  <div className="bg-purple-500 h-1.5 transition-all duration-700" style={{ width: `${(doneSteps / PROOF_STEPS.length) * 100}%` }} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2 text-right">
                  {doneSteps}/{PROOF_STEPS.length} steps
                </p>
              </div>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-black text-xs font-bold uppercase tracking-widest mb-8">
              ✓ Transaction Relayed
            </div>
            <h2 className="text-3xl font-light tracking-tight mb-6">
              Relay <span className="font-bold">Complete</span>
            </h2>
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Tx Hash</h3>
            <div className="border border-[#e5e7eb] p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-6 leading-relaxed">
              {txHash}
            </div>
            <div className="border border-black bg-white mb-8">
              {[
                { label: "Gas paid by", val: "Ghost Paymaster" },
                { label: "On-chain link", val: "None", accent: "text-purple-500" },
                { label: "Compliance", val: "0xbow verified", accent: "text-green-600" },
              ].map(({ label, val, accent }) => (
                <div key={label} className="flex justify-between px-5 py-4 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-bold ${accent ?? ""}`}>{val}</span>
                </div>
              ))}
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-4 text-xs font-bold uppercase tracking-widest">
              New Relay
            </button>
          </>
        )}

        {step === "error" && (
          <>
            <div className="border border-[#e5e7eb] bg-white p-8 mb-6">
              <p className="font-(family-name:--font-pixel) text-[9px] text-red-500 mb-3">Invalid Note</p>
              <p className="text-gray-500 text-sm leading-relaxed">
                The Note format is invalid. Make sure you copied it correctly from the Deposit step.
              </p>
            </div>
            <button onClick={() => setStep("form")} className="btn-brutalist px-6 py-3 text-xs font-bold uppercase tracking-widest">
              Try Again
            </button>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-10 bg-[#f3f4f6]">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Gas Summary</h3>
        <div className="border border-black bg-white mb-8">
          {[
            { label: "Gas Cost", val: "0 BNB", accent: "text-green-600" },
            { label: "Ghost Fee (20% markup)", val: "~0.002 USDC" },
            { label: "On-chain link to source", val: "None", accent: "text-purple-500" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-4 border-b border-[#e5e7eb]">
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-xs font-bold ${accent ?? ""}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-xs font-bold uppercase tracking-widest">Paymaster</span>
            <span className="text-xs font-bold">Ghost Protocol</span>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">ZK Relay Flow</h3>
        <div className="border border-black bg-white mb-6">
          {[
            { n: "01", title: "Local Proof", desc: "Groth16 proof is generated entirely in your browser. The private note never leaves your device." },
            { n: "02", title: "ERC-4337 UserOp", desc: "The proof is packed into a UserOperation. Ghost Paymaster signs gas sponsorship." },
            { n: "03", title: "Zero Link", desc: "The relayer submits from a fresh address. No on-chain connection to your wallet." },
          ].map(({ n, title, desc }, i, arr) => (
            <div key={n} className={`flex gap-4 p-5 ${i < arr.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className="w-8 h-8 bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center shrink-0 text-[10px] font-bold">{n}</div>
              <div>
                <p className="text-sm font-bold mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest">
          ERC-4337 · Account Abstraction
        </div>
      </div>
    </div>
  );
}
