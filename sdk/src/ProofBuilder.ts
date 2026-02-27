import { Note } from "./types.js";

export interface ProofResult {
  proof: any;
  publicSignals: any[];
}

export type ProgressCallback = (progress: { percent: number; message: string }) => void;

export class ProofBuilder {
  static async generate(
    note: Note,
    merkleProof: any,
    recipient: string,
    onProgress?: ProgressCallback
  ): Promise<ProofResult> {
    onProgress?.({ percent: 5, message: "Initializing proof worker..." });

    return new Promise((resolve, reject) => {
      // Inlined worker code to avoid main thread blocking and ensure seamless cross-platform execution
      const workerCode = `
        importScripts('https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/build/snarkjs.min.js');

        self.onmessage = async (event) => {
          const { note, merkleProof, recipient } = event.data;
          try {
            self.postMessage({ type: "progress", percent: 20, message: "Downloading circuit WASM & Zkey..." });

            // Prepare inputs for the groth16 prover
            const inputs = {
              secret: note.secret,
              nullifier: note.nullifier,
              pathElements: merkleProof.pathElements || [],
              pathIndices: merkleProof.pathIndices || [],
              root: merkleProof.root || "0x0",
              recipient: recipient
            };

            const wasmUrl = "https://cdn.ghost-privacy.com/circuit.wasm";
            const zkeyUrl = "https://cdn.ghost-privacy.com/circuit_final.zkey";

            self.postMessage({ type: "progress", percent: 50, message: "Computing witness & proof..." });

            // fullProve inside Web Worker
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
              inputs,
              wasmUrl,
              zkeyUrl
            );

            self.postMessage({ type: "progress", percent: 100, message: "Proof generation complete" });
            self.postMessage({ type: "done", proof, publicSignals });
          } catch (error) {
            self.postMessage({ type: "error", error: error.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        const { type, percent, message, proof, publicSignals, error } = e.data;
        if (type === "progress") {
          onProgress?.({ percent, message });
        } else if (type === "done") {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve({ proof, publicSignals });
        } else if (type === "error") {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          reject(new Error(error));
        }
      };

      worker.postMessage({ note, merkleProof, recipient });
    });
  }
}
