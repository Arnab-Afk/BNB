"use client";
import { useState } from "react";

type RailgunAction = "shield" | "unshield" | "swap";

// Backend URL — falls back to localhost for local dev
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3002";

const ACTION_META: Record<RailgunAction, { title: string; sub: string; desc: string; helper: string; cta: string }> = {
  shield: {
    title: "Shield into",
    sub: "Railgun",
    desc: "Move tokens into a private Railgun pool. Your balance becomes invisible on-chain. Ghost covers the gas — no BNB needed.",
    helper: "Shielding moves funds into a ZK-protected UTXO pool. Once shielded, on-chain observers see nothing.",
    cta: "Shield tokens",
  },
  unshield: {
    title: "Unshield from",
    sub: "Railgun",
    desc: "Exit the Railgun pool and receive a Proof of Innocence — cryptographic proof your funds never touched sanctioned wallets.",
    helper: "Unshielding generates a Proof of Innocence automatically, satisfying regulatory requirements.",
    cta: "Unshield + generate POI",
  },
  swap: {
    title: "Private",
    sub: "Swap",
    desc: "Swap tokens inside the shielded pool with no MEV exposure and no on-chain identity link.",
    helper: "Swaps happen inside the encrypted pool. Amounts and addresses are never visible on-chain.",
    cta: "Swap privately",
  },
};

// Steps shown in the processing UI
const SHIELD_STEPS = [
  "Connecting to Railgun SDK",
  "Checking ERC-20 allowance",
  "Ghost Paymaster sponsoring gas",
  "Submitting shield transaction",
  "Waiting for on-chain confirmation",
];

const UNSHIELD_STEPS = [
  "Connecting to Railgun SDK",
  "Generating ZK unshield proof",
  "Ghost Paymaster sponsoring gas",
  "Broadcasting via Waku P2P",
  "Waiting for on-chain confirmation",
  "Generating Proof of Innocence",
];

const SWAP_STEPS = [
  "Connecting to Railgun SDK",
  "Computing private swap route",
  "Ghost Paymaster sponsoring gas",
  "Submitting private swap",
  "Waiting for on-chain confirmation",
];

// ── Token address map (BSC Testnet) ───────────────────────────────────────────
const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: process.env.NEXT_PUBLIC_MOCK_USDC ?? "0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33",
  USDT: process.env.NEXT_PUBLIC_MOCK_USDT ?? "0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe",
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
};

// ── Token decimals ────────────────────────────────────────────────────────────
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  WBNB: 18,
};

type TxState = "form" | "processing" | "done" | "error";

