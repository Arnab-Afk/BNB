/**
 * shield.ts — Shield ERC-20 tokens into Railgun for Ghost Privacy Suite
 *
 * SDK signatures (verified from installed package):
 *   gasEstimateForShield(txidVersion, networkName, shieldPrivateKey, erc20AmountRecipients, nftAmountRecipients, fromWalletAddress)
 *   populateShield(txidVersion, networkName, shieldPrivateKey, erc20AmountRecipients, nftAmountRecipients, gasDetails)
 *
 * TransactionGasDetails (Type0 for BSC — legacy gas):
 *   { evmGasType: EVMGasType.Type0, gasEstimate: bigint, gasPrice: bigint }
 */

import { gasEstimateForShield, populateShield } from '@railgun-community/wallet';
import {
    type RailgunERC20AmountRecipient,
    EVMGasType,
    NETWORK_CONFIG,
} from '@railgun-community/shared-models';
import { ethers } from 'ethers';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { RAILGUN_NETWORK, TXID_VERSION } from './engine.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShieldRequest {
    amount: string;         // base units e.g. "100000000" = 100 USDC
    tokenAddress: string;   // 0x...
    railgunAddress: string; // 0zk...
    fromAddress: string;    // sender public 0x address
}

export interface ShieldResult {
    txHash: string;
    railgunAddress: string;
    shieldedAmount: string;
    tokenAddress: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ERC20_ABI = [
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
];

// ── Shield logic ──────────────────────────────────────────────────────────────

export async function shieldERC20(req: ShieldRequest): Promise<ShieldResult> {
    const { amount, tokenAddress, railgunAddress, fromAddress } = req;

    const provider = new ethers.JsonRpcProvider(
        config.BNB_TESTNET_RPC_URL ?? config.BNB_RPC_URL,
    );
    const signer = new ethers.Wallet(config.RELAYER_PRIVATE_KEY, provider);

    // Railgun proxy contract address for token approval
    const networkConfig = NETWORK_CONFIG[RAILGUN_NETWORK] as Record<string, unknown>;
    const railgunProxy = networkConfig['proxyContract'] as string;

    logger.info({ tokenAddress, amount, railgunProxy, railgunAddress }, 'railgun: shield start');

    // Step 1: ERC-20 allowance
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const amountBig = BigInt(amount);
    const allowance = await token.allowance(signer.address, railgunProxy) as bigint;
    if (allowance < amountBig) {
        const approveTx = await token.approve(railgunProxy, amountBig);
        await approveTx.wait();
        logger.info('railgun: ERC20 approved');
    }

    const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
        {
            tokenAddress: tokenAddress.toLowerCase() as `0x${string}`,
            amount: amountBig,
            recipientAddress: railgunAddress,
        },
    ];

    // Shield private key — deterministic from signer for demo; in prod use getShieldPrivateKeySignatureMessage
    const shieldPrivateKey = ethers.keccak256(
        ethers.toUtf8Bytes(`ghost-shield-${signer.address}-${Date.now()}`),
    );

    // Step 2: Gas estimate
    const { gasEstimate } = await gasEstimateForShield(
        TXID_VERSION,
        RAILGUN_NETWORK,
        shieldPrivateKey,
        erc20AmountRecipients,
        [],          // nftAmountRecipients
        fromAddress,
    );

    // Step 3: Populate transaction — BSC uses Type0 (legacy) gas
    const feeData = await provider.getFeeData();
    const { transaction } = await populateShield(
        TXID_VERSION,
        RAILGUN_NETWORK,
        shieldPrivateKey,
        erc20AmountRecipients,
        [], // nftAmountRecipients
        {
            evmGasType: EVMGasType.Type0,
            gasEstimate,
            gasPrice: feeData.gasPrice ?? 3_000_000_000n,
        },
    );

    // Step 4: Broadcast
    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Shield tx receipt null');

    logger.info({ txHash: receipt.hash }, 'railgun: shield confirmed');
    return { txHash: receipt.hash, railgunAddress, shieldedAmount: amount, tokenAddress };
}
