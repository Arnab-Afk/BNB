"use client";

import { useState, useCallback } from "react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import DepositView from "./components/DepositView";
import RelayView from "./components/RelayView";
import RailgunView from "./components/RailgunView";
import ScoreView from "./components/ScoreView";
import ComplianceView from "./components/ComplianceView";
import { connectWallet } from "@/lib/ghost";

const TABS = [
  { id: "deposit", label: "Deposit", tag: "4.1", desc: "Ghost Pool" },
  { id: "relay", label: "Relay", tag: "4.1", desc: "ZK + ERC-4337" },
  { id: "railgun", label: "Railgun", tag: "4.2", desc: "Shield / Unshield" },
  { id: "score", label: "Score", tag: "4.3", desc: "Privacy Rating" },
  { id: "compliance", label: "Compliance", tag: "0xbow", desc: "ASP + POI" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("deposit");
  const [wallet, setWallet] = useState("");;

  const handleConnect = useCallback(async () => {
    if (wallet) return; // already connected
    try {
      const addr = await connectWallet();
      setWallet(addr);
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }, [wallet]);

  const shortWallet = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "";

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden relative">
      {/* Flickering grid background */}
      <div className="fixed inset-0 -z-10">
        <FlickeringGrid
          squareSize={4}
          gridGap={6}
          flickerChance={0.15}
          color="#000000"
          maxOpacity={0.06}
          className="w-full h-full"
        />
      </div>

      {/* Top header */}
      <header className="shrink-0 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-md z-50 flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-3">
          <span className="font-(family-name:--font-pixel) text-sm tracking-tight">GHOST</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-purple-500 border border-purple-500 px-1.5 py-0.5">
            DAPP
          </span>
        </div>
        <div className="flex items-center gap-6">
          {wallet ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="font-mono text-xs font-semibold text-gray-700">{shortWallet}</span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="text-xs font-bold uppercase tracking-widest px-5 py-2 btn-brutalist bg-white text-black border border-black transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 border-r-2 border-[#e5e7eb] flex flex-col bg-white shadow-[2px_0_12px_0_rgba(0,0,0,0.06)]">
          <nav className="flex flex-col flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-5 py-4 border-b border-[#e5e7eb] transition-colors relative ${
                  activeTab === tab.id
                    ? "bg-black text-white"
                    : "bg-transparent text-black hover:bg-[#f3f4f6]"
                }`}
              >
                {activeTab === tab.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                )}
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5">
                  {tab.label}
                </div>
                <div className={`text-[10px] uppercase tracking-wider font-medium ${activeTab === tab.id ? "text-purple-400" : "text-gray-400"}`}>
                  {tab.desc}
                </div>
              </button>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="p-5 border-t-2 border-[#e5e7eb]">
            <div className="font-(family-name:--font-pixel) text-[8px] text-gray-400 leading-relaxed mb-3">
              GHOST<br />PROTOCOL
            </div>
            <div className="flex gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
                GitHub
              </a>
              <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
                Docs
              </a>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          {/* Tab panels — all pre-rendered, toggled with CSS to avoid remount lag */}
          <div>
            <div className={activeTab !== "deposit" ? "hidden" : undefined}><DepositView wallet={wallet} onWalletConnect={setWallet} /></div>
            <div className={activeTab !== "relay" ? "hidden" : undefined}><RelayView wallet={wallet} onWalletConnect={setWallet} /></div>
            <div className={activeTab !== "railgun" ? "hidden" : undefined}><RailgunView /></div>
            <div className={activeTab !== "score" ? "hidden" : undefined}><ScoreView /></div>
            <div className={activeTab !== "compliance" ? "hidden" : undefined}><ComplianceView /></div>
          </div>
        </main>
      </div>
    </div>
  );
}
