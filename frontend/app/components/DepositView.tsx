"use client";
import { useState } from "react";

const DENOMINATIONS = ["1", "10", "100", "1000"];

export default function DepositView() {
  const [amount, setAmount] = useState("10");
  const [token, setToken] = useState("USDC");
  const [step, setStep] = useState<"form" | "confirming" | "done">("form");
  const [note, setNote] = useState("");

  function handleDeposit() {
    setStep("confirming");
    setTimeout(() => {
      setNote(
        "ghost:v1:0x" +
          Math.random().toString(16).slice(2, 18) +
          Math.random().toString(16).slice(2, 18) +
          Math.random().toString(16).slice(2, 18)
      );
      setStep("done");
    }, 2000);
  }

  function reset() {
    setStep("form");
    setNote("");
    setAmount("10");
  }

  const fee = (Number(amount) * 0.005).toFixed(2);

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              Deposit to <span className="font-bold">Ghost Pool</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">
              Deposit USDC into the Poseidon Merkle pool. Receive a Ghost Note — your
              cryptographic key to private withdrawals from any fresh wallet.
            </p>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">
              Select Token
            </h3>
            <div className="flex gap-2 mb-8">
              {["USDC", "USDT", "DAI"].map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`px-5 py-2 text-sm font-bold uppercase tracking-widest border transition-colors btn-brutalist ${
                    token === t ? "bg-black text-white border-black" : "bg-white border-[#e5e7eb] hover:border-black"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">
              Amount
            </h3>
            <div className="grid grid-cols-4 gap-2 mb-2 border border-black">
              {DENOMINATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setAmount(d)}
                  className={`py-5 text-sm font-bold tracking-tight border-r last:border-r-0 border-black transition-colors ${
                    amount === d ? "bg-black text-white" : "bg-white hover:bg-[#f3f4f6]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-10">
              Fixed denominations enable zero-knowledge proofs
            </p>

            <button
              onClick={handleDeposit}
              className="btn-brutalist bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3"
            >
              Deposit {amount} {token}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {step === "confirming" && (
          <div className="flex flex-col justify-center h-64 gap-4">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xl font-light tracking-tight">
              Confirming <span className="font-bold">on-chain</span>…
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">
              Generating commitment + nullifier
            </p>
          </div>
        )}

        {step === "done" && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-black text-xs font-bold uppercase tracking-widest mb-8">
              ✓ Deposit Confirmed
            </div>
            <h2 className="text-3xl font-light tracking-tight mb-6">
              Your <span className="font-bold">Ghost Note</span>
            </h2>
            <div className="border border-black p-5 bg-[#f3f4f6] font-mono text-xs break-all mb-6 leading-relaxed">
              {note}
            </div>
            <div className="flex gap-3 mb-10">
              <button
                onClick={() => navigator.clipboard.writeText(note)}
                className="btn-brutalist bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-widest"
              >
                Copy Note
              </button>
              <button
                onClick={reset}
                className="btn-brutalist px-6 py-3 text-xs font-bold uppercase tracking-widest"
              >
                New Deposit
              </button>
            </div>
            <div className="border border-[#e5e7eb] bg-white p-4 text-xs text-gray-500 leading-relaxed">
              <span className="font-bold text-black">⚠ Save your Ghost Note.</span> It cannot be
              recovered. You need it to withdraw.
            </div>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-10 bg-[#f3f4f6]">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">
          Transaction Summary
        </h3>
        <div className="border border-black bg-white mb-8">
          {[
            { label: "Deposit Amount", val: `${amount} ${token}` },
            { label: "Protocol Fee (0.5%)", val: `${fee} ${token}` },
            { label: "Gas Cost", val: "0 BNB", accent: "text-green-600" },
            { label: "OFAC Screening", val: "Auto" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-4 border-b border-[#e5e7eb]">
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-xs font-bold ${accent ?? ""}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-xs font-bold uppercase tracking-widest">You Receive</span>
            <span className="text-xs font-bold">1 Ghost Note</span>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">
          How Ghost Notes Work
        </h3>
        <div className="border border-black bg-white">
          {[
            { n: "01", title: "Commit", desc: "A cryptographic commitment is stored on-chain, hiding your deposit amount and address." },
            { n: "02", title: "Prove", desc: "Generate a zero-knowledge proof that you deposited without revealing your identity." },
            { n: "03", title: "Relay", desc: "A relayer submits your withdrawal so there is no on-chain link back to your wallet." },
          ].map(({ n, title, desc }, i, arr) => (
            <div key={n} className={`flex gap-4 p-5 ${i < arr.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
              <div className="w-8 h-8 bg-[#f3f4f6] border border-[#e5e7eb] flex items-center justify-center shrink-0 text-[10px] font-bold">
                {n}
              </div>
              <div>
                <p className="text-sm font-bold mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest">
          0xbow ASP · OFAC Compliant
        </div>
      </div>
    </div>
  );
}
