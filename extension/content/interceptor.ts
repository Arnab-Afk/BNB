/**
 * Ghost Privacy — Content Script (Injected into every page)
 *
 * Runs at document_start BEFORE any DApp can access window.ethereum.
 * Wraps the MetaMask provider to intercept eth_sendTransaction when Ghost Mode is ON.
 *
 * Flow when Ghost Mode ON:
 *   eth_sendTransaction → forward to background → background calls Ghost backend
 *   → returns mock pending txHash immediately (real tx via relayer)
 *
 * All other RPC methods pass through unchanged.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let ghostModeOn = false;

// Load initial Ghost Mode state
chrome.storage.sync.get({ ghostModeOn: false }, (stored) => {
    ghostModeOn = (stored as { ghostModeOn: boolean }).ghostModeOn;
});

// Hot-update from popup toggle
chrome.runtime.onMessage.addListener((msg: { type: string; enabled: boolean }) => {
    if (msg.type === 'GHOST_MODE') {
        ghostModeOn = msg.enabled;
        showGhostBanner(ghostModeOn);
    }
});

// ── Provider Wrapping ─────────────────────────────────────────────────────────

function wrapProvider() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    if (!eth || eth.__ghostWrapped) return;

    const originalRequest = eth.request.bind(eth);

    eth.request = async (args: { method: string; params?: unknown[] }) => {
        if (ghostModeOn && args.method === 'eth_sendTransaction') {
            console.log('[Ghost] Intercepted eth_sendTransaction — routing privately', args.params);
            return interceptSendTransaction(args.params);
        }
        return originalRequest(args);
    };

    eth.__ghostWrapped = true;
    console.log('[Ghost] Provider wrapped ✅');
}

// Intercept: forward to background service worker for private relay
async function interceptSendTransaction(params: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: 'GHOST_SEND_TX', params },
            (response: { txHash?: string; error?: string }) => {
                if (chrome.runtime.lastError) {
                    // Background not reachable — fail gracefully and pass through
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve(response?.txHash ?? '0x' + '0'.repeat(64));
            },
        );
    });
}

// ── Ghost Mode Banner ─────────────────────────────────────────────────────────

function showGhostBanner(on: boolean) {
    const BANNER_ID = '__ghost_banner__';
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        Object.assign(banner.style, {
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'system-ui, sans-serif',
            zIndex: '2147483647',
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
        });
        document.body.appendChild(banner);
    }

    if (on) {
        banner.textContent = '👻 Ghost Mode ON — transactions are private';
        banner.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
        banner.style.color = '#fff';
        banner.style.opacity = '1';
        setTimeout(() => { if (banner) banner.style.opacity = '0'; }, 3000);
    } else {
        banner.textContent = '👻 Ghost Mode OFF';
        banner.style.background = '#1f2937';
        banner.style.color = '#9ca3af';
        banner.style.opacity = '1';
        setTimeout(() => { if (banner) banner.style.opacity = '0'; }, 2000);
    }
}

// ── Injection ─────────────────────────────────────────────────────────────────

// Wrap immediately if ethereum is already present (some wallets inject synchronously)
if ((window as unknown as Record<string, unknown>).ethereum) {
    wrapProvider();
}

// Also watch for delayed injection (MetaMask injects async in some cases)
Object.defineProperty(window, 'ethereum', {
    set(val) {
        // Provider just got injected — wrap it before DApp accesses it
        Object.defineProperty(window, 'ethereum', {
            value: val,
            writable: true,
            configurable: true,
        });
        wrapProvider();
    },
    get() {
        return (window as unknown as Record<string, unknown>).__eth__;
    },
    configurable: true,
});
