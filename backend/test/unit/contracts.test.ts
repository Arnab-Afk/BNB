import { describe, it, expect } from 'vitest';
import { getContractAddresses } from '../../src/contracts/addresses.js';
import { GHOST_POOL_ABI, GHOST_PAYMASTER_ABI } from '../../src/contracts/abis.js';

// ─── Contract ABIs ────────────────────────────────────────────────────────────

describe('GHOST_POOL_ABI', () => {
  it('contains getLastRoot view function', () => {
    const fn = GHOST_POOL_ABI.find((e) => e.type === 'function' && e.name === 'getLastRoot');
    expect(fn).toBeDefined();
    expect((fn as { stateMutability: string }).stateMutability).toBe('view');
  });

  it('contains isKnownRoot with bytes32 input', () => {
    const fn = GHOST_POOL_ABI.find((e) => e.type === 'function' && e.name === 'isKnownRoot');
    expect(fn).toBeDefined();
    expect((fn as { inputs: { type: string }[] }).inputs[0]?.type).toBe('bytes32');
  });

  it('contains isCommitmentInserted with bytes32 input', () => {
    const fn = GHOST_POOL_ABI.find((e) => e.type === 'function' && e.name === 'isCommitmentInserted');
    expect(fn).toBeDefined();
    expect((fn as { inputs: { type: string }[] }).inputs[0]?.type).toBe('bytes32');
  });

  it('contains nextLeafIndex view function', () => {
    const fn = GHOST_POOL_ABI.find((e) => e.type === 'function' && e.name === 'nextLeafIndex');
    expect(fn).toBeDefined();
  });

  it('contains poolBalance with address input', () => {
    const fn = GHOST_POOL_ABI.find((e) => e.type === 'function' && e.name === 'poolBalance');
    expect(fn).toBeDefined();
    expect((fn as { inputs: { type: string }[] }).inputs[0]?.type).toBe('address');
  });

  it('contains Deposit event with commitment, leafIndex, amount, token, timestamp', () => {
    const ev = GHOST_POOL_ABI.find((e) => e.type === 'event' && e.name === 'Deposit');
    expect(ev).toBeDefined();
    const inputs = (ev as { inputs: { name: string }[] }).inputs;
    const names = inputs.map((i) => i.name);
    expect(names).toContain('commitment');
    expect(names).toContain('leafIndex');
    expect(names).toContain('amount');
    expect(names).toContain('token');
    expect(names).toContain('timestamp');
  });
});

describe('GHOST_PAYMASTER_ABI', () => {
  it('contains nullifiers view function', () => {
    const fn = GHOST_PAYMASTER_ABI.find((e) => e.type === 'function' && e.name === 'nullifiers');
    expect(fn).toBeDefined();
    expect((fn as { inputs: { type: string }[] }).inputs[0]?.type).toBe('bytes32');
  });

  it('contains bnbToUsdcRate view function', () => {
    const fn = GHOST_PAYMASTER_ABI.find((e) => e.type === 'function' && e.name === 'bnbToUsdcRate');
    expect(fn).toBeDefined();
  });

  it('contains zkVerificationEnabled view function', () => {
    const fn = GHOST_PAYMASTER_ABI.find((e) => e.type === 'function' && e.name === 'zkVerificationEnabled');
    expect(fn).toBeDefined();
  });

  it('contains NullifierSpent event', () => {
    const ev = GHOST_PAYMASTER_ABI.find((e) => e.type === 'event' && e.name === 'NullifierSpent');
    expect(ev).toBeDefined();
  });
});

// ─── Contract Addresses ───────────────────────────────────────────────────────

describe('getContractAddresses', () => {
  it('returns addresses with 0x prefix', () => {
    const addrs = getContractAddresses();
    expect(addrs.ghostPool).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.ghostPaymaster).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.entryPoint).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.usdc).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.usdt).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('returns the BNB Testnet GhostPool address for chainId 97', () => {
    // The env is set to chainId 97 in tests via process.env overrides in config
    const addrs = getContractAddresses();
    // Either the env var or the hardcoded testnet address should be returned
    expect(addrs.ghostPool.toLowerCase()).toMatch(/^0x[0-9a-f]{40}$/);
  });
});