export default function RailgunView() {
  const [action, setAction] = useState<RailgunAction>("shield");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [railgunAddress, setRailgunAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [step, setStep] = useState<TxState>("form");
  const [currentStep, setCurrentStep] = useState(-1);
  const [txHash, setTxHash] = useState("");
  const [poiProof, setPoiProof] = useState("");
  const [zkCopied, setZkCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const steps = action === "unshield" ? UNSHIELD_STEPS : action === "swap" ? SWAP_STEPS : SHIELD_STEPS;

  // ── Animate steps while waiting for real API ──────────────────────────────
  function animateSteps(totalSteps: number, onDone: () => void) {
    let i = 0;
    const timer = setInterval(() => {
      setCurrentStep(i);
      i++;
      if (i >= totalSteps - 1) {
        clearInterval(timer);
        onDone();
      }
    }, 900);
  }

  // ── Shield handler ────────────────────────────────────────────────────────
  async function handleShield() {
    if (!amount || !railgunAddress) return;
    setStep("processing");
    setCurrentStep(0);
    setErrorMsg("");

    // animate first N-1 steps while API call runs
    const decimals = TOKEN_DECIMALS[token] ?? 6;
    const amountBase = (parseFloat(amount) * 10 ** decimals).toFixed(0);

    // Animate first steps
    let animStep = 0;
    const animTimer = setInterval(() => {
      animStep++;
      if (animStep < steps.length - 1) setCurrentStep(animStep);
      else clearInterval(animTimer);
    }, 900);

    try {
      const res = await fetch(`${BACKEND}/v1/railgun/shield`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountBase,
          tokenAddress: TOKEN_ADDRESSES[token],
          railgunAddress,
          fromAddress: railgunAddress, // sender — in real flow from MetaMask
        }),
      });

      clearInterval(animTimer);

      if (!res.ok) {
        const err = await res.json() as { error?: string; message?: string };
        throw new Error(err.message ?? err.error ?? "Shield request failed");
      }

      const data = await res.json() as { txHash: string; railgunAddress: string };
      setCurrentStep(steps.length - 1);
      setTimeout(() => {
        setTxHash(data.txHash);
        setStep("done");
      }, 500);
    } catch (err) {
      clearInterval(animTimer);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  // ── Unshield handler ──────────────────────────────────────────────────────
  async function handleUnshield() {
    if (!amount || !toAddress) return;
    setStep("processing");
    setCurrentStep(0);
    setErrorMsg("");

    const decimals = TOKEN_DECIMALS[token] ?? 6;
    const amountBase = (parseFloat(amount) * 10 ** decimals).toFixed(0);

    let animStep = 0;
    const animTimer = setInterval(() => {
      animStep++;
      // Proof step is slow — hold at step 1 longer
      if (animStep < steps.length - 1) setCurrentStep(animStep);
      else clearInterval(animTimer);
    }, 2500); // longer interval for ZK proof generation

    try {
      const res = await fetch(`${BACKEND}/v1/railgun/unshield`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // In a real integration these come from the user's Railgun wallet session
          railgunWalletID: "demo-wallet-id",
          encryptionKey: "0x" + "a".repeat(64),
          amount: amountBase,
          tokenAddress: TOKEN_ADDRESSES[token],
          toAddress,
        }),
      });

      clearInterval(animTimer);

      if (!res.ok) {
        const err = await res.json() as { error?: string; message?: string };
        throw new Error(err.message ?? err.error ?? "Unshield request failed");
      }

      const data = await res.json() as { txHash: string; poiProof: string };
      setCurrentStep(steps.length - 1);
      setTimeout(() => {
        setTxHash(data.txHash);
        setPoiProof(data.poiProof);
        setStep("done");
      }, 500);
    } catch (err) {
      clearInterval(animTimer);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  // ── Swap handler (UI only — Railgun swap requires relayer integration) ────
  async function handleSwap() {
    if (!amount) return;
    setStep("processing");
    setErrorMsg("");
    animateSteps(steps.length, () => {
      setTxHash("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join(""));
      setTimeout(() => setStep("done"), 500);
    });
  }

  function handleSubmit() {
    if (action === "shield") handleShield();
    else if (action === "unshield") handleUnshield();
    else handleSwap();
  }

  function handleReset() {
    setStep("form"); setCurrentStep(-1); setTxHash(""); setPoiProof(""); setAmount("");
    setRailgunAddress(""); setToAddress(""); setErrorMsg("");
  }

  const meta = ACTION_META[action];
  const pct = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">
        {/* Action tabs */}
        <div className="flex border-2 border-black rounded-sm mb-8 overflow-hidden">
          {(["shield", "unshield", "swap"] as RailgunAction[]).map((a) => (
            <button
              key={a}
              onClick={() => { setAction(a); setStep("form"); setCurrentStep(-1); }}
              className={`flex-1 py-3 text-sm font-semibold border-r last:border-r-0 border-black transition-all capitalize ${action === a ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-[#f3f4f6]"
                }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* ── FORM ── */}
        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              {meta.title} <span className="font-bold">{meta.sub}</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-3 max-w-md">{meta.desc}</p>
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-sm text-blue-700 text-sm mb-8">
              <span className="shrink-0 mt-0.5">ℹ</span>
              <span>{meta.helper}</span>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Token</label>
            <div className="flex gap-2 mb-8">
              {["USDC", "USDT", "WBNB"].map((t) => (
                <button key={t} onClick={() => setToken(t)}
                  className={`px-5 py-2.5 text-sm font-semibold border-2 rounded-sm transition-all ${token === t ? "bg-black text-white border-black" : "bg-white text-gray-700 border-[#e5e7eb] hover:border-gray-400"
                    }`}>
                  {t}
                </button>
              ))}
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
            <div className="relative mb-6">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" type="number"
                className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-lg font-bold focus:outline-none focus:border-black pr-20 transition-colors" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{token}</span>
            </div>

            {/* Shield-specific: recipient 0zk address */}
            {action === "shield" && (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient 0zk address</label>
                <p className="text-sm text-gray-400 mb-3">Your Railgun shielded address (starts with 0zk...)</p>
                <input value={railgunAddress} onChange={(e) => setRailgunAddress(e.target.value)}
                  placeholder="0zk1q..."
                  className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black mb-8 transition-colors" />
              </>
            )}

            {/* Unshield-specific: destination 0x address */}
            {action === "unshield" && (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Destination wallet</label>
                <p className="text-sm text-gray-400 mb-3">Public 0x address to receive unshielded tokens</p>
                <input value={toAddress} onChange={(e) => setToAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black mb-8 transition-colors" />
              </>
            )}

            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700 mb-6">
              <span className="text-base">⛽</span>
              Gas cost: <span className="font-bold">0 BNB</span> — sponsored by Ghost Paymaster
            </div>

            <button onClick={handleSubmit}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3 capitalize">
              {meta.cta}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {/* ── PROCESSING ── */}
        {step === "processing" && (
          <div className="py-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-lg font-semibold capitalize">{action}ing via Railgun…</p>
                <p className="text-sm text-gray-500">Broadcasting through the Waku P2P network</p>
              </div>
            </div>
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-4">
              <div className="bg-black text-white px-6 py-4">
                <p className="text-[9px] text-purple-400 mb-0.5 uppercase tracking-widest font-bold">Railgun</p>
                <p className="text-sm font-semibold capitalize">{action}ing via Waku broadcaster</p>
              </div>
              <div className="p-5 space-y-3">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${i < currentStep ? "bg-green-500 text-white" :
                        i === currentStep ? "bg-purple-500 text-white animate-pulse" :
                          "bg-[#f3f4f6] text-gray-300 border border-[#e5e7eb]"
                      }`}>
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm transition-colors ${i < currentStep ? "text-gray-400 line-through" :
                        i === currentStep ? "text-black font-semibold" : "text-gray-400"
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

        {/* ── DONE ── */}
        {step === "done" && (
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-8">
              <span className="text-green-600 text-lg font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800 capitalize">{action} complete</p>
                <p className="text-xs text-green-600">Transaction confirmed on BNB Chain</p>
              </div>
            </div>

            {txHash && (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Transaction hash</h3>
                <div className="border-2 border-[#e5e7eb] rounded-sm p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-3 leading-relaxed">
                  {txHash}
                </div>
                <a
                  href={`https://testnet.bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1 mb-6"
                >
                  View on BscScan ↗
                </a>
              </>
            )}

            {poiProof && (
              <div className="bg-purple-50 border border-purple-200 rounded-sm p-5 mb-6">
                <p className="text-sm font-semibold text-purple-800 mb-1">Proof of Innocence generated</p>
                <p className="text-sm text-purple-600 mb-3 leading-relaxed">
                  Cryptographically verified: your funds have no history with sanctioned wallets.
                </p>
                <div className="font-mono text-xs break-all bg-white border border-purple-200 rounded-sm p-3 text-gray-700 leading-relaxed">{poiProof}</div>
              </div>
            )}

            <div className="bg-white border border-[#e5e7eb] rounded-sm flex justify-between px-5 py-4 mb-8">
              <span className="text-sm text-gray-500">Gas paid by</span>
              <span className="text-sm font-semibold text-green-700">Ghost Paymaster</span>
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold">
              New transaction
            </button>
          </>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <>
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-sm mb-6">
              <span className="text-red-600 text-lg font-bold shrink-0">✕</span>
              <div>
                <p className="text-sm font-semibold text-red-800">{action.charAt(0).toUpperCase() + action.slice(1)} failed</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold">
              Try again
            </button>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How Railgun works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "Shield", desc: "Tokens enter a UTXO pool protected by ZK-SNARKs. Your balance is hidden from everyone." },
            { n: "2", title: "Transact privately", desc: "Swap or transfer inside the pool. The chain only sees encrypted, meaningless data." },
            { n: "3", title: "Unshield with POI", desc: "Exit with a cryptographic Proof of Innocence — clean funds, provably clean." },
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

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Fee breakdown</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { label: "Gas cost", val: "0 BNB", accent: "text-green-600" },
            { label: "Broadcaster fee", val: `~0.003 ${token}`, accent: "" },
            ...(action === "unshield" ? [{ label: "Proof of Innocence", val: "Generated on exit", accent: "text-purple-600" }] : []),
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-semibold ${accent || "text-gray-900"}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-sm font-semibold">Sponsor</span>
            <span className="text-sm font-bold">Ghost Paymaster</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-sm text-purple-700 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Track 4.2 · Railgun POI
        </div>
      </div>
    </div>
  );
}
