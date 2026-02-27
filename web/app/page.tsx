export default function Home() {
  return (
    <div className="font-(family-name:--font-jetbrains-mono) text-black antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e7eb]">
        <nav className="container mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-full opacity-80" />
            </div>
            <span className="font-bold text-xl tracking-tighter">GHOST</span>
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
        <section className="container mx-auto px-6 pt-24 pb-32">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] bg-white mt-20">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-black flex items-center justify-center">
                <div className="w-3 h-3 border border-white rounded-full" />
              </div>
              <span className="font-bold text-sm tracking-tighter">GHOST</span>
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
