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
            <a href="#hero">
              <span className="font-(family-name:--font-pixel) text-sm tracking-tight">GHOST</span>
            </a>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-10 text-sm font-medium">
            <a className="hover:text-purple-500 transition-colors" href="#how-it-works">How It Works</a>
            <a className="hover:text-purple-500 transition-colors" href="#ecosystem">Ecosystem</a>
            <a className="hover:text-purple-500 transition-colors" href="#developers">Developers</a>
            <a className="hover:text-purple-500 transition-colors" href="#compliance">Compliance</a>
            <a className="hover:text-purple-500 transition-colors" href="#community">Community</a>
          </div>

          {/* CTA */}
          <button className="bg-purple-500 text-white px-5 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none">
            Launch App
          </button>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section id="hero" className="min-h-[calc(100vh-56px)] flex items-center container mx-auto px-6 py-24">
          <div className="max-w-4xl">
            <div className="inline-block border border-black px-3 py-1 mb-8 text-[10px] uppercase font-bold tracking-[0.2em] bg-white">
              v1.0.0 — BNB Chain × YZI Labs Hackathon
            </div>
            <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-10">
              Privacy <br />
              <span className="text-purple-500">Limitless</span> <br />
              for BNB Chain
            </h1>
            <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-lg mb-10 uppercase tracking-wider">
              Compliant ZK privacy. Gasless by default. One SDK for every DApp on BNB Chain.
            </p>
            <div className="flex flex-col md:flex-row md:items-center gap-6 mt-4">
              <button className="bg-purple-500 text-white px-8 py-5 text-sm font-bold flex items-center group transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none">
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
              <a href="#developers" className="border border-black px-8 py-5 text-sm font-bold flex items-center group transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none bg-white">
                READ THE DOCS
                <svg
                  className="ml-4 w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </a>
            </div>
            {/* Stat pills */}
            <div className="flex flex-wrap gap-6 mt-16">
              {[
                { label: "Total Shielded", val: "$1.42B+" },
                { label: "Daily Relays", val: "48K+" },
                { label: "Privacy Score Avg", val: "81/100" },
                { label: "OFAC Clean", val: "100%" },
              ].map((s) => (
                <div key={s.label} className="border border-[#e5e7eb] bg-white px-5 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">{s.label}</div>
                  <div className="text-lg font-bold">{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Positioning Section */}
        <section className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
              <div className="md:col-span-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">
                  What is Ghost
                </h2>
              </div>
              <div className="md:col-span-8">
                <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight">
                  Ghost is a complete{" "}
                  <span className="font-bold">privacy infrastructure layer</span> for BNB
                  Chain — from gas bootstrapping to private DeFi, with built-in regulatory compliance.
                </p>
                <div className="flex flex-wrap gap-3 mt-8">
                  {["ERC-4337 Account Abstraction", "Groth16 ZK Proofs", "0xbow ASP Compliant", "Railgun Integration", "Proof of Innocence"].map((tag) => (
                    <span key={tag} className="border border-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Principles / Features Section */}
        <section id="features" className="container mx-auto px-6 py-24">
          <div className="mb-12">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">The Protocol</h2>
            <p className="text-3xl md:text-4xl font-light tracking-tight max-w-xl">
              Three components. <span className="font-bold">One privacy layer.</span>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-black bg-black">
            {/* Feature 1 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80 border-b md:border-b-0 md:border-r border-black">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  01
                </div>
                <h3 className="text-xl font-bold mb-4">Ghost Paymaster</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  ERC-4337 Paymaster that verifies dual ZK proofs on-chain and pays BNB gas from a communal USDC pool. Fresh wallets need zero BNB to transact. Zero on-chain link to depositor.
                </p>
              </div>
              <a className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500" href="#how-it-works">
                See how it works →
              </a>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80 border-b md:border-b-0 md:border-r border-black">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  02
                </div>
                <h3 className="text-xl font-bold mb-4">Privacy SDK</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Drop <code className="bg-gray-100 text-purple-600 px-1 text-xs">&lt;PrivacyProvider&gt;</code> into any Next.js DApp and users get Ghost Mode automatically. In-browser WASM proof generation — nothing ever leaves the browser.
                </p>
              </div>
              <a className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500" href="#developers">
                View SDK docs →
              </a>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-10 flex flex-col justify-between min-h-80">
              <div>
                <div className="w-10 h-10 bg-[#f3f4f6] border border-[#e5e7eb] mb-8 flex items-center justify-center font-bold">
                  03
                </div>
                <h3 className="text-xl font-bold mb-4">Gasless Railgun</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  First-of-its-kind: Ghost Paymaster sponsors Railgun shield and unshield gas. Private swaps and transfers via Railgun 0zk addresses, with Proof of Innocence on exit.
                </p>
              </div>
              <a className="text-xs font-bold uppercase tracking-widest mt-8 flex items-center text-purple-500" href="#how-it-works">
                Shield now →
              </a>
            </div>
          </div>
        </section>


        {/* How It Works — 3 Steps */}
        <section id="how-it-works" className="border-y border-[#e5e7eb] bg-white">
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
                  From any wallet, deposit 1 / 10 / 100 / 1000 USDC into the Poseidon Merkle pool. Receive a cryptographic <span className="font-semibold text-black">Note</span> — your private key to gas. Screened against OFAC and added to the Clean Set.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">OFAC screened on entry →</div>
              </div>
              {/* Step 2 */}
              <div className="p-10 border-b md:border-b-0 md:border-r border-black">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Step 02 — Relay</div>
                <h3 className="text-lg font-bold mb-3">Transact from a fresh wallet</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  From a fresh wallet with zero BNB, paste your Note. A ZK proof is generated locally — it never leaves your browser. Ghost Paymaster verifies two proofs on-chain and pays gas. Zero on-chain link.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">ERC-4337 · Dual ZK proof →</div>
              </div>
              {/* Step 3 */}
              <div className="p-10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Step 03 — Private DeFi</div>
                <h3 className="text-lg font-bold mb-3">Shield into Railgun — gasless</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  Ghost Paymaster sponsors Railgun shield/unshield gas — first of its kind. Swap, transfer, and exit with a Proof of Innocence. Clean funds, cryptographically proven.
                </p>
                <div className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">Proof of Innocence on exit →</div>
              </div>
            </div>


          </div>
        </section>

        {/* Compliance Section */}
        <section id="compliance" className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Compliance</h2>
              <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight mb-8">
                Privacy that passes <span className="font-bold">regulatory scrutiny</span>.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Ghost implements the <span className="font-semibold text-black">0xbow ASP model</span> — the gold standard for compliant privacy protocols. Not just privacy. Provable innocence.
              </p>
              <div className="border border-black p-6 bg-[#f9fafb]">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3">Ghost vs Tornado Cash</div>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-3"><span className="text-red-500 font-bold shrink-0">✕</span><span className="text-gray-500">Tornado: prove you&apos;re in the pool</span></div>
                  <div className="flex gap-3"><span className="text-green-500 font-bold shrink-0">✓</span><span>Ghost: prove you&apos;re in the pool</span></div>
                  <div className="flex gap-3"><span className="text-green-500 font-bold shrink-0">✓</span><span>Ghost: prove you&apos;re in the <span className="font-bold">clean set</span></span></div>
                  <div className="flex gap-3"><span className="text-green-500 font-bold shrink-0">✓</span><span>Ghost: prove full history is OFAC-free (POI)</span></div>
                  <div className="flex gap-3"><span className="text-green-500 font-bold shrink-0">✓</span><span>Ghost: viewing keys for full audit trail</span></div>
                </div>
              </div>
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

        {/* Ecosystem Section — Ghost Name Service + Chrome Extension */}
        <section id="ecosystem" className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="mb-16">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Ecosystem</h2>
              <p className="text-3xl md:text-4xl font-light tracking-tight max-w-2xl">
                Privacy tools built <span className="font-bold">for humans</span>, not just engineers.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black">
              {/* Ghost Name Service */}
              <div className="p-10 border-b md:border-b-0 md:border-r border-black bg-white">

                <h3 className="text-xl font-bold mb-3">Ghost Name Service</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  Register a <span className="font-mono text-black bg-gray-100 px-1 text-xs">ghost://username</span> handle that maps to your stealth address. Receive funds privately but share a human-readable name — like ENS, but for ZK wallets.
                </p>
                <div className="border border-[#e5e7eb] bg-[#f9fafb] p-4 font-mono text-xs mb-6">
                  <div className="text-gray-400 mb-1">// Send to anyone privately</div>
                  <div><span className="text-purple-500">ghost://</span>saish.bnb</div>
                  <div className="text-gray-400 mt-1">→ resolves to 0zk stealth address</div>
                </div>
                <a className="text-xs font-bold uppercase tracking-widest flex items-center text-purple-500" href="#">
                  Register yours →
                </a>
              </div>

              {/* Chrome Extension */}
              <div className="p-10 bg-white">

                <h3 className="text-xl font-bold mb-3">Ghost Mode Extension</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  A Chrome extension that intercepts MetaMask transactions at the <span className="font-mono text-black bg-gray-100 px-1 text-xs">window.ethereum</span> level. Toggle Ghost Mode ON — every transaction routes through Ghost automatically. No BNB needed. No manual steps. Privacy without thinking.
                </p>
                <div className="border border-black bg-[#f9fafb] p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-(family-name:--font-pixel) text-xs">GHOST</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ghost Mode</span>
                      <div className="w-10 h-5 bg-purple-500 rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Privacy Score</div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-purple-500">87</span>
                    <span className="text-gray-400 text-xs mb-1">/ 100</span>
                  </div>
                  <div className="w-full bg-[#e5e7eb] h-1.5 mt-2">
                    <div className="bg-purple-500 h-1.5" style={{ width: "87%" }} />
                  </div>
                </div>
                <a className="text-xs font-bold uppercase tracking-widest flex items-center text-purple-500" href="#">
                  Download extension →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Score Section */}
        <section id="privacy-score" className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Privacy Score</h2>
              <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight mb-6">
                Know your <span className="font-bold">exposure</span>. Own your privacy.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                A 0–100 on-chain exposure meter for every wallet on BNB Chain. Pulls from public blockchain data and shows how traceable you are. Ghost users score higher — because privacy is provable.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Share your score.
              </p>
              <button className="bg-purple-500 text-white px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none">
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
        </section>

        {/* SDK / Developer Section */}
        <section id="developers" className="border-y border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24">
            <div className="mb-12">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Developer SDK</h2>
              <p className="text-3xl md:text-4xl font-light tracking-tight max-w-2xl">
                One component. <span className="font-bold">Ghost Mode</span> for any dApp.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black">
              {/* Code block */}
              <div className="bg-black text-white p-10 font-mono text-xs leading-relaxed border-b md:border-b-0 md:border-r border-[#333]">
                <div className="text-gray-500 mb-4 text-[10px] uppercase tracking-widest">Option A — Drop-in React component</div>
                <div><span className="text-purple-400">import</span> {"{ PrivacyProvider }"} <span className="text-purple-400">from</span> <span className="text-green-400">&apos;@ghost-privacy/sdk/react&apos;</span></div>
                <div className="mt-4"><span className="text-gray-500">// Wrap your existing app once</span></div>
                <div className="mt-2">{"<"}<span className="text-purple-400">PrivacyProvider</span> <span className="text-yellow-400">chainId</span>={"<"}<span className="text-green-400">56</span>{">"}{">"}  <span className="text-gray-500">{"// BNB Chain"}</span></div>
                <div className="pl-4 text-gray-400">{"<YourExistingDApp />"}</div>
                <div>{"</"}<span className="text-purple-400">PrivacyProvider</span>{">"}</div>
                <div className="mt-4 text-gray-500 text-[10px]">↑ Users get a Ghost Mode toggle automatically</div>
                <div className="mt-6 pt-6 border-t border-[#333]">
                  <div className="text-gray-500 mb-3 text-[10px] uppercase tracking-widest">Option B — Full control</div>
                  <div><span className="text-purple-400">const</span> wallet = <span className="text-purple-400">new</span> <span className="text-yellow-400">GhostWallet</span>()</div>
                  <div><span className="text-gray-500">// spending key + viewing key</span></div>
                  <div className="mt-2"><span className="text-purple-400">const</span> proof = <span className="text-purple-400">await</span> ProofBuilder.<span className="text-yellow-400">generate</span>(note, tree)</div>
                  <div><span className="text-purple-400">await</span> GhostClient.<span className="text-yellow-400">relay</span>{"({ wallet, proof, callData })"}</div>
                  <div className="mt-2"><span className="text-gray-500">// compliance: share with auditor</span></div>
                  <div><span className="text-purple-400">const</span> key = wallet.<span className="text-yellow-400">exportViewingKey</span>()</div>
                </div>
              </div>
              {/* Features list */}
              <div className="bg-white p-10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-8">What you get</div>
                <div className="space-y-5">
                  {[
                    { icon: "ZK", title: "In-browser ZK proving", desc: "WASM Groth16 circuit — proofs generated locally, never sent to any server." },
                    { icon: "OP", title: "ERC-4337 UserOp builder", desc: "Dual ZK proof packed into paymasterAndData automatically." },
                    { icon: "EXT", title: "Chrome Extension", desc: "Auto-routes every MetaMask transaction through Ghost. Privacy without thinking." },
                    { icon: "KEY", title: "Viewing key export", desc: "Let auditors see everything with a single key. The chain still sees nothing." },
                    { icon: "GNS", title: "Ghost Name Service", desc: "Register ghost://username for your stealth address. Human-readable, ZK-backed." },
                  ].map((f) => (
                    <div key={f.title} className="flex gap-4">
                      <span className="font-(family-name:--font-pixel) text-[8px] text-purple-500 mt-1 w-8 shrink-0 leading-tight">{f.icon}</span>
                      <div>
                        <div className="font-bold text-sm mb-1">{f.title}</div>
                        <div className="text-gray-500 text-xs leading-relaxed">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-[#e5e7eb]">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Install</div>
                  <div className="bg-black text-white font-mono text-xs px-4 py-3">
                    npm install @ghost-privacy/sdk
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section id="community" className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Community</h2>
              <p className="text-3xl md:text-4xl font-light leading-snug tracking-tight mb-6">
                Built in public. <span className="font-bold">Open source.</span>
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Ghost is open source and community-driven. Every contract, circuit, and SDK is auditable. Join the conversation, contribute to the protocol, or integrate Ghost into your DApp.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#" className="bg-purple-500 text-white px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none flex items-center gap-2">
                  <span>GitHub</span>
                </a>
                <a href="#" className="border border-black px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none flex items-center gap-2 bg-white">
                  <span>Telegram</span>
                </a>
                <a href="#" className="border border-black px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none flex items-center gap-2 bg-white">
                  <span>Twitter/X</span>
                </a>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="grid grid-cols-1 gap-0 border border-black">
                {[
                  { label: "Open Source", desc: "All contracts, circuits, and SDK published on GitHub under MIT license.", tag: "MIT" },
                  { label: "Audit Ready", desc: "Formal verification in progress. ZK circuits reviewed by independent researchers.", tag: "Security" },
                  { label: "BNB Chain Grant", desc: "Supported by BNB Chain ecosystem grants. Building for the BNB community first.", tag: "Ecosystem" },
                  { label: "Contributor Rewards", desc: "80% of pool yield returned to depositors. Yield farming meets privacy mining.", tag: "Incentives" },
                ].map((item, i, arr) => (
                  <div key={i} className={`flex items-start justify-between p-6 bg-white ${i < arr.length - 1 ? "border-b border-black" : ""}`}>
                    <div className="flex-1 pr-8">
                      <div className="font-bold text-sm mb-1">{item.label}</div>
                      <div className="text-gray-500 text-xs leading-relaxed">{item.desc}</div>
                    </div>
                    <div className="shrink-0 border border-black text-[9px] font-bold uppercase tracking-widest px-2 py-1">{item.tag}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[#e5e7eb] bg-white">
          <div className="container mx-auto px-6 py-24 text-center">
            <div className="inline-block border border-black px-3 py-1 mb-8 text-[10px] uppercase font-bold tracking-[0.2em] bg-white">
              Start Today
            </div>
            <h2 className="text-5xl md:text-7xl font-bold leading-[0.9] tracking-tighter mb-10">
              Your privacy.<br /><span className="text-purple-500">Proven.</span>
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-10 leading-relaxed uppercase tracking-wider">
              Ghost is live on BNB Testnet. Mainnet launch coming soon.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="bg-purple-500 text-white px-10 py-5 text-sm font-bold flex items-center group transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none">
                LAUNCH APP
                <svg className="ml-4 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
              <a href="#developers" className="border border-black px-10 py-5 text-sm font-bold flex items-center group transition-all duration-150 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0px_#000] hover:translate-x-0 hover:translate-y-0 hover:shadow-none bg-white">
                READ DOCS
                <svg className="ml-4 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] bg-white overflow-hidden">
        {/* Top — tagline + nav columns */}
        <div className="container mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            <div className="md:col-span-4">
              <p className="text-lg font-light leading-snug tracking-tight max-w-xs">
                Full-stack privacy infrastructure for BNB Chain.{" "}
                <span className="font-bold">Compliant by design.</span>
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">Protocol</div>
              <div className="space-y-3 text-sm">
                {["Ghost Paymaster", "Privacy Pool", "Ghost SDK", "Railgun Integration", "Ghost Name Service"].map((l) => (
                  <div key={l}><a className="hover:text-purple-500 transition-colors" href="#">{l}</a></div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">Developers</div>
              <div className="space-y-3 text-sm">
                {["Documentation", "SDK Reference", "GitHub", "npm Package", "Audit Reports"].map((l) => (
                  <div key={l}><a className="hover:text-purple-500 transition-colors" href="#">{l}</a></div>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">Community</div>
              <div className="space-y-3 text-sm">
                {["Twitter/X", "Telegram", "Discord", "Blog", "BNB Chain Ecosystem"].map((l) => (
                  <div key={l}><a className="hover:text-purple-500 transition-colors" href="#">{l}</a></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Giant wordmark */}
        <div className="w-full overflow-hidden leading-none select-none px-1">
          <div
            className="font-bold tracking-tighter text-black w-full text-center"
            style={{ fontSize: "clamp(5rem, 21vw, 22rem)", lineHeight: 0.85 }}
          >
            GHOST
          </div>
        </div>

        {/* Bottom bar */}
        <div className="container mx-auto px-6 py-5 mt-4 flex flex-col md:flex-row justify-between items-center gap-3 border-t border-[#e5e7eb]">
          <span className="font-(family-name:--font-pixel) text-xs tracking-tight">GHOST</span>
          <div className="flex flex-wrap gap-6 text-[11px] text-gray-400">
            <a className="hover:text-black transition-colors" href="#">Privacy</a>
            <a className="hover:text-black transition-colors" href="#">Terms</a>
            <a className="hover:text-black transition-colors" href="#">GitHub</a>
            <a className="hover:text-black transition-colors" href="#">Docs</a>
            <span>© 2025 Ghost Protocol · MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
