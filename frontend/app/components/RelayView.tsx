"use client";
import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { relay, connectWallet, decodeNote, RelayProgress, getSmartAccountAddress } from "@/lib/ghost";
import { ADDRESSES } from "@/lib/addresses";

// ── Action types ───────────────────────────────────────────────────────────────

type ActionType = "send_usdc" | "send_usdt" | "custom" | "noop";

const ACTION_OPTIONS: { id: ActionType; label: string; desc: string }[] = [
  { id: "send_usdc", label: "Send USDC", desc: "Transfer USDC from smart account to a recipient" },
  { id: "send_usdt", label: "Send USDT", desc: "Transfer USDT from smart account to a recipient" },
  { id: "noop", label: "Demo call", desc: "No-op call to your wallet — just proves the gas flow works" },
  { id: "custom", label: "Custom call", desc: "Paste any contract address + calldata" },
];

const ERC20_IFACE = new ethers.Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const PROOF_STEPS = [
  { id: "tree", label: "Fetching Merkle tree from chain" },
  { id: "proving", label: "Running Groth16 ZK circuit (WASM)" },
  { id: "building", label: "Building ERC-4337 UserOperation" },
  { id: "submitting", label: "Ghost Bundler → EntryPoint.handleOps()" },
];

interface RelayViewProps {
  wallet?: string;
  onWalletConnect?: (addr: string) => void;
}

