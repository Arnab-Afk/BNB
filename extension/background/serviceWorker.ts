/**
 * Ghost Privacy — Background Service Worker (MV3)
 *
 * Handles:
 *  1. GHOST_SEND_TX — receives an intercepted eth_sendTransaction from
 *     the content script, routes it through the Ghost backend relay.
 *  2. Periodic health check of the Ghost backend.
 *  3. Chrome notifications on tx confirmed.
 */

import { ghostShield, ghostRelay, GhostBackend } from '../utils/ghostClient';

// ── Config ────────────────────────────────────────────────────────────────────

const BACKEND_URL = 'http://localhost:3002';

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
    (
        message: { type: string; params?: unknown },
        _sender,
        sendResponse: (response: unknown) => void,
    ) => {
        if (message.type === 'GHOST_SEND_TX') {
            handleGhostSendTx(message.params)
                .then((txHash) => sendResponse({ txHash }))
                .catch((err: Error) => sendResponse({ error: err.message }));
            return true; // keep channel open for async response
        }

        if (message.type === 'GHOST_SHIELD') {
            const req = message.params as Parameters<typeof ghostShield>[0];
            ghostShield(req)
                .then((res) => sendResponse(res))
                .catch((err: Error) => sendResponse({ error: err.message }));
            return true;
        }
    },
);

// ── Ghost Send Tx ─────────────────────────────────────────────────────────────

interface EthTxParams {
    from?: string;
    to?: string;
    value?: string;
    data?: string;
    gas?: string;
}

async function handleGhostSendTx(rawParams: unknown): Promise<string> {
    const params = (Array.isArray(rawParams) ? rawParams[0] : rawParams) as EthTxParams;

    console.log('[Ghost Background] Routing tx privately:', params);

    // Attempt relay via Ghost backend
    const backend = new GhostBackend(BACKEND_URL);
    const result = await ghostRelay(backend, params);

    // Notify user
    await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/48.png'),
        title: 'Ghost Privacy',
        message: `Transaction routed privately ✅\n${result.txHash?.slice(0, 20)}…`,
    });

    return result.txHash ?? '0x' + '0'.repeat(64);
}

// ── Periodic backend health check ─────────────────────────────────────────────

async function checkBackendHealth() {
    try {
        const res = await fetch(`${BACKEND_URL}/health`, {
            signal: AbortSignal.timeout(4000),
        });
        const json = await res.json() as { status?: string };
        if (json.status !== 'ok') {
            console.warn('[Ghost Background] Backend unhealthy:', json);
        }
    } catch {
        console.warn('[Ghost Background] Backend unreachable');
    }
}

// Check health every 60 seconds
chrome.alarms.create('ghost-health-check', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'ghost-health-check') {
        checkBackendHealth();
    }
});

// Initial check on service worker startup
checkBackendHealth();

console.log('[Ghost Background] Service worker started ✅');
