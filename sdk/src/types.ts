export interface Note {
  secret: string;
  nullifier: string;
  commitment: string;
  amount?: string;
  token?: string;
  /** On-chain Merkle tree leaf index — set after deposit confirmation */
  leafIndex?: number;
  /** Ghost note encoded string — ghost:v1:... — save to restore the note */
  raw?: string;
}

export interface GhostWalletConfig {
  rpcUrl?: string;
  chainId?: number;
}

export interface RelayResult {
  success: boolean;
  userOpHash?: string;
  txHash?: string;
  error?: string;
}

export interface DepositResult {
  success: boolean;
  note?: Note;
  txHash?: string;
  error?: string;
}
