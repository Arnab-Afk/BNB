import React, { createContext, useContext, useState, ReactNode } from "react";
import { GhostWallet } from "../GhostWallet.js";
import { GhostClient } from "../GhostClient.js";

interface PrivacyContextType {
  ghostWallet: GhostWallet | null;
  ghostMode: boolean;
  setGhostMode: (mode: boolean) => void;
  deposit: (amount: string, token: string) => Promise<any>;
  relay: (userOp: any) => Promise<any>;
  privacyScore: number;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export interface PrivacyProviderProps {
  chainId: number;
  rpcUrl: string;
  backendUrl: string;
  children: ReactNode;
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({
  chainId,
  rpcUrl,
  backendUrl,
  children
}) => {
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostWallet, setGhostWallet] = useState<GhostWallet | null>(null);
  
  // Create GhostClient instance mapped to the provider's configuration
  const client = new GhostClient(backendUrl);

  // Skeletal function placeholder to compute privacy score
  const privacyScore = 65; // Simulated 0-100 score

  const deposit = async (amount: string, token: string) => {
    if (!ghostWallet) throw new Error("GhostWallet not initialized");
    return client.deposit(amount, token, ghostWallet);
  };

  const relay = async (userOp: any) => {
    if (!ghostWallet) throw new Error("GhostWallet not initialized");
    return client.relay(ghostWallet, userOp);
  };

  return (
    <PrivacyContext.Provider 
      value={{ ghostWallet, ghostMode, setGhostMode, deposit, relay, privacyScore }}
    >
      {children}
      
      {/* Universal Floating Ghost Mode Toggle */}
      <div 
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: ghostMode ? 'linear-gradient(135deg, #111 0%, #333 100%)' : '#fff',
          color: ghostMode ? '#00e676' : '#222',
          padding: '12px 24px',
          borderRadius: '30px',
          boxShadow: ghostMode ? '0 0 15px rgba(0,230,118,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.3s ease',
          userSelect: 'none'
        }} 
        onClick={() => setGhostMode(!ghostMode)}
      >
        <span style={{ fontSize: '24px', filter: ghostMode ? 'drop-shadow(0 0 5px #00e676)' : 'none' }}>
          {ghostMode ? '👻' : '👁️'}
        </span>
        <span style={{ letterSpacing: '0.5px' }}>
          Ghost Mode {ghostMode ? 'ON' : 'OFF'}
        </span>
      </div>
    </PrivacyContext.Provider>
  );
};

export const usePrivacyContext = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error("usePrivacyContext must be used within a PrivacyProvider");
  }
  return context;
};
