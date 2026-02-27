import { GhostWallet } from "./GhostWallet.js";
import { DepositResult, RelayResult } from "./types.js";

export class GhostClient {
  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  async deposit(amount: bigint | string, token: string, wallet: GhostWallet): Promise<DepositResult> {
    try {
      const note = wallet.generateNote(amount, token);
      
      // In a full implementation, interact securely with viem to submit the on-chain tx
      // e.g. calling the GhostPool.deposit(...) method
      
      return {
        success: true,
        note,
        txHash: "0xMockDepositTxHash"
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async relay(wallet: GhostWallet, userOp: any): Promise<RelayResult> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userOp })
      });

      if (!response.ok) {
        throw new Error(`Relay failed with status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        userOpHash: data.userOpHash,
        txHash: data.txHash
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getPoolStatus() {
    const response = await fetch(`${this.backendUrl}/v1/pool/status`);
    return response.json();
  }

  async getMerkleProof(commitment: string) {
    const response = await fetch(`${this.backendUrl}/v1/pool/merkle-proof?commitment=${commitment}`);
    return response.json();
  }
}
