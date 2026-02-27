import Image from "next/image";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

export default function Home() {
  return (
    <div className="font-(family-name:--font-manrope) text-black antialiased">
      {/* Flickering grid background */}
      <div className="fixed inset-0 -z-10">
        <FlickeringGrid
          className="w-full h-full"
          squareSize={4}
          gridGap={6}
          color="#000000"
          maxOpacity={0.08}
          flickerChance={0.15}
        />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e7eb]">
        <nav className="container mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Image src="/image.png" alt="Ghost" width={120} height={36} priority />
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-10 text-sm font-medium">
            <a className="hover:text-purple-500 transition-colors" href="#">Developers</a>
            <a className="hover:text-purple-500 transition-colors" href="#">Ecosystem</a>
            <a className="hover:text-purple-500 transition-colors" href="#">Community</a>
            <a className="hover:text-purple-500 transition-colors" href="#">Resources</a>
          </div>

          {/* CTA */}
          <button className="bg-black text-white px-5 py-2 text-xs font-bold uppercase tracking-widest btn-brutalist">
            Connect
          </button>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="min-h-[calc(100vh-56px)] flex items-center container mx-auto px-6 py-24">
          <div className="max-w-4xl">
            <div className="inline-block border border-black px-3 py-1 mb-8 text-[10px] uppercase font-bold tracking-[0.2em] bg-white">
              v1.0.4 - Live on Mainnet
            </div>
            <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-10">
              Privacy <br />
              <span className="text-purple-500">Limitless</span> <br />
              for BNB Chain
            </h1>
            <div className="flex flex-col md:flex-row md:items-center gap-8 mt-12">
              <button className="bg-black text-white px-8 py-5 text-sm font-bold flex items-center group btn-brutalist">
                START SHIELDING
                <svg
                  className="ml-4 w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
              <div className="text-gray-500 text-xs max-w-xs leading-relaxed uppercase tracking-wider">
                Enterprise-grade anonymity meets <br /> the efficiency of BNB Chain.
              </div>
            </div>
          </div>
        </section>

        {/* Positioning Section */}
        <section className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
              <div className="md:col-span-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">
                  Positioning
                </h2>
              </div>
              <div className="md:col-span-8">
                <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight">
                  Ghost is a complete{" "}
                  <span className="font-bold">privacy infrastructure layer</span> for BNB
                  Chain — from gas bootstrapping to private DeFi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Principles / Features Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-black bg-black">
            {/* Feature 1 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80 border-r border-black md:border-r-0 md:border-b-0 border-b">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  01
                </div>
                <h3 className="text-xl font-bold mb-4">Gas Relayer</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Bootstrapping new addresses with private gas funding via decentralized
                  relayer networks.
                </p>
              </div>
              <a
                className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500"
                href="#"
              >
                Learn more →
              </a>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80 border-r border-black md:border-r-0 md:border-b-0 border-b">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  02
                </div>
                <h3 className="text-xl font-bold mb-4">Privacy SDK</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Zero-knowledge proof generation for any dApp on BNB Chain. Simple
                  integration for developers.
                </p>
              </div>
              <a
                className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500"
                href="#"
              >
                Docs →
              </a>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  03
                </div>
                <h3 className="text-xl font-bold mb-4">Private Transactions</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Fully shielded token transfers and swaps using advanced zk-SNARKs
                  technology.
                </p>
              </div>
              <a
                className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500"
                href="#"
              >
                Shield now →
              </a>
            </div>
          </div>
        </section>

        {/* Live Stats Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="bg-[#f3f4f6] border border-[#e5e7eb] p-12">
            <div className="flex flex-col md:flex-row justify-between items-end">
              <div className="mb-8 md:mb-0">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                  Network Activity
                </h4>
                <div className="text-4xl md:text-6xl font-bold tracking-tighter">
                  Total Volume Shielded:{" "}
                  <span className="text-purple-500">$1.42B+</span>
                </div>
              </div>
              <div className="w-full md:w-64 h-24">
                <svg className="w-full h-full" viewBox="0 0 200 80">
                  <path
                    d="M0 70 L20 65 L40 68 L60 50 L80 55 L100 30 L120 35 L140 15 L160 20 L180 5 L200 10"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M0 70 L20 65 L40 68 L60 50 L80 55 L100 30 L120 35 L140 15 L160 20 L180 5 L200 10 V80 H0 Z"
                    fill="#a855f7"
                    fillOpacity={0.1}
                  />
                </svg>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase">
                  <span>24H Volume</span>
                  <span>+12.4%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works — 3 Steps */}
        <section className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="mb-16">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">How It Works</h2>
              <p className="text-3xl md:text-4xl font-light tracking-tight max-w-xl">
                Three steps to <span className="font-bold">complete invisibility</span>.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-black">
              {/* Step 1 */}
              <div className="p-10 border-b md:border-b-0 md:border-r border-black">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Step 01 — Deposit</div>
                <h3 className="text-lg font-bold mb-3">Deposit USDC into Ghost Pool</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  From any wallet, deposit 1 / 10 / 100 / 1000 USDC into the Poseidon Merkle pool. Receive a cryptographic <span className="font-semibold text-black">Note</span> — your private key to gas.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">OFAC screened on entry →</div>
              </div>
              {/* Step 2 */}
              <div className="p-10 border-b md:border-b-0 md:border-r border-black">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Step 02 — Relay</div>
                <h3 className="text-lg font-bold mb-3">Transact from a fresh wallet</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  From a fresh wallet with zero BNB, paste your Note. A ZK proof is generated locally — it never leaves your browser. Ghost Paymaster pays gas. Zero on-chain link.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">ERC-4337 · Dual ZK proof →</div>
              </div>
              {/* Step 3 */}
              <div className="p-10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Step 03 — Private DeFi</div>
                <h3 className="text-lg font-bold mb-3">Shield into Railgun</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  Ghost Paymaster sponsors Railgun shield/unshield gas — the first of its kind. Swap, transfer, and exit with a Proof of Innocence. Clean funds, clean conscience.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">Proof of Innocence on exit →</div>
              </div>
            </div>
          </div>
        </section>

        {/* Compliance Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Compliance</h2>
              <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight mb-8">
                Privacy that passes <span className="font-bold">regulatory scrutiny</span>.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Ghost implements the <span className="font-semibold text-black">0xbow ASP model</span> — the gold standard for compliant privacy protocols. Not just privacy. Provable innocence.
              </p>
            </div>
            <div className="md:col-span-7 space-y-0 border border-black">
              {[
                { label: "Pool Membership Proof", desc: "ZK-prove you deposited without revealing which UTXO. Groth16 on-chain verification.", tag: "Circom + Groth16" },
                { label: "ASP Clean Set Proof", desc: "0xbow-attested: your commitment exists in the OFAC-clean Merkle root. Not just in the pool.", tag: "0xbow Compliant" },
                { label: "OFAC SDN Screening", desc: "Every deposit and relay address is checked against the OFAC SDN list, synced every 60 minutes.", tag: "Auto-Synced" },
                { label: "Proof of Innocence", desc: "On Railgun exit, ZK-prove your complete transaction history never touched sanctioned funds.", tag: "Railgun POI" },
                { label: "Viewing Keys", desc: "Share your viewing key with regulators. They see everything. The chain still sees nothing.", tag: "Auditor Ready" },
              ].map((item, i, arr) => (
                <div key={i} className={`flex items-start justify-between p-6 bg-white ${i < arr.length - 1 ? "border-b border-black" : ""}`}>
                  <div className="flex-1 pr-8">
                    <div className="font-bold text-sm mb-1">{item.label}</div>
                    <div className="text-gray-500 text-xs leading-relaxed">{item.desc}</div>
                  </div>
                  <div className="shrink-0 border border-purple-500 text-purple-500 text-[9px] font-bold uppercase tracking-widest px-2 py-1">{item.tag}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy Score Section */}
        <section className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Privacy Score</h2>
                <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight mb-6">
                  Know your <span className="font-bold">exposure</span>. Own your privacy.
                </p>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                  A 0–100 on-chain exposure meter for every wallet. Shareable. Viral. Ghost users score higher — because privacy is provable.
                </p>
                <button className="bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-widest btn-brutalist">
                  Check Your Score →
                </button>
              </div>
              {/* Score visual */}
              <div className="border border-black p-10 bg-[#f3f4f6]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Sample Wallet Score</div>
                <div className="flex items-end gap-4 mb-6">
                  <span className="text-8xl font-bold tracking-tighter text-purple-500">87</span>
                  <span className="text-gray-400 text-sm font-medium mb-3">/ 100</span>
                </div>
                <div className="w-full bg-[#e5e7eb] h-2 mb-6">
                  <div className="bg-purple-500 h-2" style={{ width: "87%" }} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {[
                    { label: "Deposits Shielded", val: "3" },
                    { label: "Relay Txs", val: "12" },
                    { label: "Railgun Shields", val: "2" },
                    { label: "OFAC Clean", val: "✓" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-[#e5e7eb] p-3">
                      <div className="text-gray-400 uppercase tracking-widest text-[9px] mb-1">{s.label}</div>
                      <div className="font-bold">{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SDK / Developer Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="mb-12">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Developer SDK</h2>
            <p className="text-3xl md:text-4xl font-light tracking-tight max-w-2xl">
              One component. <span className="font-bold">Ghost Mode</span> for any dApp.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black">
            {/* Code block */}
            <div className="bg-black text-white p-10 font-mono text-xs leading-relaxed border-b md:border-b-0 md:border-r border-[#333]">
              <div className="text-gray-500 mb-4 text-[10px] uppercase tracking-widest">Option A — Drop-in</div>
              <div><span className="text-purple-400">import</span> {"{ PrivacyProvider }"} <span className="text-purple-400">from</span> <span className="text-green-400">&apos;@ghost-privacy/sdk/react&apos;</span></div>
              <div className="mt-4"><span className="text-gray-500">// Wrap your existing app</span></div>
              <div className="mt-2">{"<"}<span className="text-purple-400">PrivacyProvider</span> <span className="text-yellow-400">chainId</span>={"{56}"}{">"}</div>
              <div className="pl-4 text-gray-400">{"<YourExistingDApp />"}</div>
              <div>{"</"}<span className="text-purple-400">PrivacyProvider</span>{">"}</div>
              <div className="mt-4 text-gray-500 text-[10px]">↑ Users get a Ghost Mode toggle automatically</div>
            </div>
            {/* Features list */}
            <div className="bg-white p-10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-8">What you get</div>
              <div className="space-y-5">
                {[
                  { icon: "⚡", title: "In-browser ZK proving", desc: "WASM Groth16 circuit — proofs generated locally, never sent to any server." },
                  { icon: "🔗", title: "ERC-4337 UserOp builder", desc: "Dual ZK proof packed into paymasterAndData automatically." },
                  { icon: "👻", title: "Chrome Extension", desc: "Auto-routes every MetaMask transaction through Ghost. Privacy without thinking." },
                  { icon: "🔍", title: "Viewing key export", desc: "Let auditors see everything with a single key. The chain still sees nothing." },
                ].map((f) => (
                  <div key={f.title} className="flex gap-4">
                    <span className="text-xl mt-0.5">{f.icon}</span>
                    <div>
                      <div className="font-bold text-sm mb-1">{f.title}</div>
                      <div className="text-gray-500 text-xs leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] bg-white mt-20">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center">
              <Image src="/image.png" alt="Ghost" width={90} height={28} />
            </div>
            <div className="flex space-x-8 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <a className="hover:text-black" href="#">Twitter/X</a>
              <a className="hover:text-black" href="#">Github</a>
              <a className="hover:text-black" href="#">Telegram</a>
              <a className="hover:text-black" href="#">Docs</a>
            </div>
            <div className="text-[10px] text-gray-400 font-medium">
              © 2024 GHOST PROTOCOL. ALL RIGHTS RESERVED.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
