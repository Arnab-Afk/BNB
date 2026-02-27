import { describe, it, expect } from 'vitest';
import { formatUnits, parseUnits, toHex, fromHex, toBigInt } from '../../src/utils/bn.js';
import { isValidAddress, toChecksumAddress, truncateAddress, strip0x } from '../../src/utils/address.js';
import { validateProofShape, parsePublicSignals } from '../../src/zk/verifier.js';

// ─── BigNumber utils ──────────────────────────────────────────────────────────

describe('bn utils', () => {
  it('formatUnits handles 6-decimal USDC', () => {
    expect(formatUnits(10_000_000n, 6)).toBe('10');
    expect(formatUnits(10_500_000n, 6)).toBe('10.5');
  });

  it('parseUnits is the inverse of formatUnits', () => {
    expect(parseUnits('10.5', 6)).toBe(10_500_000n);
    expect(parseUnits('1', 18)).toBe(10n ** 18n);
  });

  it('toHex / fromHex round-trip', () => {
    const value = 0xdeadbeefn;
    expect(fromHex(toHex(value))).toBe(value);
  });

  it('toBigInt parses hex strings', () => {
    expect(toBigInt('0xff')).toBe(255n);
    expect(toBigInt(255)).toBe(255n);
  });
});

// ─── Address utils ────────────────────────────────────────────────────────────

describe('address utils', () => {
  const validAddr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  it('validates correct addresses', () => {
    expect(isValidAddress(validAddr)).toBe(true);
    expect(isValidAddress('not-an-address')).toBe(false);
  });

  it('checksums addresses', () => {
    const lower = validAddr.toLowerCase();
    expect(toChecksumAddress(lower)).toBe(validAddr);
  });

  it('truncates addresses for display', () => {
    expect(truncateAddress(validAddr)).toBe('0xd8dA...6045');
  });

  it('strips 0x prefix', () => {
    expect(strip0x('0xabc')).toBe('abc');
    expect(strip0x('abc')).toBe('abc');
  });
});

// ─── ZK Verifier ─────────────────────────────────────────────────────────────

describe('ZK verifier', () => {
  it('validateProofShape accepts a well-formed proof', () => {
    const proof = {
      pi_a: ['1', '2', '1'] as [string, string, string],
      pi_b: [['1', '2'], ['3', '4'], ['1', '0']] as [[string, string], [string, string], [string, string]],
      pi_c: ['5', '6', '1'] as [string, string, string],
    };
    expect(validateProofShape(proof)).toBe(true);
  });

  it('validateProofShape rejects malformed proofs', () => {
    // @ts-expect-error intentionally bad
    expect(validateProofShape({ pi_a: [], pi_b: [], pi_c: [] })).toBe(false);
  });

  it('parsePublicSignals extracts signals correctly', () => {
    const signals = [
      '0xabc000000000000000000000000000000000000000000000000000000000001',
      '0xdef000000000000000000000000000000000000000000000000000000000002',
      '0x1234567890abcdef1234567890abcdef12345678',
    ];
    const parsed = parsePublicSignals(signals);
    expect(parsed.merkleRoot).toBe(signals[0]);
    expect(parsed.nullifierHash).toBe(signals[1]);
    expect(parsed.recipient).toBe(signals[2]);
  });

  it('parsePublicSignals throws when signals < 3', () => {
    expect(() => parsePublicSignals(['a', 'b'])).toThrow();
  });
});
