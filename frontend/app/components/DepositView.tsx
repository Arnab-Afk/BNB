"use client";
import { useState } from "react";

const DENOMINATIONS = ["1", "10", "100", "1000"];

export default function DepositView() {
  const [amount, setAmount] = useState("10");
  const [token, setToken] = useState("USDC");
  const [step, setStep] = useState<"form" | "confirming" | "done">("form");
  const [note, setNote] = useState("");
  const [noteCopied, setNoteCopied] = useState(false);

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

  function copyNote() {
    navigator.clipboard.writeText(note);
    setNoteCopied(true);
    setTimeout(() => setNoteCopied(false), 2500);
  }

  function reset() {
    setStep("form");
    setNote("");
    setAmount("10");
  }

  const fee = (Number(amount) * 0.005).toFixed(2);
  const total = (Number(amount) + Number(fee)).toFixed(2);

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
              Deposit stablecoins into the pool and receive a Ghost Note — a private key you&apos;ll
              use to withdraw from any fresh wallet with zero gas.
            </p>

            {/* Token */}
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Choose token
            </label>
            <p className="text-sm text-gray-400 mb-3">Select which stablecoin you want to deposit.</p>
            <div className="flex gap-2 mb-8">
              {["USDC", "USDT", "DAI"].map((t) => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`px-5 py-2.5 text-sm font-semibold border-2 transition-all rounded-sm ${
                    token === t
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-[#e5e7eb] hover:border-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select amount
            </label>
            <p className="text-sm text-gray-400 mb-3">
              Fixed denominations are required for zero-knowledge proofs. All deposits are equal size — this is how anonymity works.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-8">
              {DENOMINATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setAmount(d)}
                  className={`py-4 text-center border-2 transition-all rounded-sm ${
                    amount === d
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-[#e5e7eb] hover:border-gray-400"
                  }`}
                >
                  <span className="block text-lg font-bold">{d}</span>
                  <span className={`text-xs mt-0.5 ${amount === d ? "text-gray-300" : "text-gray-400"}`}>{token}</span>
                </button>
              ))}
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-4 p-4 bg-[#f3f4f6] border border-[#e5e7eb] rounded-sm mb-8">
              <div className="flex-1 text-sm text-gray-500">
                You pay: <span className="font-semibold text-black">{amount} {token}</span>
                <span className="text-gray-400"> + {fee} {token} fee</span>
              </div>
              <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-sm">
                0 BNB gas
              </div>
            </div>

            <button
              onClick={handleDeposit}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3"
            >
              Deposit {total} {token}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {step === "confirming" && (
          <div className="flex flex-col justify-center py-16 gap-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-lg font-semibold">Confirming your deposit…</p>
                <p className="text-sm text-gray-500 mt-1">Generating cryptographic commitment and nullifier</p>
              </div>
            </div>
            <div className="space-y-2 pl-14">
              {["Sending {amount} {token} to pool", "Creating Poseidon hash commitment", "Deriving nullifier from spending key"].map((s, i) => (
                <p key={i} className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                  {s.replace("{amount}", amount).replace("{token}", token)}
                </p>
              ))}
            </div>
          </div>
        )}

        {step === "done" && (
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-8">
              <span className="text-green-600 text-lg font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Deposit confirmed</p>
                <p className="text-xs text-green-600">Your Ghost Note is ready to use</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-1">Your Ghost Note</h3>
            <p className="text-sm text-gray-500 mb-4">
              This is your withdrawal key. Save it somewhere safe — it cannot be recovered once you leave this page.
            </p>

            <div className="border-2 border-black bg-[#f3f4f6] rounded-sm p-4 font-mono text-xs break-all leading-relaxed mb-4 select-all">
              {note}
            </div>

            <div className="flex gap-3 mb-8">
              <button
                onClick={copyNote}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-2 rounded-sm transition-all btn-brutalist ${
                  noteCopied
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-black text-white border-black"
                }`}
              >
                {noteCopied ? (
                  <><span>✓</span> Copied!</>
                ) : (
                  <><span>⎘</span> Copy Note</>
                )}
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 text-sm font-semibold border-2 border-[#e5e7eb] hover:border-black rounded-sm transition-colors"
              >
                New Deposit
              </button>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-sm">
              <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Save this Note before leaving</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Ghost Notes are never stored anywhere. If you lose it, your deposit cannot be recovered.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Transaction summary</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm mb-6 overflow-hidden">
          {[
            { label: "Deposit amount", val: `${amount} ${token}` },
            { label: "Protocol fee (0.5%)", val: `${fee} ${token}` },
            { label: "Gas cost", val: "0 BNB", accent: "text-green-600" },
            { label: "OFAC screening", val: "Automatic", accent: "text-blue-600" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-semibold ${accent ?? "text-gray-900"}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-sm font-semibold">You receive</span>
            <span className="text-sm font-bold">1 Ghost Note</span>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How it works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "Commit", desc: "A cryptographic hash of your deposit is stored on-chain. Nobody can link it to your wallet." },
            { n: "2", title: "Store your Note", desc: "Your Ghost Note is the only proof you made this deposit. Keep it private." },
            { n: "3", title: "Relay later", desc: "Use the Relay tab to withdraw from any fresh wallet, sponsored by Ghost Paymaster." },
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
          0xbow ASP · OFAC Compliant
        </div>
      </div>
    </div>
  );
}
