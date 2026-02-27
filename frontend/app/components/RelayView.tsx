"use client";
import { useState, useCallback } from "react";
import { relay, connectWallet, decodeNote, RelayProgress, getSmartAccountAddress } from "@/lib/ghost";

const PROOF_STEPS = [
  { id: "tree", label: "Fetching Merkle tree from chain" },
  { id: "proving", label: "Running Groth16 ZK circuit (WASM)" },
  { id: "building", label: "Building ERC-4337 UserOperation" },
  { id: "submitting", label: "Ghost Bundler → EntryPoint.handleOps()" },
];

export default function RelayView() {
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState("");
  const [wallet, setWallet] = useState("");
  const [progress, setProgress] = useState<RelayProgress | null>(null);
  const [hashCopied, setHashCopied] = useState(false);
  const [smartAcct, setSmartAcct] = useState("");

  const step = progress?.step ?? "form";
  const pct = progress?.pct ?? 0;
  const txHash = progress?.txHash ?? "";

  // Parse note info for display
  let noteInfo = { amount: "?", token: "?" };
  try {
    if (note.startsWith("ghost:v1:")) {
      const parsed = decodeNote(note);
      noteInfo = { amount: parsed.amount, token: parsed.token };
    }
  } catch { /* ignore parse errors */ }

  const handleConnect = useCallback(async () => {
    try { const addr = await connectWallet(); setWallet(addr); }
    catch (e: unknown) { alert((e as Error).message); }
  }, []);

  // Preview smart account address when note + wallet are set
  const handleNoteChange = useCallback(async (val: string) => {
    setNote(val);
    if (wallet && val.startsWith("ghost:v1:")) {
      try {
        const addr = await getSmartAccountAddress(wallet, 0n);
        setSmartAcct(addr);
      } catch { setSmartAcct(""); }
    }
  }, [wallet]);

  const handleRelay = useCallback(async () => {
    if (!wallet) { await handleConnect(); return; }
    if (!note.startsWith("ghost:v1:")) {
      setProgress({ step: "error", pct: 0, message: "Invalid Ghost Note", error: "Note must start with ghost:v1:" });
      return;
    }

    // callTarget = recipient address (or MetaMask wallet), callData = "0x" (simple transfer)
    const dest = recipient.trim() || wallet;

    await relay(
      note,
      dest,          // the smart account will call() this address
      0n,            // BNB value = 0 (gas is what we're testing)
      "0x",          // empty calldata = plain call
      (p) => {
        setProgress({ ...p });
        if (p.smartAccount) setSmartAcct(p.smartAccount);
      },
    );
  }, [wallet, note, recipient, handleConnect]);

  function handleReset() {
    setProgress(null);
    setNote("");
    setRecipient("");
    setSmartAcct("");
  }

  const shortWallet = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "";
  const shortAcct = smartAcct ? `${smartAcct.slice(0, 8)}…${smartAcct.slice(-6)}` : "";

  const stepOrder = ["tree", "proving", "building", "submitting"];
  const stepIdx = stepOrder.indexOf(step);

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">
      {/* LEFT */}
      <div className="overflow-auto p-10">

        {/* ── Form ─────────────────────────────────────────────────── */}
        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              Relay <span className="font-bold">Transaction</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
              Paste your Ghost Note. A ZK proof is generated in your browser — proving pool
              membership without revealing which deposit. A fresh smart account executes
              the transaction with <strong>real BNB gas</strong> paid by Ghost Paymaster.
            </p>

            {/* Gas flow explainer */}
            <div className="bg-black text-white rounded-sm p-4 mb-8">
              <p className="font-(family-name:--font-pixel) text-[8px] text-purple-400 mb-2">GAS FLOW</p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="bg-white/10 px-2 py-1 rounded-sm">Your wallet</span>
                <span className="text-gray-500">→ signs UserOp</span>
                <span className="bg-purple-600 px-2 py-1 rounded-sm">Ghost Paymaster</span>
                <span className="text-gray-500">→ pays</span>
                <span className="bg-yellow-500 text-black px-2 py-1 rounded-sm font-bold">real BNB gas</span>
                <span className="text-gray-500">→ reimbursed by</span>
                <span className="bg-white/10 px-2 py-1 rounded-sm">USDC pool</span>
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Ghost Note</label>
            <p className="text-sm text-gray-400 mb-2">Paste the note you received after depositing.</p>
            <textarea
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="ghost:v1:..."
              rows={4}
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black resize-none mb-1 transition-colors"
            />
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-6">
              <span className="text-green-600">🔒</span>
              ZK proof runs entirely in your browser — note never leaves this tab
            </p>

            {/* Smart account preview */}
            {smartAcct && (
              <div className="border border-purple-200 bg-purple-50 rounded-sm p-3 mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">Smart Account (CREATE2)</p>
                <p className="font-mono text-xs text-purple-800 break-all">{smartAcct}</p>
                <p className="text-xs text-purple-500 mt-1">This fresh account will execute your transaction. It starts with 0 BNB.</p>
              </div>
            )}

            <label className="block text-sm font-semibold text-gray-700 mb-1">Call destination</label>
            <p className="text-sm text-gray-400 mb-2">The address the smart account will call. Leave blank to call your connected wallet (no-op demo).</p>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… (leave blank for demo call to your wallet)"
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black mb-8 transition-colors"
            />

            {wallet && (
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Connected: <span className="font-mono font-semibold text-gray-800">{shortWallet}</span>
              </div>
            )}

            <button onClick={handleRelay}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3">
              {wallet ? "Generate Proof & Relay" : "Connect Wallet & Relay"}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {/* ── Progress ─────────────────────────────────────────────── */}
        {(step === "tree" || step === "proving" || step === "building" || step === "submitting") && (
          <div className="py-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-lg font-semibold">Processing privately…</p>
                <p className="text-sm text-gray-500">{progress?.message}</p>
              </div>
            </div>

            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-4">
              <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-(family-name:--font-pixel) text-[9px] text-purple-400 mb-0.5">ERC-4337 + ZK</p>
                  <p className="text-sm font-semibold">Ghost Relay Pipeline</p>
                </div>
                {smartAcct && (
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400">Smart Account</p>
                    <p className="text-xs font-mono text-purple-300">{shortAcct}</p>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-3">
                {PROOF_STEPS.map(({ id, label }, i) => (
                  <div key={id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${i < stepIdx ? "bg-green-500 text-white"
                        : i === stepIdx ? "bg-purple-500 text-white animate-pulse"
                          : "bg-[#f3f4f6] text-gray-300 border border-[#e5e7eb]"
                      }`}>
                      {i < stepIdx ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm transition-colors ${i < stepIdx ? "text-gray-500 line-through"
                        : i === stepIdx ? "text-black font-semibold"
                          : "text-gray-400"
                      }`}>{label}</span>
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

        {/* ── Done ─────────────────────────────────────────────────── */}
        {step === "done" && (
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-6">
              <span className="text-green-600 text-xl font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Transaction relayed successfully</p>
                <p className="text-xs text-green-600">Real BNB gas paid by Ghost Paymaster · No on-chain link to depositor</p>
              </div>
            </div>

            {/* Summary box */}
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
              {[
                { label: "Gas currency", val: "BNB (real)", accent: "text-yellow-600 font-bold" },
                { label: "Gas paid by", val: "Ghost Paymaster", accent: "text-green-700" },
                { label: "USDC fee deducted", val: `~gas cost in ${noteInfo.token}`, accent: "" },
                { label: "On-chain link", val: "None", accent: "text-purple-600" },
                { label: "ZK proof verified", val: "On-chain (Groth16)", accent: "text-green-700" },
                { label: "Smart account", val: smartAcct ? `${smartAcct.slice(0, 10)}…` : "deployed", accent: "text-gray-600 font-mono text-xs" },
              ].map(({ label, val, accent }) => (
                <div key={label} className="flex justify-between px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-sm ${accent || "text-gray-900 font-semibold"}`}>{val}</span>
                </div>
              ))}
            </div>

            <h3 className="text-base font-semibold mb-2">Transaction hash</h3>
            <div className="border-2 border-[#e5e7eb] rounded-sm p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-3">
              {txHash}
            </div>
            <div className="flex gap-3 mb-8">
              <button onClick={() => { navigator.clipboard.writeText(txHash); setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }}
                className={`text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all btn-brutalist ${hashCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"
                  }`}>
                {hashCopied ? "✓ Copied" : "⎘ Copy"}
              </button>
              <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-sm border-2 border-[#e5e7eb] hover:border-black btn-brutalist">
                View on BscScan ↗
              </a>
            </div>

            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold border-2 border-black">
              Relay another transaction
            </button>
          </>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {step === "error" && (
          <>
            <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-sm mb-6">
              <span className="text-red-500 text-base shrink-0 mt-0.5">✕</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Relay failed</p>
                <p className="text-sm text-red-600 mt-1 font-mono text-xs leading-relaxed break-all">{progress?.error}</p>
              </div>
            </div>
            <button onClick={() => setProgress(null)} className="btn-brutalist px-6 py-3 text-sm font-semibold border-2 border-black">← Try again</button>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">ERC-4337 Gas Flow</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { label: "Your wallet pays", val: "0 BNB", accent: "text-green-600 font-bold" },
            { label: "Your USDC balance", val: "Not directly used", accent: "" },
            { label: "Gas currency", val: "BNB (real)", accent: "text-yellow-600 font-bold" },
            { label: "Paid by", val: "Ghost Paymaster", accent: "text-purple-600" },
            { label: "Paymaster repaid by", val: `USDC from pool`, accent: "" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm ${accent || "text-gray-900 font-semibold"}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-sm font-semibold">Privacy</span>
            <span className="text-sm font-bold text-purple-300">ZK proven</span>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How it works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "ZK proof in browser", desc: "Groth16 circuit proves pool membership via Merkle path. Your secret never leaves the browser." },
            { n: "2", title: "UserOperation built", desc: "The proof goes into paymasterAndData. A fresh smart account (CREATE2) is the sender — 0 BNB balance." },
            { n: "3", title: "EntryPoint.handleOps()", desc: "Ghost Paymaster verifies proof on-chain, pays BNB gas. EntryPoint executes your transaction." },
            { n: "4", title: "USDC settles gas cost", desc: "Paymaster calls GhostPool.deductFee() — your USDC deposit pays back the BNB gas cost." },
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

        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-sm text-yellow-800 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            Real BNB gas · From Paymaster deposit
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-sm text-purple-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Groth16 · ERC-4337 · Account Abstraction
          </div>
        </div>
      </div>
    </div>
  );
}
