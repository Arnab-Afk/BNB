/**
 * BigNumber / bigint helpers.
 * Everything is native bigint (ES2020) — no external deps needed.
 */

export const ZERO = 0n;
export const ONE = 1n;

/** Parse a hex or decimal string / number to bigint. */
export function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value.startsWith('0x') ? value : value);
}

/** Format bigint to a 0x-prefixed hex string, left-padded to `bytes` bytes. */
export function toHex(value: bigint, bytes = 32): string {
  const hex = value.toString(16);
  return '0x' + hex.padStart(bytes * 2, '0');
}

/** Parse a 0x-prefixed hex string to bigint. */
export function fromHex(hex: string): bigint {
  return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
}

/** Convert bigint field element to a 32-byte Buffer. */
export function toBuffer32(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

/** Convert a 32-byte Buffer / hex string to bigint. */
export function bufferToBigInt(buf: Buffer | string): bigint {
  const hex = typeof buf === 'string' ? buf : buf.toString('hex');
  return BigInt('0x' + hex.replace(/^0x/, ''));
}

/** Safely divide two bigints, returning 0n if divisor is 0. */
export function safeDivide(a: bigint, b: bigint): bigint {
  return b === ZERO ? ZERO : a / b;
}

/** Compute percentage: (part * 100n) / total — returns 0n if total is 0. */
export function percentage(part: bigint, total: bigint): bigint {
  return total === ZERO ? ZERO : (part * 100n) / total;
}

/** Format a token amount with decimals to a human-readable string. */
export function formatUnits(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

/** Parse a human-readable string to token amount bigint. */
export function parseUnits(amount: string, decimals: number): bigint {
  const [whole = '0', frac = ''] = amount.split('.');
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded);
}