export default function RelayView({ wallet: walletProp = "", onWalletConnect }: RelayViewProps) {
  const [note, setNote] = useState("");
  const [action, setAction] = useState<ActionType>("send_usdc");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [customDest, setCustomDest] = useState("");
  const [customData, setCustomData] = useState("");
  const [localWallet, setLocalWallet] = useState("");
  const [progress, setProgress] = useState<RelayProgress | null>(null);
  const [hashCopied, setHashCopied] = useState(false);
  const [smartAcct, setSmartAcct] = useState("");

  const wallet = walletProp || localWallet;
  const step = progress?.step ?? "form";
  const pct = progress?.pct ?? 0;
  const txHash = progress?.txHash ?? "";

  // Parse note info
  let noteInfo = { amount: "?", token: "?" };
  try {
    if (note.startsWith("ghost:v1:")) {
      const p = decodeNote(note);
      noteInfo = { amount: p.amount, token: p.token };
    }
  } catch { /* ignore */ }

  const handleConnect = useCallback(async () => {
    try {
      const addr = await connectWallet();
      setLocalWallet(addr);
      onWalletConnect?.(addr);
    } catch (e: unknown) { alert((e as Error).message); }
  }, [onWalletConnect]);

  // Recompute smart account preview when wallet or note changes
  useEffect(() => {
    if (wallet && note.startsWith("ghost:v1:")) {
      getSmartAccountAddress(wallet, 0n)
        .then(setSmartAcct)
        .catch(() => setSmartAcct(""));
    } else {
      setSmartAcct("");
    }
  }, [wallet, note]);

  // ── Build callTarget + callData from current action state ──────────────────

  function buildCall(): { dest: string; value: bigint; data: string } | null {
    try {
      switch (action) {
        case "send_usdc": {
          if (!recipient || !amount) return null;
          const decimals = 18; // real testnet USDC has 18 decimals
          const wei = ethers.parseUnits(amount, decimals);
          return {
            dest: ADDRESSES.USDC,
            value: 0n,
            data: ERC20_IFACE.encodeFunctionData("transfer", [recipient, wei]),
          };
        }
        case "send_usdt": {
          if (!recipient || !amount) return null;
          const decimals = 18; // real testnet USDT has 18 decimals
          const wei = ethers.parseUnits(amount, decimals);
          return {
            dest: ADDRESSES.USDT,
            value: 0n,
            data: ERC20_IFACE.encodeFunctionData("transfer", [recipient, wei]),
          };
        }
        case "noop":
          return { dest: wallet || "0x0000000000000000000000000000000000000000", value: 0n, data: "0x" };
        case "custom":
          if (!customDest) return null;
          return { dest: customDest, value: 0n, data: customData || "0x" };
      }
    } catch {
      return null;
    }
  }

  const callReady = !!buildCall();

  const handleRelay = useCallback(async () => {
    if (!wallet) { await handleConnect(); return; }
    if (!note.startsWith("ghost:v1:")) {
      setProgress({ step: "error", pct: 0, message: "Invalid Ghost Note", error: "Note must start with ghost:v1:" });
      return;
    }
    const call = buildCall();
    if (!call) {
      setProgress({ step: "error", pct: 0, message: "Incomplete action", error: "Fill in all fields for the selected action." });
      return;
    }
    await relay(note, call.dest, call.value, call.data, (p) => {
      setProgress({ ...p });
      if (p.smartAccount) setSmartAcct(p.smartAccount);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, note, action, recipient, amount, customDest, customData, handleConnect]);

  function handleReset() {
    setProgress(null);
    setNote("");
    setRecipient("");
    setAmount("");
    setCustomDest("");
    setCustomData("");
    setSmartAcct("");
  }

  const shortWallet = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "";
  const shortAcct = smartAcct ? `${smartAcct.slice(0, 8)}…${smartAcct.slice(-6)}` : "";
  const stepOrder = ["tree", "proving", "building", "submitting"];
  const stepIdx = stepOrder.indexOf(step);

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">

      {/* ── LEFT ──────────────────────────────────────────────────────────── */}
      <div className="overflow-auto p-10">

        {/* ── FORM ──────────────────────────────────────────────────────── */}
        {step === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              Relay <span className="font-bold">Transaction</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
              Paste your Ghost Note. A ZK proof runs in your browser. A fresh smart account
              executes your transaction — with <strong>zero BNB</strong> — gas automatically
              paid by Ghost Paymaster from your pool deposit.
            </p>

            {/* Gas flow pill */}
            <div className="bg-black text-white rounded-sm p-4 mb-8">
              <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400 mb-2">Gas Flow</p>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="bg-white/10 px-2 py-1 rounded-sm">Smart account</span>
                <span className="text-gray-500">executes any call</span>
                <span className="text-purple-300">→</span>
                <span className="bg-purple-600 px-2 py-1 rounded-sm">Ghost Paymaster</span>
                <span className="text-gray-500">pays</span>
                <span className="bg-yellow-500 text-black px-2 py-1 rounded-sm font-bold">real BNB gas</span>
                <span className="text-gray-500">→ deducted from</span>
                <span className="bg-white/10 px-2 py-1 rounded-sm">USDC pool deposit</span>
              </div>
            </div>

            {/* Ghost Note */}
            <label className="block text-sm font-semibold text-gray-700 mb-1">Ghost Note</label>
            <p className="text-sm text-gray-400 mb-2">Paste the note you received after depositing.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ghost:v1:..."
              rows={3}
              className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-sm font-mono focus:outline-none focus:border-black resize-none mb-1 transition-colors"
            />
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-6">
              <span className="text-green-600">🔒</span>
              ZK proof runs entirely in your browser — note never leaves this tab
            </p>

            {/* Smart account preview */}
            {smartAcct && (
              <div className="border border-purple-200 bg-purple-50 rounded-sm p-3 mb-6">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">
                  Smart Account (CREATE2) — starts with 0 BNB
                </p>
                <p className="font-mono text-xs text-purple-800 break-all">{smartAcct}</p>
                <p className="text-xs text-purple-500 mt-1">
                  This account will execute the call below. It needs no BNB — Ghost pays gas.
                </p>
              </div>
            )}

            {/* ── Action selector ──────────────────────────────────────── */}
            <label className="block text-sm font-semibold text-gray-700 mb-2">What should the smart account do?</label>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAction(opt.id)}
                  className={`text-left p-4 border-2 rounded-sm transition-all ${action === opt.id
                      ? "border-black bg-black text-white"
                      : "border-[#e5e7eb] hover:border-gray-400 bg-white"
                    }`}
                >
                  <p className="text-sm font-bold mb-0.5">{opt.label}</p>
                  <p className={`text-xs leading-relaxed ${action === opt.id ? "text-gray-300" : "text-gray-400"}`}>
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* ── Action-specific fields ───────────────────────────────── */}
            {(action === "send_usdc" || action === "send_usdt") && (
              <div className="border border-[#e5e7eb] rounded-sm p-5 mb-6 bg-[#fafafa] space-y-4">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                  {action === "send_usdc" ? "USDC" : "USDT"} Transfer — from smart account
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                  <p className="text-xs text-gray-400 mb-2">
                    The smart account must already hold this {action === "send_usdc" ? "USDC" : "USDT"}.
                    Check its balance on <a
                      href={`https://testnet.bscscan.com/address/${smartAcct || "..."}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline"
                    >BscScan</a>.
                  </p>
                  <div className="flex border-2 border-[#e5e7eb] rounded-sm overflow-hidden focus-within:border-black transition-colors">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1.0"
                      className="flex-1 p-3 text-sm font-mono bg-white focus:outline-none"
                    />
                    <span className="bg-[#f3f4f6] px-4 flex items-center text-sm font-bold text-gray-500 border-l border-[#e5e7eb]">
                      {action === "send_usdc" ? "USDC" : "USDT"}
                    </span>
                  </div>
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient address</label>
                  <p className="text-xs text-gray-400 mb-2">Who receives the tokens. Can be any wallet.</p>
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x…"
                    className="w-full border-2 border-[#e5e7eb] rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Encoded calldata preview */}
                {amount && recipient && ethers.isAddress(recipient) && (() => {
                  try {
                    const wei = ethers.parseUnits(amount, 18);
                    const data = ERC20_IFACE.encodeFunctionData("transfer", [recipient, wei]);
                    return (
                      <div className="bg-black text-green-400 rounded-sm p-3 font-mono text-[10px] break-all">
                        <p className="text-gray-500 mb-1">Encoded calldata (ERC-20 transfer):</p>
                        {data}
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>
            )}

            {action === "custom" && (
              <div className="border border-[#e5e7eb] rounded-sm p-5 mb-6 bg-[#fafafa] space-y-4">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Custom Contract Call
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Contract address</label>
                  <input
                    value={customDest}
                    onChange={(e) => setCustomDest(e.target.value)}
                    placeholder="0x…"
                    className="w-full border-2 border-[#e5e7eb] rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Calldata (hex)</label>
                  <p className="text-xs text-gray-400 mb-2">Leave blank for a plain ETH transfer (value field coming soon).</p>
                  <textarea
                    value={customData}
                    onChange={(e) => setCustomData(e.target.value)}
                    placeholder="0x…"
                    rows={3}
                    className="w-full border-2 border-[#e5e7eb] rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-black resize-none transition-colors"
                  />
                </div>
              </div>
            )}

            {action === "noop" && (
              <div className="border border-amber-200 bg-amber-50 rounded-sm p-4 mb-6">
                <p className="text-sm font-semibold text-amber-800 mb-1">Demo mode</p>
                <p className="text-sm text-amber-700">
                  Sends an empty call to your connected wallet with 0 BNB value. Proves the gas sponsorship
                  plumbing works end-to-end. No tokens move.
                </p>
              </div>
            )}

            {/* Wallet indicator */}
            {wallet && (
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Connected: <span className="font-mono font-semibold text-gray-800">{shortWallet}</span>
              </div>
            )}

            <button
              onClick={handleRelay}
              disabled={!!wallet && !callReady && action !== "noop"}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3 disabled:opacity-40"
            >
              {wallet ? "Generate Proof & Relay →" : "Connect Wallet & Relay →"}
            </button>
          </>
        )}

        {/* ── PROGRESS ────────────────────────────────────────────────── */}
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
                  <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">ERC-4337 + ZK</p>
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
                    <span className={`text-sm ${i < stepIdx ? "text-gray-500 line-through"
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

        {/* ── DONE ────────────────────────────────────────────────────── */}
        {step === "done" && (
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-sm mb-6">
              <span className="text-green-600 text-xl font-bold">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Transaction relayed successfully</p>
                <p className="text-xs text-green-600">Real BNB gas paid by Ghost Paymaster · No on-chain link to depositor</p>
              </div>
            </div>

            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
              {[
                { label: "Action performed", val: ACTION_OPTIONS.find(a => a.id === action)?.label ?? action, accent: "text-purple-700 font-bold" },
                { label: "Gas currency", val: "BNB (real)", accent: "text-yellow-600 font-bold" },
                { label: "Gas paid by", val: "Ghost Paymaster", accent: "text-green-700" },
                { label: "Fee deducted from", val: `${noteInfo.token} pool deposit`, accent: "" },
                { label: "On-chain link", val: "None", accent: "text-purple-600" },
                { label: "ZK proof", val: "Verified on-chain (Groth16)", accent: "text-green-700" },
                { label: "Smart account", val: smartAcct ? `${smartAcct.slice(0, 10)}…` : "deployed", accent: "text-gray-600 font-mono text-xs" },
              ].map(({ label, val, accent }) => (
                <div key={label} className="flex justify-between px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-sm ${accent || "text-gray-900 font-semibold"}`}>{val}</span>
                </div>
              ))}
            </div>

            <h3 className="text-base font-semibold mb-2">Transaction hash</h3>
            <div className="border-2 border-[#e5e7eb] rounded-sm p-4 font-mono text-xs break-all bg-[#f3f4f6] mb-3">{txHash}</div>
            <div className="flex gap-3 mb-8">
              <button
                onClick={() => { navigator.clipboard.writeText(txHash); setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }}
                className={`text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all btn-brutalist ${hashCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"}`}
              >
                {hashCopied ? "✓ Copied" : "⎘ Copy"}
              </button>
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-sm border-2 border-[#e5e7eb] hover:border-black btn-brutalist"
              >
                View on BscScan ↗
              </a>
            </div>
            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold border-2 border-black">
              Relay another →
            </button>
          </>
        )}

        {/* ── ERROR ───────────────────────────────────────────────────── */}
        {step === "error" && (
          <>
            <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-sm mb-6">
              <span className="text-red-500 text-base shrink-0 mt-0.5">✕</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Relay failed</p>
                <p className="text-sm text-red-600 mt-1 font-mono text-xs leading-relaxed break-all">{progress?.error}</p>
              </div>
            </div>
            <button onClick={() => setProgress(null)} className="btn-brutalist px-6 py-3 text-sm font-semibold border-2 border-black">
              ← Try again
            </button>
          </>
        )}
      </div>

      {/* ── RIGHT sidebar ─────────────────────────────────────────────── */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How it works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "ZK proof in browser", desc: "Groth16 circuit proves pool membership via Merkle path. Your secret never leaves the browser." },
            { n: "2", title: "Smart account executes", desc: "A fresh ERC-4337 account (0 BNB) executes any call — send tokens, interact with any contract." },
            { n: "3", title: "Ghost Paymaster pays gas", desc: "Paymaster verifies ZK proof on-chain, pays BNB gas from its EntryPoint deposit." },
            { n: "4", title: "Pool settles the fee", desc: "Paymaster calls GhostPool.deductFee() — ~$0.05 USDC deducted from your pool deposit." },
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

        {/* Gas overview */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Gas overview</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm divide-y divide-[#e5e7eb] mb-6">
          {[
            { label: "Smart account pays", val: "0 BNB", accent: "text-green-600 font-bold" },
            { label: "Gas currency", val: "BNB (real)", accent: "text-yellow-600 font-bold" },
            { label: "Paid by", val: "Ghost Paymaster", accent: "text-purple-600" },
            { label: "Repaid from", val: "USDC pool deposit", accent: "" },
            { label: "Est. fee per relay", val: "~$0.05 USDC", accent: "" },
            { label: "Privacy", val: "ZK proven", accent: "text-purple-600 font-bold" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm ${accent || "text-gray-900 font-semibold"}`}>{val}</span>
            </div>
          ))}
        </div>

        {/* What the smart account can do */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Smart account capabilities</p>
        <div className="space-y-2 text-sm text-gray-600">
          {[
            "Send USDC or USDT to any address",
            "Interact with any DeFi contract",
            "Call any smart contract with any calldata",
            "All with zero BNB — gas auto-paid by Ghost",
          ].map((s) => (
            <div key={s} className="flex items-start gap-2">
              <span className="text-purple-500 mt-0.5 shrink-0">→</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
