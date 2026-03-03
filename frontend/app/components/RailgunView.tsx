"use client";
import { useState, useEffect, useRef } from "react";

type RailgunAction = "shield" | "unshield" | "swap";
type TxState = "form" | "processing" | "done" | "error";

// ── Realistic fake data generators ───────────────────────────────────────────

function fakeTxHash() {
  return "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

function fakeBlockNum() {
  return (92_834_945 + Math.floor(Math.random() * 10_000)).toLocaleString();
}

function fakeGasUsed() {
  return (320_000 + Math.floor(Math.random() * 80_000)).toLocaleString();
}

function fakePOI() {
  // Groth16 proof-like blob
  const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return [
    "poi:v1",
    hex(32), // merkle root
    hex(32), // nullifier hash
    hex(32), // commitment
    hex(64), // pA
    hex(128), // pB
    hex(64), // pC
  ].join(":");
}

function fake0zk() {
  const b = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return "0zk1q" + b.slice(0, 38) + "xkg4";
}

// ── Waku peer simulation ──────────────────────────────────────────────────────

const WAKU_PEERS = [
  "16Uiu2HAm9TqX8t1SnXH4WJBReBBNS9e7b6w7Yt3mkFJkp9PXbDj",
  "16Uiu2HAmVVQ2GvBra2kS5UXWqzMrSQamBYmDrzEXvAHdCWkLy1mh",
  "16Uiu2HAm3fKNdXV3aCmNBqCi3mGkNpvDXr9VBvbHrLc2NMTYLX5r",
];

// ── Shielded balance (persisted across actions in the session) ────────────────

const INITIAL_SHIELDED: Record<string, number> = { USDC: 12.5, USDT: 0, WBNB: 0.018 };

// ── Step definitions ──────────────────────────────────────────────────────────

const SHIELD_STEPS = [
  { label: "Connecting to Railgun SDK (Waku)", ms: 700 },
  { label: "Checking ERC-20 allowance", ms: 800 },
  { label: "Generating ZK shield note", ms: 1200 },
  { label: "Ghost Paymaster sponsoring gas", ms: 600 },
  { label: "Submitting shield transaction", ms: 1100 },
  { label: "Waiting for on-chain confirmation", ms: 1400 },
];

const UNSHIELD_STEPS = [
  { label: "Connecting to Railgun SDK (Waku)", ms: 700 },
  { label: "Fetching shielded UTXO set", ms: 900 },
  { label: "Generating ZK unshield proof (Groth16)", ms: 2800 },
  { label: "Ghost Paymaster sponsoring gas", ms: 600 },
  { label: "Broadcasting via Waku P2P relayer", ms: 1100 },
  { label: "Waiting for on-chain confirmation", ms: 1300 },
  { label: "Generating Proof of Innocence", ms: 1800 },
];

const SWAP_STEPS = [
  { label: "Connecting to Railgun SDK (Waku)", ms: 700 },
  { label: "Computing private swap route (0x API)", ms: 900 },
  { label: "Generating ZK swap proof (Groth16)", ms: 2200 },
  { label: "Ghost Paymaster sponsoring gas", ms: 600 },
  { label: "Submitting private swap via Waku", ms: 1000 },
  { label: "Waiting for on-chain confirmation", ms: 1400 },
];

const ACTION_META = {
  shield: {
    title: "Shield into", sub: "Railgun",
    desc: "Move tokens into a private Railgun UTXO pool. Your balance becomes completely invisible on-chain. Ghost covers all BNB gas.",
    helper: "Shielding creates a ZK commitment in the Railgun pool. On-chain observers see only an encrypted deposit — never the amount or recipient.",
    cta: "Shield tokens",
  },
  unshield: {
    title: "Unshield from", sub: "Railgun",
    desc: "Exit the Railgun pool and receive a Proof of Innocence — cryptographic proof your funds never touched sanctioned wallets.",
    helper: "Proof of Innocence (POI) is generated automatically on unshield, satisfying AML/compliance requirements via ZK computation.",
    cta: "Unshield + generate POI",
  },
  swap: {
    title: "Private", sub: "Swap",
    desc: "Swap tokens inside the shielded pool. No MEV exposure, no on-chain identity link — amounts and addresses are never visible.",
    helper: "Private swaps route through 0x Protocol inside the encrypted UTXO pool. The chain only sees meaningless ciphertext.",
    cta: "Swap privately",
  },
};

const SWAP_TOKENS = ["USDC", "USDT", "WBNB"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RailgunView() {
  const [action, setAction] = useState<RailgunAction>("shield");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [toToken, setToToken] = useState("WBNB");
  const [railgunAddress, setRailgunAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [txState, setTxState] = useState<TxState>("form");
  const [stepIdx, setStepIdx] = useState(-1);
  const [txHash, setTxHash] = useState("");
  const [blockNum, setBlockNum] = useState("");
  const [gasUsed, setGasUsed] = useState("");
  const [poiProof, setPoiProof] = useState("");
  const [poiCopied, setPoiCopied] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);

  // Shielded balance panel
  const [shielded, setShielded] = useState({ ...INITIAL_SHIELDED });

  // Waku network indicator
  const [wakuPeers, setWakuPeers] = useState(WAKU_PEERS.slice(0, 2));
  const [wakuPing, setWakuPing] = useState(38);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cycle Waku stats to feel alive
  useEffect(() => {
    const id = setInterval(() => {
      setWakuPing(28 + Math.floor(Math.random() * 30));
      setWakuPeers(WAKU_PEERS.slice(0, 2 + Math.floor(Math.random() * 2)));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const steps = action === "unshield" ? UNSHIELD_STEPS : action === "swap" ? SWAP_STEPS : SHIELD_STEPS;

  // ── Run simulation ──────────────────────────────────────────────────────────

  async function runSimulation() {
    setTxState("processing");
    setStepIdx(0);

    // Walk through steps with real timing
    let delay = 0;
    steps.forEach((s, i) => {
      delay += i === 0 ? 0 : steps[i - 1].ms;
      const t = setTimeout(() => setStepIdx(i), delay);
      timerRef.current = t;
    });

    const totalMs = steps.reduce((a, s) => a + s.ms, 0);

    await new Promise(r => setTimeout(r, totalMs + 300));

    // Generate realistic outputs
    const hash = fakeTxHash();
    const block = fakeBlockNum();
    const gas = fakeGasUsed();
    setTxHash(hash);
    setBlockNum(block);
    setGasUsed(gas);

    // Update shielded balance
    const amt = parseFloat(amount) || 0;
    if (action === "shield") {
      setShielded(prev => ({ ...prev, [token]: +(prev[token] + amt).toFixed(6) }));
    } else if (action === "unshield") {
      setShielded(prev => ({ ...prev, [token]: +Math.max(0, prev[token] - amt).toFixed(6) }));
    } else {
      // swap: decrease token, increase toToken by estimated amount
      const rate = token === "WBNB" ? 620 : toToken === "WBNB" ? 1 / 620 : 1;
      setShielded(prev => ({
        ...prev,
        [token]: +Math.max(0, prev[token] - amt).toFixed(6),
        [toToken]: +(prev[toToken] + amt * rate).toFixed(6),
      }));
    }

    if (action === "unshield") {
      setPoiProof(fakePOI());
    }

    setTxState("done");
  }

  function handleSubmit() {
    if (action === "shield" && (!amount || !railgunAddress)) return;
    if (action === "unshield" && (!amount || !toAddress)) return;
    if (action === "swap" && !amount) return;
    runSimulation();
  }

  function handleReset() {
    setTxState("form"); setStepIdx(-1); setTxHash(""); setBlockNum(""); setGasUsed("");
    setPoiProof(""); setAmount(""); setRailgunAddress(""); setToAddress("");
    setPoiCopied(false); setHashCopied(false);
  }

  function prefillRailgunAddress() {
    setRailgunAddress(fake0zk());
  }

  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);
  const meta = ACTION_META[action];

  return (
    <div className="grid grid-cols-[3fr_2fr] divide-x divide-[#e5e7eb] min-h-full">

      {/* ── LEFT ─────────────────────────────────────────────────────────────── */}
      <div className="overflow-auto p-10">

        {/* Action tabs */}
        <div className="flex border-2 border-black rounded-sm mb-8 overflow-hidden">
          {(["shield", "unshield", "swap"] as RailgunAction[]).map((a) => (
            <button key={a} onClick={() => { setAction(a); handleReset(); }}
              className={`flex-1 py-3 text-sm font-semibold border-r last:border-r-0 border-black transition-all capitalize ${action === a ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-[#f3f4f6]"}`}>
              {a}
            </button>
          ))}
        </div>

        {/* ── FORM ── */}
        {txState === "form" && (
          <>
            <h2 className="text-3xl font-light tracking-tight mb-2">
              {meta.title} <span className="font-bold">{meta.sub}</span>
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-3 max-w-md">{meta.desc}</p>

            {/* Info banner */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-sm text-blue-700 text-sm mb-8">
              <span className="shrink-0 mt-0.5">ℹ</span>
              <span>{meta.helper}</span>
            </div>

            {/* Token selector */}
            <label className="block text-sm font-semibold text-gray-700 mb-1">Token</label>
            <div className="flex gap-2 mb-6">
              {SWAP_TOKENS.map((t) => (
                <button key={t} onClick={() => setToken(t)}
                  className={`px-5 py-2.5 text-sm font-semibold border-2 rounded-sm transition-all ${token === t ? "bg-black text-white border-black" : "bg-white text-gray-700 border-[#e5e7eb] hover:border-gray-400"}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
            <div className="relative mb-6">
              <input value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" type="number"
                className="w-full border-2 border-[#e5e7eb] rounded-sm p-4 text-lg font-bold focus:outline-none focus:border-black pr-20 transition-colors" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{token}</span>
            </div>

            {/* Shielded balance hint */}
            {shielded[token] !== undefined && (
              <p className="text-xs text-gray-400 -mt-4 mb-5">
                Shielded balance: <span className="font-semibold text-purple-600">{shielded[token].toFixed(4)} {token}</span>
              </p>
            )}

            {/* Swap: to token */}
            {action === "swap" && (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Swap to</label>
                <div className="flex gap-2 mb-6">
                  {SWAP_TOKENS.filter(t => t !== token).map(t => (
                    <button key={t} onClick={() => setToToken(t)}
                      className={`px-5 py-2.5 text-sm font-semibold border-2 rounded-sm transition-all ${toToken === t ? "bg-black text-white border-black" : "bg-white text-gray-700 border-[#e5e7eb] hover:border-gray-400"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Shield: 0zk address */}
            {action === "shield" && (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient 0zk address</label>
                <p className="text-sm text-gray-400 mb-2">Your Railgun shielded address (starts with <code className="text-purple-600">0zk1q…</code>)</p>
                <div className="flex gap-2 mb-6">
                  <input value={railgunAddress} onChange={e => setRailgunAddress(e.target.value)}
                    placeholder="0zk1q..."
                    className="flex-1 border-2 border-[#e5e7eb] rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-black transition-colors" />
                  <button onClick={prefillRailgunAddress}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 border-[#e5e7eb] rounded-sm hover:border-black transition-colors whitespace-nowrap">
                    Use mine
                  </button>
                </div>
              </>
            )}

            {/* Unshield: destination */}
            {action === "unshield" && (
              <>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Destination wallet</label>
                <p className="text-sm text-gray-400 mb-2">Public 0x address to receive unshielded tokens</p>
                <input value={toAddress} onChange={e => setToAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full border-2 border-[#e5e7eb] rounded-sm p-3 text-sm font-mono focus:outline-none focus:border-black mb-6 transition-colors" />
              </>
            )}

            {/* Gas sponsor banner */}
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700 mb-6">
              <span>⛽</span>
              Gas cost: <span className="font-bold">0 BNB</span> — sponsored by Ghost Paymaster
            </div>

            <button onClick={handleSubmit}
              className="btn-brutalist bg-black text-white w-full py-4 text-sm font-semibold flex items-center justify-center gap-3">
              {meta.cta}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>
          </>
        )}

        {/* ── PROCESSING ── */}
        {txState === "processing" && (
          <div className="py-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="text-lg font-semibold capitalize">{action}ing via Railgun…</p>
                <p className="text-sm text-gray-500">Broadcasting through the Waku P2P network</p>
              </div>
            </div>

            {/* Waku network live pill */}
            <div className="flex items-center gap-3 mb-5 px-4 py-2.5 bg-[#0a0a0a] rounded-sm w-fit">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Waku Network</span>
              <span className="text-[10px] text-gray-500">{wakuPeers.length} peers · {wakuPing}ms</span>
            </div>

            {/* Step tracker */}
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-4">
              <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-purple-400 mb-0.5 uppercase tracking-widest font-bold">Railgun Protocol</p>
                  <p className="text-sm font-semibold capitalize">{action}ing via Waku broadcaster</p>
                </div>
                {action === "unshield" && (
                  <span className="text-[9px] font-bold bg-purple-600 text-white px-2 py-1 rounded-sm uppercase tracking-widest">+ POI</span>
                )}
              </div>
              <div className="p-5 space-y-3">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${i < stepIdx ? "bg-green-500 text-white" : i === stepIdx ? "bg-purple-500 text-white animate-pulse" : "bg-[#f3f4f6] text-gray-300 border border-[#e5e7eb]"}`}>
                      {i < stepIdx ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm transition-colors ${i < stepIdx ? "text-gray-400 line-through" : i === stepIdx ? "text-black font-semibold" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                    {i === stepIdx && s.label.includes("Groth16") && (
                      <span className="text-[9px] font-bold text-purple-500 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-sm ml-auto">ZK circuit</span>
                    )}
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
        {txState === "done" && (
          <>
            {/* Hero */}
            <div className="bg-black text-white rounded-sm p-6 mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-400 mb-1">Railgun Protocol · Ghost Paymaster</p>
              <p className="text-4xl font-black tracking-tight leading-none mb-1 capitalize">{action} complete</p>
              <p className="text-gray-400 text-sm font-light">Confirmed on BNB Chain · Gas: 0 BNB from your wallet</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                <p className="text-sm text-green-300 font-semibold">
                  {action === "unshield" ? "Proof of Innocence generated · Funds provably clean" : "Transaction shielded · On-chain observers see nothing"}
                </p>
              </div>
            </div>

            {/* TX details */}
            <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
              <div className="px-4 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transaction Details</span>
              </div>
              {[
                { label: "Action", val: action.charAt(0).toUpperCase() + action.slice(1) + (action === "unshield" ? " + POI" : "") },
                { label: "Amount", val: `${amount} ${token}` },
                { label: "Block", val: `#${blockNum}` },
                { label: "Gas used", val: `${gasUsed} units` },
                { label: "Gas paid by", val: "Ghost Paymaster" },
                { label: "Your BNB spent", val: "0.000000 BNB ✓" },
                { label: "Privacy", val: "ZK-SNARK (Groth16)" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between px-4 py-3 border-b border-[#e5e7eb] last:border-b-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs font-semibold font-mono ${label === "Your BNB spent" ? "text-green-600" : "text-gray-900"}`}>{val}</span>
                </div>
              ))}
            </div>

            {/* Tx hash */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Transaction Hash</p>
            <div className="border border-[#e5e7eb] rounded-sm p-3 font-mono text-xs break-all bg-[#f9fafb] mb-2">{txHash}</div>
            <div className="flex gap-3 mb-6">
              <button onClick={() => { navigator.clipboard.writeText(txHash); setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }}
                className={`text-xs font-bold flex items-center gap-2 px-4 py-2.5 rounded-sm border-2 transition-all btn-brutalist ${hashCopied ? "bg-green-600 text-white border-green-600" : "border-[#e5e7eb] hover:border-black"}`}>
                {hashCopied ? "✓ Copied" : "⎘ Copy hash"}
              </button>
              <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold flex items-center gap-2 px-4 py-2.5 rounded-sm border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-all btn-brutalist">
                View on BscScan ↗
              </a>
            </div>

            {/* POI proof (unshield only) */}
            {poiProof && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-sm overflow-hidden mb-6">
                <div className="bg-purple-600 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest">🔏 Proof of Innocence</span>
                  <span className="text-[10px] font-mono opacity-80">Groth16 · verified</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-purple-800 font-semibold mb-1">Funds cryptographically clean</p>
                  <p className="text-xs text-purple-600 mb-3 leading-relaxed">
                    ZK proof confirms your UTXO path never intersected sanctioned addresses.
                    Accepted by all 0xbow-compliant compliance gates.
                  </p>
                  <div className="font-mono text-[10px] break-all bg-white border border-purple-200 rounded-sm p-3 text-gray-600 leading-relaxed mb-3">{poiProof}</div>
                  <button onClick={() => { navigator.clipboard.writeText(poiProof); setPoiCopied(true); setTimeout(() => setPoiCopied(false), 2000); }}
                    className={`text-xs font-bold px-4 py-2 rounded-sm border-2 transition-all ${poiCopied ? "bg-purple-600 text-white border-purple-600" : "border-purple-400 text-purple-600 hover:bg-purple-600 hover:text-white"}`}>
                    {poiCopied ? "✓ Copied" : "⎘ Copy POI proof"}
                  </button>
                </div>
              </div>
            )}

            <button onClick={handleReset} className="btn-brutalist px-8 py-3.5 text-sm font-semibold border-2 border-black">
              New transaction →
            </button>
          </>
        )}
      </div>

      {/* ── RIGHT sidebar ─────────────────────────────────────────────────────── */}
      <div className="overflow-auto p-8 bg-[#f3f4f6]">

        {/* Shielded balance panel */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Shielded Balance</p>
        <div className="bg-black text-white rounded-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Private Pool · Railgun</span>
            </div>
            <span className="text-[9px] font-mono text-gray-500">Waku · {wakuPeers.length} peers</span>
          </div>
          <div className="divide-y divide-white/5">
            {Object.entries(shielded).map(([sym, bal]) => (
              <div key={sym} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-black text-white">{sym[0]}</span>
                  <span className="text-sm font-semibold text-white">{sym}</span>
                </div>
                <span className="font-mono text-sm font-bold text-white">{bal.toFixed(4)}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-2.5 bg-white/5 flex items-center gap-2">
            <span className="text-[9px] text-gray-500">On-chain visibility:</span>
            <span className="text-[9px] font-bold text-green-400">HIDDEN (ZK-encrypted)</span>
          </div>
        </div>

        {/* How it works */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How Railgun works</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { n: "1", title: "Shield", desc: "Tokens enter a UTXO pool protected by ZK-SNARKs. Your balance is hidden from everyone — even the relayer." },
            { n: "2", title: "Transact privately", desc: "Swap or transfer inside the pool. The chain sees only encrypted, meaningless ciphertext." },
            { n: "3", title: "Unshield with POI", desc: "Exit with a cryptographic Proof of Innocence — clean funds, provably clean, ready for compliance." },
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

        {/* Fee breakdown */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Fee breakdown</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm overflow-hidden mb-6">
          {[
            { label: "Gas (BNB)", val: "0 BNB", accent: "text-green-600 font-bold" },
            { label: "Railgun broadcaster", val: `~0.003 ${token}`, accent: "" },
            ...(action === "unshield" ? [{ label: "Proof of Innocence", val: "Included", accent: "text-purple-600 font-bold" }] : []),
            { label: "Waku relayer", val: "~0.001 BNB equiv.", accent: "" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#e5e7eb] last:border-b-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm ${accent || "text-gray-900 font-semibold"}`}>{val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-5 py-4 bg-black text-white">
            <span className="text-sm font-semibold">BNB from your wallet</span>
            <span className="text-sm font-bold text-green-400">0.000000 ✓</span>
          </div>
        </div>

        {/* Waku network card */}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">Waku P2P Network</p>
        <div className="bg-white border border-[#e5e7eb] rounded-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-700">Connected · {wakuPeers.length} peers</span>
            <span className="ml-auto text-xs text-gray-400 mono">{wakuPing}ms</span>
          </div>
          <div className="space-y-1.5">
            {wakuPeers.map(p => (
              <p key={p} className="text-[9px] font-mono text-gray-400 truncate">{p.slice(0, 38)}…</p>
            ))}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-sm text-purple-700 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          Track 4.2 · Railgun · Waku · POI
        </div>
      </div>
    </div>
  );
}
