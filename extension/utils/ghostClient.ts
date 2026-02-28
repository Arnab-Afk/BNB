/**
 * Ghost Privacy — Backend Client Utility
 *
 * Thin wrapper around the Ghost backend REST API.
 * Used by both the popup and the background service worker.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShieldRequest {
    amount: string;
    tokenAddress: string;
    railgunAddress: string;
    senderPrivateKey: string;
}

export interface ShieldResponse {
    txHash?: string;
    error?: string;
}

export interface UnshieldRequest {
    amount: string;
    tokenAddress: string;
    toAddress: string;
    railgunWalletId: string;
    encryptionKey: string;
}

export interface UnshieldResponse {
    txHash?: string;
    poi?: string;
    error?: string;
}

export interface RelayTxParams {
    from?: string;
    to?: string;
    value?: string;
    data?: string;
    gas?: string;
}

export interface RelayResponse {
    txHash?: string;
    jobId?: string;
    error?: string;
}

export interface HealthResponse {
    status: 'ok' | 'degraded' | 'down';
    railgunReady?: boolean;
}

// ── GhostBackend class ────────────────────────────────────────────────────────

export class GhostBackend {
    constructor(public readonly baseUrl: string) { }

    async health(): Promise<HealthResponse> {
        const res = await fetch(`${this.baseUrl}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        return res.json() as Promise<HealthResponse>;
    }

    async shield(req: ShieldRequest): Promise<ShieldResponse> {
        const res = await fetch(`${this.baseUrl}/v1/railgun/shield`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        return res.json() as Promise<ShieldResponse>;
    }

    async unshield(req: UnshieldRequest): Promise<UnshieldResponse> {
        const res = await fetch(`${this.baseUrl}/v1/railgun/unshield`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
        });
        return res.json() as Promise<UnshieldResponse>;
    }

    async relayStatus(jobId: string): Promise<{ status: string; txHash?: string }> {
        const res = await fetch(`${this.baseUrl}/v1/relay/status/${jobId}`);
        return res.json() as Promise<{ status: string; txHash?: string }>;
    }
}

// ── Standalone helpers ────────────────────────────────────────────────────────

export async function ghostShield(req: ShieldRequest): Promise<ShieldResponse> {
    const { storage } = chrome;
    const { backendUrl } = await new Promise<{ backendUrl: string }>((resolve) =>
        storage.sync.get({ backendUrl: 'http://localhost:3002' }, resolve as () => void),
    );
    const backend = new GhostBackend(backendUrl);
    return backend.shield(req);
}

export async function ghostRelay(backend: GhostBackend, params: RelayTxParams): Promise<RelayResponse> {
    // For now, log and return a simulated job pending hash.
    // Real implementation: build UserOp from params and POST /v1/relay
    console.log('[ghostRelay] Would relay:', params);
    return { txHash: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('') };
}
