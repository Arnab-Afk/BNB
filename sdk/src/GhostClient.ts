/**
 * GhostClient — high-level API for interacting with Ghost Protocol
 *
 * Deposit: on-chain tx via ethers (GhostPool.deposit)
 * Relay:   POST to Ghost backend (/v1/relay) OR frontend bundler (/api/bundle)
 * Pool:    read-only pool stats + Merkle proof queries
 *
 * Contract addresses default to BSC Testnet (chainId 97).
 */

import { ethers } from "ethers";
import type { GhostWallet } from "./GhostWallet.js";
import type { RelayResult, DepositResult } from "./types.js";
import { GhostWallet as GhostWalletClass } from "./GhostWallet.js";

// ── ABIs (minimal) ────────────────────────────────────────────────────────────

const GHOST_POOL_ABI = [
  "function deposit(bytes32 commitment, uint256 amount, address token) external",
  "function nextLeafIndex() view returns (uint256)",
  "event Deposit(uint256 indexed leafIndex, bytes32 commitment, address token, uint256 amount)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// ── Default addresses (BSC Testnet, chainId 97) ───────────────────────────────

const TESTNET_ADDRESSES = {
  GhostPool: "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa",
  GhostPaymaster: "0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df",
  USDC: "0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33",
  USDT: "0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GhostClientConfig {
  /** HTTP URL of Ghost backend (e.g. http://localhost:3001) */
  backendUrl: string;
  /** ethers v6 provider for read/write on-chain calls */
  provider?: ethers.Provider;
  /** Contract address overrides (default: BSC Testnet) */
  addresses?: Partial<typeof TESTNET_ADDRESSES>;
}

export class GhostClient {
  private backendUrl: string;
  private provider: ethers.Provider | null;
  private addresses: typeof TESTNET_ADDRESSES;

  constructor(config: GhostClientConfig) {
    this.backendUrl = config.backendUrl.replace(/\/$/, "");
    this.provider = config.provider ?? null;
    this.addresses = { ...TESTNET_ADDRESSES, ...(config.addresses ?? {}) };
  }

  // ── On-chain Deposit ────────────────────────────────────────────────────────

  /**
   * Deposit into GhostPool and return a Ghost Note.
   *
   * Requires an ethers Signer (e.g. MetaMask BrowserProvider.getSigner()).
   * Generates cryptographically random secret + nullifier, computes Poseidon
   * commitment, approves token spend, and calls GhostPool.deposit().
   */
  async deposit(
    amount: string,
    token: "USDC" | "USDT",
    signer: ethers.Signer,
  ): Promise<DepositResult> {
    try {
      const tokenAddr = token === "USDC" ? this.addresses.USDC : this.addresses.USDT;
      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const pool = new ethers.Contract(this.addresses.GhostPool, GHOST_POOL_ABI, signer);
      const decimals = await erc20.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Generate cryptographically secure secret + nullifier
      const wallet = GhostWalletClass.create();
      const { secret, nullifier } = wallet.generateSecretAndNullifier();

      // Build Poseidon commitment — requires circomlibjs (loaded lazily)
      const { buildPoseidon } = await import("circomlibjs");
      const poseidonLib = await buildPoseidon();
      const poseidon = (inputs: bigint[]) =>
        poseidonLib.F.toObject(poseidonLib(inputs)) as bigint;

      const secretBig = BigInt("0x" + secret);
      const nullifierBig = BigInt("0x" + nullifier);
      const commitment = poseidon([secretBig, nullifierBig]);
      const commitBytes32 = ethers.toBeHex(commitment, 32) as `0x${string}`;

      // Record leafIndex BEFORE deposit (it's the current nextLeafIndex)
      const provider = this.provider ?? signer.provider!;
      const poolReadOnly = new ethers.Contract(this.addresses.GhostPool, GHOST_POOL_ABI, provider);
      const leafIndex = Number(await poolReadOnly.nextLeafIndex());

      // Approve + deposit
      await (await erc20.approve(this.addresses.GhostPool, amountWei)).wait();
      const tx = await pool.deposit(commitBytes32, amountWei, tokenAddr);
      const receipt = await tx.wait();

      const note = GhostWalletClass.encodeNote(
        secret,
        nullifier,
        amount,
        token,
        leafIndex,
        commitment.toString(16).padStart(64, "0"),
      );

      return {
        success: true,
        txHash: receipt.hash,
        note: {
          secret,
          nullifier,
          commitment: commitment.toString(16).padStart(64, "0"),
          amount,
          token,
          leafIndex,
          raw: note,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string; reason?: string };
      return { success: false, error: err.reason ?? err.message ?? String(error) };
    }
  }

  // ── Relay (backend or direct bundler) ──────────────────────────────────────

  /**
   * Submit a signed UserOperation to the Ghost backend relayer.
   * The backend validates the ZK proof, checks OFAC compliance,
   * then forwards to the bundler.
   *
   * @param userOp  Fully populated + signed PackedUserOperation
   */
  async relay(userOp: Record<string, string>): Promise<RelayResult> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userOp }),
      });

      const data = (await response.json()) as {
        jobId?: string;
        userOpHash?: string;
        txHash?: string;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        return { success: false, error: data.error ?? data.message ?? "Relay failed" };
      }

      return {
        success: true,
        userOpHash: data.userOpHash ?? data.jobId,
        txHash: data.txHash,
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, error: err.message ?? String(error) };
    }
  }

  // ── Read-only pool queries ──────────────────────────────────────────────────

  async getPoolStatus(): Promise<unknown> {
    const res = await fetch(`${this.backendUrl}/v1/pool/status`);
    return res.json();
  }

  async getMerkleProof(commitment: string): Promise<unknown> {
    const res = await fetch(
      `${this.backendUrl}/v1/pool/merkle-proof?leaf=${commitment}`,
    );
    return res.json();
  }

  async getRelayStatus(jobId: string): Promise<unknown> {
    const res = await fetch(`${this.backendUrl}/v1/relay/status/${jobId}`);
    return res.json();
  }
}
