/**
 * Contract address registry.
 *
 * Returns the deployed contract addresses for a given chainId.
 * Falls back to environment-variable overrides so you can point at
 * a local Hardhat node without touching the JSON file.
 */

import { config } from '../config.js';

export interface ContractAddresses {
  ghostPool: `0x${string}`;
  ghostPaymaster: `0x${string}`;
  entryPoint: `0x${string}`;
  usdc: `0x${string}`;
  usdt: `0x${string}`;
}

// ─── BNB Testnet (chainId 97) ─────────────────────────────────────────────────

const TESTNET_ADDRESSES: ContractAddresses = {
  ghostPool: '0x154Fcb02A72E65a5c9Bc155E75CCFf16D0825bee',
  ghostPaymaster: '0x635f53515113C27f0ec0dE30aD030184487508b0',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  usdc: '0x6338e666BfA41e1fE638e8eF57CbCcA60D452872',
  usdt: '0xab6a28bDEAB06d0902F5465097821F5A5BCd896d',
};

// ─── BNB Mainnet (chainId 56) ─────────────────────────────────────────────────

const MAINNET_ADDRESSES: ContractAddresses = {
  // Populated when contracts are deployed to mainnet
  ghostPool: '0x0000000000000000000000000000000000000000',
  ghostPaymaster: '0x0000000000000000000000000000000000000000',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC USDC
  usdt: '0x55d398326f99059fF775485246999027B3197955', // BSC-Peg USDT
};

const DEPLOYMENT_MAP: Record<number, ContractAddresses> = {
  97: TESTNET_ADDRESSES,
  56: MAINNET_ADDRESSES,
};

/**
 * Get contract addresses for the configured chain.
 * Environment variables always take precedence so local/testnet overrides work.
 */
export function getContractAddresses(): ContractAddresses {
  const base = DEPLOYMENT_MAP[config.CHAIN_ID] ?? TESTNET_ADDRESSES;

  return {
    ghostPool: (config.GHOST_POOL_ADDRESS as `0x${string}`) || base.ghostPool,
    ghostPaymaster: (config.PAYMASTER_CONTRACT_ADDRESS as `0x${string}`) || base.ghostPaymaster,
    entryPoint: (config.ENTRYPOINT_ADDRESS as `0x${string}`) || base.entryPoint,
    usdc: base.usdc,
    usdt: base.usdt,
  };
}
