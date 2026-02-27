import { usePrivacyContext } from "./PrivacyProvider.js";

/**
 * Hook to access Ghost Privacy Wallet, Ghost Mode status, and core SDK actions.
 * Simplifies integration in any React dApp component.
 */
export function useGhostWallet() {
  const { 
    ghostWallet, 
    ghostMode, 
    setGhostMode, 
    deposit, 
    relay, 
    privacyScore 
  } = usePrivacyContext();

  return {
    ghostWallet,
    ghostMode,
    setGhostMode,
    deposit,
    relay,
    privacyScore
  };
}
