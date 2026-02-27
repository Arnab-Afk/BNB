import { getAddress, isAddress } from 'viem';

/**
 * Normalise an EVM address to its EIP-55 checksum form.
 * Throws if the input is not a valid address.
 */
export function toChecksumAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }
  return getAddress(address) as `0x${string}`;
}

/** Returns true if `address` is a valid 20-byte EVM address. */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/** Returns true only for the zero address (0x000...000). */
export function isZeroAddress(address: string): boolean {
  return address === '0x0000000000000000000000000000000000000000';
}

/** Truncate an address for display: 0x1234...abcd */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/** Strip the 0x prefix from an address / bytes string. */
export function strip0x(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/** Ensure a hex string is 0x-prefixed. */
export function ensure0x(hex: string): `0x${string}` {
  return hex.startsWith('0x') ? (hex as `0x${string}`) : (`0x${hex}` as `0x${string}`);
}

/** Convert an address to a 32-byte padded hex (for ABI encoding). */
export function addressToBytes32(address: string): `0x${string}` {
  const stripped = strip0x(toChecksumAddress(address));
  return ensure0x(stripped.padStart(64, '0'));
}
