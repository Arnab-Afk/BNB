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
  const [amount, setAmount] = useState("0.2");
  const [customDest, setCustomDest] = useState("");
  const [customData, setCustomData] = useState("");
  const [localWallet, setLocalWallet] = useState("");
  const [progress, setProgress] = useState<RelayProgress | null>(null);
  const [hashCopied, setHashCopied] = useState(false);
  const [smartAcct, setSmartAcct] = useState("");
  const [gasReceipt, setGasReceipt] = useState<{ gasCostBnb: string; feeUsdc: string; nullifier: string } | null>(null);
  const [smartAcctUsdcBal, setSmartAcctUsdcBal] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

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

  // Fetch GasSponsored event from receipt once relay is done
  useEffect(() => {
    if (step !== "done" || !txHash) return;
    const GAS_SPONSORED_TOPIC = ethers.id("GasSponsored(address,bytes32,uint256,uint256,address)");
    const GhostPaymaster_ABI = ["event GasSponsored(address indexed sender, bytes32 indexed nullifierHash, uint256 gasCostWei, uint256 feeUSDC, address feeToken)"];
    const pmIface = new ethers.Interface(GhostPaymaster_ABI);
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "";
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getTransactionReceipt", params: [txHash], id: 1 }),
    })
      .then(r => r.json())
      .then((d: { result?: { logs?: { address: string; topics: string[]; data: string }[] } }) => {
        const logs = d.result?.logs ?? [];
        const log = logs.find(l =>
          l.address.toLowerCase() === ADDRESSES.GhostPaymaster.toLowerCase() &&
          l.topics[0] === GAS_SPONSORED_TOPIC
        );
        if (!log) return;
        const parsed = pmIface.parseLog({ topics: log.topics, data: log.data });
        if (!parsed) return;
        const gasCostWei = parsed.args[2] as bigint;
        const feeUSDC = parsed.args[3] as bigint;
        const nullifier = parsed.args[1] as string;
        setGasReceipt({
          gasCostBnb: ethers.formatEther(gasCostWei),
          // Testnet USDC has 18 decimals; the on-chain feeUSDC is stored in those units
          feeUsdc: ethers.formatUnits(feeUSDC, 18),
          nullifier: nullifier.slice(0, 18) + "…",
        });
      })
      .catch(() => { /* silently ignore — non-critical */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, txHash]);

  // Recompute smart account preview when wallet or note changes
  useEffect(() => {
    if (wallet && note.startsWith("ghost:v1:")) {
      getSmartAccountAddress(wallet, 0n)
        .then(addr => {
          setSmartAcct(addr);
          // Also fetch its USDC balance (testnet USDC has 18 decimals)
          const rpc = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
          const usdc = new ethers.Contract(ADDRESSES.USDC, ["function balanceOf(address) view returns (uint256)"], rpc);
          return usdc.balanceOf(addr);
        })
        .then((bal: bigint) => setSmartAcctUsdcBal(ethers.formatUnits(bal, 18)))
        .catch(() => { setSmartAcct(""); setSmartAcctUsdcBal(null); });
    } else {
      setSmartAcct("");
      setSmartAcctUsdcBal(null);
    }
  }, [wallet, note]);

  // Fund the smart account with USDC from the connected EOA
  const handleFundSmartAccount = useCallback(async () => {
    if (!wallet || !smartAcct || !amount) return;
    try {
      setFunding(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await browserProvider.getSigner();
      const usdc = new ethers.Contract(ADDRESSES.USDC,
        ["function transfer(address to, uint256 amount) returns (bool)"],
        signer
      );
      const wei = ethers.parseUnits(amount, 18);
      const tx = await usdc.transfer(smartAcct, wei);
      await tx.wait();
      // Refresh balance
      const rpc = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const usdcRead = new ethers.Contract(ADDRESSES.USDC, ["function balanceOf(address) view returns (uint256)"], rpc);
      const bal: bigint = await usdcRead.balanceOf(smartAcct);
      setSmartAcctUsdcBal(ethers.formatUnits(bal, 18));
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setFunding(false);
    }
  }, [wallet, smartAcct, amount]);

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
    setAmount("0.2");
    setCustomDest("");
    setCustomData("");
    setSmartAcct("");
    setSmartAcctUsdcBal(null);
    setFunding(false);
    setGasReceipt(null);
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

            {/* ── Zero-BNB Gas Sponsored Flow Visualization ──────── */}
            <div className="mb-8 rounded-sm border border-[#e5e7eb] overflow-hidden">
              {/* Header */}
              <div className="bg-black text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300">Live Gas Sponsorship Flow</p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest bg-green-500 text-black px-2 py-0.5 rounded-sm">0 BNB Required</span>
              </div>

              {/* Steps */}
              <div className="bg-[#0a0a0a] px-5 py-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-purple-400">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white mb-0.5">Fresh Smart Account starts with 0 BNB</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gray-500">
                        {smartAcct ? `${smartAcct.slice(0, 10)}…${smartAcct.slice(-6)}` : "0xABCD…EFGH"}
                      </span>
                      <span className="text-[9px] font-bold bg-red-900/40 text-red-400 border border-red-800 px-1.5 py-0.5 rounded-sm">BNB: 0.000000</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-px h-5 bg-purple-800 ml-3.5 mb-3" />

                {/* Step 2 */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-purple-900 border border-purple-500 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-purple-300">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white mb-0.5">Ghost Paymaster funds gas on-chain</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold bg-purple-900 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded-sm">EntryPoint.handleOps()</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-[9px] text-purple-400">Paymaster verifies ZK proof</span>
                    </div>
                    <p className="text-[9px] text-gray-600 mt-1">Gas cost: ~0.00005 BNB · Paid by Ghost Paymaster</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-px h-5 bg-purple-800 ml-3.5 mb-3" />

                {/* Step 3 */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-yellow-600 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-yellow-400">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white mb-0.5">Smart account sends <span className="text-yellow-400">0.2 USDC</span></p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-gray-500">USDC.transfer(recipient, 0.2)</span>
                      <span className="text-[9px] font-bold text-yellow-500">✓ no BNB spent</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-px h-5 bg-green-800 ml-3.5 mb-3" />

                {/* Step 4 */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-green-900 border border-green-500 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-green-300">4</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white mb-0.5">Recipient gets USDC · Fee deducted from pool</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold bg-green-900 text-green-300 border border-green-700 px-1.5 py-0.5 rounded-sm">Transfer ✓</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-[9px] text-gray-500">GhostPool.deductFee() settles ~$0.05 USDC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats bar */}
              <div className="bg-[#111] border-t border-white/5 px-5 py-2.5 flex gap-6">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Your BNB spent</p>
                  <p className="text-sm font-black text-green-400">0.000000</p>
                </div>
                <div className="border-l border-white/10 pl-6">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">Gas paid by</p>
                  <p className="text-sm font-bold text-purple-400">Ghost Paymaster</p>
                </div>
                <div className="border-l border-white/10 pl-6">
                  <p className="text-[9px] text-gray-600 uppercase tracking-widest">USDC sent</p>
                  <p className="text-sm font-black text-yellow-400">{amount || "0.2"} USDC</p>
                </div>
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
                  Smart Account (CREATE2) — 0 BNB wallet
                </p>
                <p className="font-mono text-xs text-purple-800 break-all mb-2">{smartAcct}</p>

                {/* USDC balance row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-600">USDC balance:</span>
                    {smartAcctUsdcBal === null ? (
                      <span className="text-xs text-purple-400 italic">loading…</span>
                    ) : (
                      <span className={`text-xs font-bold font-mono ${parseFloat(smartAcctUsdcBal) > 0 ? "text-green-700" : "text-red-600"}`}>
                        {parseFloat(smartAcctUsdcBal).toFixed(4)} USDC
                      </span>
                    )}
                  </div>
                  {/* Fund button — sends USDC from connected EOA to smart account */}
                  {wallet && amount && (
                    <button
                      onClick={handleFundSmartAccount}
                      disabled={funding}
                      className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-purple-600 text-white rounded-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {funding ? "Funding…" : `Fund ${amount} USDC →`}
                    </button>
                  )}
                </div>

                {/* Warning if zero balance and action is send_usdc/usdt */}
                {smartAcctUsdcBal !== null && parseFloat(smartAcctUsdcBal) === 0 && (action === "send_usdc" || action === "send_usdt") && (
                  <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-sm">
                    <span className="text-red-500 shrink-0">⚠</span>
                    <p className="text-[10px] text-red-700 leading-relaxed">
                      <strong>Smart account has 0 USDC.</strong> The USDC.transfer() call will fail silently.
                      Click <strong>Fund {amount} USDC →</strong> above to send USDC from your connected wallet
                      ({`${wallet.slice(0, 6)}…${wallet.slice(-4)}`}) to this smart account first.
                    </p>
                  </div>
                )}

                {smartAcctUsdcBal !== null && parseFloat(smartAcctUsdcBal) > 0 && (
                  <p className="text-[10px] text-green-700 mt-2">
                    ✓ Smart account has {parseFloat(smartAcctUsdcBal).toFixed(4)} USDC — ready to relay.
                  </p>
                )}
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
                    Sending <strong className="text-black">0.2 USDC</strong> from smart account with <span className="text-green-600 font-semibold">0 BNB</span> — gas auto-paid by Ghost Paymaster.
                    Check balance on <a
                      href={`https://testnet.bscscan.com/address/${smartAcct || "..."}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline"
                    >BscScan</a>.
                  </p>
                  <div className="flex gap-1.5 mb-2">
                    {["0.2", "0.5", "1", "5", "10"].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(q)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-sm border transition-all ${amount === q ? "bg-black text-white border-black" : "bg-white border-[#e5e7eb] text-gray-600 hover:border-gray-400"}`}
                      >{q}</button>
                    ))}
                  </div>
                  <div className="flex border-2 border-[#e5e7eb] rounded-sm overflow-hidden focus-within:border-black transition-colors">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.2"
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
            {/* ── Hero: THE MAIN MESSAGE ── */}
            <div className="bg-black text-white rounded-sm p-7 mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-400 mb-2">Ghost Paymaster · ERC-4337</p>
              <p className="text-4xl font-black tracking-tight leading-none mb-1">0 BNB</p>
              <p className="text-lg text-gray-300 font-light">paid from your wallet</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                <p className="text-sm text-green-300 font-semibold">Gas fully sponsored on-chain · Verified by ZK proof</p>
              </div>
            </div>

            {/* ── Live receipt from chain ── */}
            {gasReceipt ? (
              <div className="border-2 border-green-400 bg-green-50 rounded-sm overflow-hidden mb-6">
                <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest">⛽ Gas Sponsorship Receipt</span>
                  <span className="text-[10px] font-mono opacity-80">live from chain</span>
                </div>
                <div className="divide-y divide-green-200">
                  {[
                    { label: "Actual BNB gas cost", val: gasReceipt.gasCostBnb + " BNB", bold: false },
                    { label: "Fee charged (USDC)", val: gasReceipt.feeUsdc === "0.000000" ? "absorbed by protocol" : gasReceipt.feeUsdc + " USDC", bold: false },
                    { label: "Paid by", val: "Ghost Paymaster", bold: true },
                    { label: "Your wallet contributed", val: "0 BNB  ✓", bold: true },
                    { label: "Nullifier spent", val: gasReceipt.nullifier, bold: false },
                  ].map(({ label, val, bold }) => (
                    <div key={label} className="flex justify-between items-center px-4 py-3">
                      <span className="text-xs text-green-700">{label}</span>
                      <span className={`text-xs font-mono ${bold ? "font-black text-green-900 text-sm" : "text-green-800"}`}>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-green-100 border-t border-green-200">
                  <a
                    href={`https://testnet.bscscan.com/tx/${txHash}#eventlog`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-bold text-green-700 underline underline-offset-2"
                  >
                    View GasSponsored event on BscScan ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-sm p-3 mb-6">
                <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-xs text-green-600">Fetching gas receipt from chain…</span>
              </div>
            )}

            {/* ── Transaction details ── */}
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
              <div className="px-4 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transaction Details</span>
              </div>
              {[
                { label: "Action", val: ACTION_OPTIONS.find(a => a.id === action)?.label ?? action },
                { label: "ZK proof", val: "Groth16 · verified on-chain" },
                { label: "On-chain link to depositor", val: "None" },
                { label: "Smart account", val: smartAcct ? `${smartAcct.slice(0, 10)}…${smartAcct.slice(-6)}` : "deployed" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between px-4 py-3 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-xs font-semibold text-gray-900 font-mono">{val}</span>
                </div>
              ))}
            </div>

            {/* ── Tx hash + actions ── */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Transaction Hash</p>
            <div className="border border-[#e5e7eb] rounded-sm p-3 font-mono text-xs break-all bg-[#f9fafb] mb-3">{txHash}</div>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { navigator.clipboard.writeText(txHash); setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }}
                className={`text-xs font-bold flex items-center gap-2 px-4 py-2.5 rounded-sm border-2 transition-all btn-brutalist ${hashCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"}`}
              >
                {hashCopied ? "✓ Copied" : "⎘ Copy hash"}
              </button>
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold flex items-center gap-2 px-4 py-2.5 rounded-sm border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-all btn-brutalist"
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
                <p className="text-xs text-red-600 mt-1 font-mono leading-relaxed break-all">{progress?.error}</p>
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

        {/* ── Scenario box ── */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">This Relay — Scenario</p>
        <div className="bg-black text-white rounded-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400 mb-3">Demo: Send USDC from 0 BNB account</p>
            <div className="space-y-2">
              {[
                { icon: "💳", label: "Pool deposit", val: "0.2 USDC" },
                { icon: "⛽", label: "BNB in fresh wallet", val: "0.000000" },
                { icon: "🔒", label: "ZK proof", val: "Groth16 on-chain" },
                { icon: "🚀", label: "Action", val: "Send USDC — gasless" },
              ].map(({ icon, label, val }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-white">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 flex items-center justify-between bg-purple-900/20">
            <span className="text-xs text-gray-500">Gas source</span>
            <span className="text-xs font-bold text-purple-400">Ghost Paymaster → EntryPoint</span>
          </div>
        </div>

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
            { label: "Repaid from", val: "0.2 USDC pool deposit", accent: "" },
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
            "Send 0.2 USDC with zero BNB in wallet",
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
