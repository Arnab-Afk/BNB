// Type declarations for browser globals and untyped modules

interface Window {
    ethereum?: {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        on: (event: string, handler: (...args: unknown[]) => void) => void;
        removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
        selectedAddress?: string;
        isMetaMask?: boolean;
    };
}

declare module "circomlibjs" {
    export function buildPoseidon(): Promise<{
        (inputs: bigint[]): Uint8Array;
        F: {
            toObject: (buf: Uint8Array) => bigint;
        };
    }>;

    export const poseidonContract: {
        createCode: (nInputs: number) => string;
        generateABI: (nInputs: number) => object[];
    };
}

declare module "snarkjs" {
    export interface Groth16Proof {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        protocol: string;
        curve: string;
    }

    export const groth16: {
        fullProve: (
            input: Record<string, unknown>,
            wasm: Uint8Array | string,
            zkey: Uint8Array | string,
        ) => Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

        verify: (
            vk: object,
            publicSignals: string[],
            proof: Groth16Proof,
        ) => Promise<boolean>;

        exportSolidityCallData: (
            proof: Groth16Proof,
            publicSignals: string[],
        ) => Promise<string>;
    };
}
