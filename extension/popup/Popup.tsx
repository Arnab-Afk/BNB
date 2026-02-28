/**
 * Ghost Privacy — Popup UI
 *
 * Full-featured popup with:
 *  - Ghost Mode toggle (intercept txs)
 *  - Privacy score
 *  - Pool balance
 *  - Quick Shield / Unshield
 *  - Recent activity
 */

import React, { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Settings {
    ghostModeOn: boolean;
    walletAddress: string;
    backendUrl: string;
}

interface BackendStatus {
    status: 'ok' | 'error' | 'loading';
    railgunReady?: boolean;
}

const DEFAULT_SETTINGS: Settings = {
    ghostModeOn: false,
    walletAddress: '',
    backendUrl: 'http://localhost:3002',
};

// ── Popup component ───────────────────────────────────────────────────────────

export default function Popup() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [backendStatus, setBackendStatus] = useState<BackendStatus>({ status: 'loading' });
    const [tab, setTab] = useState<'shield' | 'unshield' | 'activity'>('shield');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState<'USDC' | 'USDT'>('USDC');
    const [recipientZkAddr, setRecipientZkAddr] = useState('');
    const [destAddr, setDestAddr] = useState('');
    const [loading, setLoading] = useState(false);
    const [txResult, setTxResult] = useState<{ hash: string; type: string } | null>(null);
    const [error, setError] = useState('');

    // ── Load settings from chrome.storage ──────────────────────────────────────

    useEffect(() => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
            setSettings(stored as Settings);
        });
    }, []);

    // ── Check backend health ───────────────────────────────────────────────────

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch(`${settings.backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
                const json = await res.json() as { status: string };
                setBackendStatus({ status: json.status === 'ok' ? 'ok' : 'error' });
            } catch {
                setBackendStatus({ status: 'error' });
            }
        };
        check();
    }, [settings.backendUrl]);

    // ── Ghost Mode toggle ──────────────────────────────────────────────────────

    const toggleGhostMode = useCallback(() => {
        const updated = { ...settings, ghostModeOn: !settings.ghostModeOn };
        setSettings(updated);
        chrome.storage.sync.set(updated);
        // Notify content script in active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GHOST_MODE', enabled: updated.ghostModeOn });
            }
        });
    }, [settings]);

    // ── Shield ─────────────────────────────────────────────────────────────────

    const handleShield = async () => {
        setLoading(true);
        setError('');
        setTxResult(null);
        try {
            const tokenMap: Record<string, string> = {
                USDC: '0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33',
                USDT: '0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe',
            };
            const res = await fetch(`${settings.backendUrl}/v1/railgun/shield`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    tokenAddress: tokenMap[token],
                    railgunAddress: recipientZkAddr || settings.walletAddress,
                    senderPrivateKey: '', // injected by content script in real flow
                }),
            });
            const json = await res.json() as { txHash?: string; error?: string };
            if (json.error) throw new Error(json.error);
            setTxResult({ hash: json.txHash ?? '', type: 'Shield' });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Shield failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Unshield ───────────────────────────────────────────────────────────────

    const handleUnshield = async () => {
        setLoading(true);
        setError('');
        setTxResult(null);
        try {
            const tokenMap: Record<string, string> = {
                USDC: '0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33',
                USDT: '0xE0a53adFa5f64f45e81DDEFC770Ddf0DE3a92FFe',
            };
            const res = await fetch(`${settings.backendUrl}/v1/railgun/unshield`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    tokenAddress: tokenMap[token],
                    toAddress: destAddr,
                    railgunWalletId: '',
                    encryptionKey: '',
                }),
            });
            const json = await res.json() as { txHash?: string; error?: string };
            if (json.error) throw new Error(json.error);
            setTxResult({ hash: json.txHash ?? '', type: 'Unshield' });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unshield failed');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="popup">
            {/* Header */}
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">👻</span>
                    <span className="logo-text">Ghost Privacy</span>
                </div>
                <div className={`status-dot ${backendStatus.status}`} title={`Backend: ${backendStatus.status}`} />
            </div>

            {/* Ghost Mode Toggle */}
            <div className="ghost-mode-row">
                <div>
                    <div className="ghost-mode-label">Ghost Mode</div>
                    <div className="ghost-mode-sub">
                        {settings.ghostModeOn ? 'Intercepting transactions' : 'Pass-through mode'}
                    </div>
                </div>
                <button
                    className={`toggle ${settings.ghostModeOn ? 'on' : 'off'}`}
                    onClick={toggleGhostMode}
                    aria-label="Toggle Ghost Mode"
                >
                    <span className="toggle-thumb" />
                </button>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {(['shield', 'unshield', 'activity'] as const).map((t) => (
                    <button
                        key={t}
                        className={`tab ${tab === t ? 'active' : ''}`}
                        onClick={() => { setTab(t); setError(''); setTxResult(null); }}
                    >
                        {t === 'shield' ? '🔒 Shield' : t === 'unshield' ? '🔓 Unshield' : '📋 Activity'}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
                {(tab === 'shield' || tab === 'unshield') && (
                    <>
                        {/* Amount + Token */}
                        <div className="input-row">
                            <input
                                className="input amount-input"
                                type="number"
                                placeholder="Amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <select className="select token-select" value={token} onChange={(e) => setToken(e.target.value as 'USDC' | 'USDT')}>
                                <option value="USDC">USDC</option>
                                <option value="USDT">USDT</option>
                            </select>
                        </div>

                        {/* Shield — recipient 0zk address */}
                        {tab === 'shield' && (
                            <input
                                className="input"
                                placeholder="Recipient 0zk… address (optional)"
                                value={recipientZkAddr}
                                onChange={(e) => setRecipientZkAddr(e.target.value)}
                            />
                        )}

                        {/* Unshield — destination 0x address */}
                        {tab === 'unshield' && (
                            <input
                                className="input"
                                placeholder="Destination 0x… address"
                                value={destAddr}
                                onChange={(e) => setDestAddr(e.target.value)}
                            />
                        )}

                        <button
                            className={`cta-btn ${loading ? 'loading' : ''}`}
                            onClick={tab === 'shield' ? handleShield : handleUnshield}
                            disabled={loading || !amount}
                        >
                            {loading ? 'Processing…' : tab === 'shield' ? '🔒 Shield Now' : '🔓 Unshield Now'}
                        </button>

                        {error && <div className="error-msg">{error}</div>}
                        {txResult && (
                            <div className="success-msg">
                                <span>✅ {txResult.type} complete</span>
                                <a
                                    href={`https://testnet.bscscan.com/tx/${txResult.hash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="tx-link"
                                >
                                    View on BscScan ↗
                                </a>
                            </div>
                        )}
                    </>
                )}

                {tab === 'activity' && (
                    <div className="activity-empty">
                        <span className="activity-icon">📭</span>
                        <span>No recent transactions</span>
                        <span className="activity-sub">Shielded activity will appear here</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="footer">
                <span>BSC Testnet (97)</span>
                <a href="https://testnet.bscscan.com" target="_blank" rel="noreferrer">BscScan ↗</a>
            </div>
        </div>
    );
}
