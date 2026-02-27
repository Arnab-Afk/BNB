"use client";
import { useState } from "react";

type RailgunAction = "shield" | "unshield" | "swap";

const SHIELD_STEPS = [
  "Connecting to Railgun SDK",
  "Generating 0zk address",
  "Ghost Paymaster sponsoring gas",
  "Submitting shield transaction",
  "Broadcasting via Waku P2P",
];

const ACTION_META: Record<RailgunAction, { title: string; sub: string; desc: string; cta: string }> = {
  shield: {
    title: "Shield into",
    sub: "Railgun",
    desc: "Move tokens into a Railgun shielded pool. Ghost Paymaster sponsors gas — no BNB needed. Funds become invisible on-chain.",
    cta: "Shield →",
  },
  unshield: {
    title: "Unshield from",
    sub: "Railgun",
    desc: "Exit the Railgun pool with a Proof of Innocence. ZK-prove your full transaction history never touched sanctioned funds.",
    cta: "Unshield + Generate POI →",
  },
  swap: {
    title: "Private",
    sub: "Swap",
    desc: "Swap tokens inside the shielded pool. No MEV exposure. No on-chain identity link. ZK-SNARK routed.",
    cta: "Swap →",
  },
};

export default function RailgunView() {
  const [action, setAction] = useState<RailgunAction>("shield");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [step, setStep] = useState<"form" | "processing" | "done">("form");
  const [currentStep, setCurrentStep] = useState(-1);
  const [zkAddress, setZkAddress] = useState("");
  const [poiProof, setPoiProof] = useState("");

  const steps =
    action === "unshield"
      ? [...SHIELD_STEPS.map((s) => s.replace("shield", "unshield").replace("Shield", "Unshield")), "Generating Proof of Innocence"]
      : SHIELD_STEPS;

  function handleSubmit() {
    setStep("processing");
    setCurrentStep(0);
    steps.forEach((_, i) => {
      setTimeout(() => {
        setCurrentStep(i);
        if (i === steps.length - 1) {
          setZkAddress("0zk1q" + Array.from(crypto.getRandomValues(new Uint8Array(20))).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 38));
          if (action === "unshield") {
            setPoiProof("poi-" + Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join(""));
          }
          setTimeout(() => setStep("done"), 400);
        }
      }, (i + 1) * 800);
    });
  }

  function handleReset() {
    setStep("form"); setCurrentStep(-1); setZkAddress(""); setPoiProof(""); setAmount("");
  }

  const meta = ACTION_META[action];

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        {/* Action tabs */}
        <div className="flex border border-black mb-8">
          {(["shield", "unshield", "swap"] as RailgunAction[]).map((a) => (
            <button
              key={a}
              onClick={() => { setAction(a); setStep("form"); setCurrentStep(-1); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-r last:border-r-0 border-black transition-all ${
                action === a ? "bg-black text-white" : "bg-white hover:bg-[#f3f4f6]"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              {meta.title} <span className="font-bold">{meta.sub}</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-md">{meta.desc}</p>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Token</h3>
            <div className="flex gap-2 mb-8">
              {["USDC", "USDT", "WBNB"].map((t) => (
                <button key={t} onClick={() => setToken(t)}
                  className={`px-5 py-2 text-sm font-bold uppercase tracking-widest border transition-colors btn-brutalist ${
                    token === t ? "bg-black text-white border-black" : "bg-white border-[#e5e7eb] hover:border-black"
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Amount</h3>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number"
              className="w-full border border-[#e5e7eb] p-4 text-sm font-bold focus:outline-none focus:border-black mb-10 transition-colors" />

            <button onClick={handleSubmit}
              className="btn-brutalist bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
              {meta.cta}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {step === "processing" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-8 capitalize">
              {action}ing via <span className="font-bold">Waku</span>…
            </h2>
            <div className="border border-black bg-white mb-4">
              <div className="bg-black text-white px-6 py-4">
                <p className="font-(family-name:--font-pixel) text-[9px] text-purple-400 mb-1">Railgun</p>
                <p className="text-sm font-bold capitalize">{action}ing via Waku broadcaster</p>
              </div>
              <div className="p-6 space-y-4">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-8 h-8 border flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                      i < currentStep ? "bg-black border-black text-white" :
                      i === currentStep ? "border-purple-500 text-purple-500 bg-purple-50" :
                      "border-[#e5e7eb] text-gray-300 bg-[#f3f4f6]"
                    }`}>
                      {i < currentStep ? "✓" : String(i + 1).padStart(2, "0")}
                    </div>
                    <span className={`text-sm ${i <= currentStep ? "text-black font-medium" : "text-gray-400"}`}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e5e7eb] p-4">
                <div className="w-full bg-[#e5e7eb] h-1.5">
                  <div className="bg-purple-500 h-1.5 transition-all duration-700" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
                </div>
              </div>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-black text-xs font-bold uppercase tracking-widest mb-8">
              ✓ {action.charAt(0).toUpperCase() + action.slice(1)} Complete
            </div>
            <h2 className="text-3xl font-light tracking-tight mb-6">
              Transaction <span className="font-bold">Successful</span>
            </h2>
            {zkAddress && (
              <>
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">0zk Address (shielded)</h3>
                <div className="border border-[#e5e7eb] p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-6 leading-relaxed">{zkAddress}</div>
              </>
            )}
            {poiProof && (
              <>
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">Proof of Innocence</h3>
                <div className="border border-[#e5e7eb] p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-2 leading-relaxed">{poiProof}</div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-500 mb-6">
                  ZK-verified: no contact with sanctioned funds
                </p>
              </>
            )}
            <div className="border border-[#e5e7eb] bg-white flex justify-between px-5 py-4 mb-8">
              <span className="text-xs text-gray-500">Gas paid by</span>
              <span className="text-xs font-bold">Ghost Paymaster</span>
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-4 text-xs font-bold uppercase tracking-widest">
              New Transaction
            </button>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-10 bg-[#f3f4f6]">
        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Railgun Architecture</h3>
        <div className="border border-black bg-white mb-8">
          {[
            { n: "01", title: "Shield", desc: "Tokens enter a UTXO shielded pool. Your balance is hidden by a ZK-SNARK commitment." },
            { n: "02", title: "Transact", desc: "Swap or transfer inside the pool. The blockchain only sees encrypted notes — no amounts, no addresses." },
            { n: "03", title: "Unshield + POI", desc: "Exit with a Proof of Innocence — cryptographic proof your funds never touched sanctioned addresses." },
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

        <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-6">Fee Breakdown</h3>
        <div className="border border-black bg-white mb-6">
          {[
            { label: "Gas Cost", val: "0 BNB", accent: "text-green-600" },
            { label: "Broadcaster Fee", val: `~0.003 ${token}` },
            ...(action === "unshield" ? [{ label: "Proof of Innocence", val: "On exit", accent: "text-purple-500" }] : []),
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-4 border-b border-[#e5e7eb]">
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-xs font-bold ${accent ?? ""}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-xs font-bold uppercase tracking-widest">Sponsor</span>
            <span className="text-xs font-bold">Ghost Paymaster</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest">
          Track 4.2 · Railgun POI
        </div>
      </div>
    </div>
  );
}
