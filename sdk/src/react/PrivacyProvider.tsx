import React, { createContext, useContext, useState, type ReactNode } from "react";
import { GhostWallet } from "../GhostWallet.js";
import { GhostClient } from "../GhostClient.js";
import type { DepositResult, RelayResult } from "../types.js";
import type { ethers } from "ethers";

interface PrivacyContextType {
  ghostWallet: GhostWallet | null;
  ghostMode: boolean;
  setGhostMode: (mode: boolean) => void;
  deposit: (amount: string, token: "USDC" | "USDT", signer: ethers.Signer) => Promise<DepositResult>;
  relay: (userOp: Record<string, string>) => Promise<RelayResult>;
  privacyScore: number;
  initWallet: () => GhostWallet;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export interface PrivacyProviderProps {
  chainId?: number;
  rpcUrl?: string;
  backendUrl: string;
  children: ReactNode;
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({
  backendUrl,
  children,
}) => {
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostWallet, setGhostWallet] = useState<GhostWallet | null>(null);

  // Singleton GhostClient mapped to the provider's backend URL
  const client = new GhostClient({ backendUrl });

  // Create (or retrieve) a wallet for the current session
  const initWallet = (): GhostWallet => {
    if (ghostWallet) return ghostWallet;
    const wallet = GhostWallet.create();
    setGhostWallet(wallet);
    return wallet;
  };

  const deposit = async (
    amount: string,
    token: "USDC" | "USDT",
    signer: ethers.Signer,
  ): Promise<DepositResult> => {
    return client.deposit(amount, token, signer);
  };

  const relay = async (userOp: Record<string, string>): Promise<RelayResult> => {
    return client.relay(userOp);
  };

  // Placeholder score — replace with on-chain scoring from ScoreView logic
  const privacyScore = 65;

  return (
    <PrivacyContext.Provider
      value={{ ghostWallet, ghostMode, setGhostMode, deposit, relay, privacyScore, initWallet }}
    >
      {children}

      {/* Universal Floating Ghost Mode Toggle */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          background: ghostMode
            ? "linear-gradient(135deg, #111 0%, #333 100%)"
            : "#fff",
          color: ghostMode ? "#00e676" : "#222",
          padding: "12px 24px",
          borderRadius: "30px",
          boxShadow: ghostMode
            ? "0 0 15px rgba(0,230,118,0.4)"
            : "0 4px 12px rgba(0,0,0,0.1)",
          cursor: "pointer",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          transition: "all 0.3s ease",
          userSelect: "none",
        }}
        onClick={() => setGhostMode(!ghostMode)}
      >
        <span
          style={{
            fontSize: "24px",
            filter: ghostMode ? "drop-shadow(0 0 5px #00e676)" : "none",
          }}
        >
          {ghostMode ? "👻" : "👁️"}
        </span>
        <span style={{ letterSpacing: "0.5px" }}>
          Ghost Mode {ghostMode ? "ON" : "OFF"}
        </span>
      </div>
    </PrivacyContext.Provider>
  );
};

export const usePrivacyContext = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error("usePrivacyContext must be used within a PrivacyProvider");
  }
  return context;
};
