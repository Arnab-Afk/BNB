/**
 * ProofBuilder — in-browser Groth16 ZK proof generation
 *
 * Uses snarkjs.groth16.fullProve() running a WASM circuit.
 * The WASM and zkey are fetched from configurable URLs (default: /zk/... for local dev).
 *
 * This implementation matches the working proof code in frontend/lib/ghost.ts.
 */

import type { Groth16Proof } from "snarkjs";

export interface ProofInput {
  secret: string;       // bigint string or hex
  nullifier: string;    // bigint string or hex
  pathElements: string[];
  pathIndices: number[];
  root: string;
  nullifierHash: string;
  recipient: string;    // address as bigint string
}

export interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];  // [root, nullifierHash, recipient]
}

export type ProgressCallback = (progress: { percent: number; message: string }) => void;

export interface ProofBuilderConfig {
  /** URL for the circuit WASM file. Default: /zk/merkle_proof.wasm */
  wasmUrl?: string;
  /** URL for the proving key (.zkey). Default: /zk/merkle_proof_final.zkey */
  zkeyUrl?: string;
  /** URL for the verification key (.json). Default: /zk/verification_key.json */
  vkUrl?: string;
}

const DEFAULT_CONFIG: Required<ProofBuilderConfig> = {
  wasmUrl: "/zk/merkle_proof.wasm",
  zkeyUrl: "/zk/merkle_proof_final.zkey",
  vkUrl: "/zk/verification_key.json",
};

export class ProofBuilder {
  private config: Required<ProofBuilderConfig>;

  constructor(config: ProofBuilderConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a Groth16 ZK proof in the browser using snarkjs WASM.
   *
   * @param input   Circuit inputs (secret, nullifier, Merkle path, public signals)
   * @param onProgress  Optional progress callback (0–100)
   * @returns       Proof + public signals, locally verified before returning
   */
  async generate(input: ProofInput, onProgress?: ProgressCallback): Promise<ProofResult> {
    onProgress?.({ percent: 5, message: "Fetching circuit artifacts…" });

    // Fetch WASM + zkey in parallel
    const [wasmBuf, zkeyBuf] = await Promise.all([
      fetch(this.config.wasmUrl).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch WASM: ${r.status} ${r.statusText}`);
        return r.arrayBuffer();
      }),
      fetch(this.config.zkeyUrl).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch zkey: ${r.status} ${r.statusText}`);
        return r.arrayBuffer();
      }),
    ]);

    onProgress?.({ percent: 30, message: "Running Groth16 circuit (WASM)…" });

    // Normalise inputs — snarkjs expects decimal strings for field elements
    const circuitInput = {
      secret: BigInt("0x" + input.secret.replace(/^0x/, "")).toString(),
      nullifier: BigInt("0x" + input.nullifier.replace(/^0x/, "")).toString(),
      pathElements: input.pathElements.map((e) =>
        BigInt("0x" + e.replace(/^0x/, "")).toString()
      ),
      pathIndices: input.pathIndices,
      root: BigInt("0x" + input.root.replace(/^0x/, "")).toString(),
      nullifierHash: BigInt("0x" + input.nullifierHash.replace(/^0x/, "")).toString(),
      recipient: input.recipient,
    };

    const snarkjs = await import("snarkjs");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      new Uint8Array(wasmBuf),
      new Uint8Array(zkeyBuf),
    );

    onProgress?.({ percent: 85, message: "Verifying proof locally…" });

    // Local verification — fast sanity check before submitting
    const vk = await fetch(this.config.vkUrl).then((r) => r.json());
    const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
    if (!valid) {
      throw new Error("Local proof verification failed — do not submit this proof.");
    }

    onProgress?.({ percent: 100, message: "Proof verified ✓" });

    return { proof, publicSignals };
  }

  /** Static convenience wrapper for one-shot usage. */
  static async generate(
    input: ProofInput,
    config?: ProofBuilderConfig,
    onProgress?: ProgressCallback,
  ): Promise<ProofResult> {
    return new ProofBuilder(config).generate(input, onProgress);
  }
}
