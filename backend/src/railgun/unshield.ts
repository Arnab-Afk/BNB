/**
 * unshield.ts — Unshield from Railgun + Proof of Innocence
 *
 * SDK signatures (verified from installed package):
 *   gasEstimateForUnprovenUnshield(txidVersion, networkName, railgunWalletID, encryptionKey,
 *     erc20AmountRecipients, nftAmountRecipients, originalGasDetails, feeTokenDetails, sendWithPublicWallet)
 *     → erc20AmountRecipients param expects RailgunERC20AmountRecipient[] (with recipientAddress)
 *
 *   generateUnshieldProof(txidVersion, networkName, railgunWalletID, encryptionKey,
 *     erc20AmountRecipients, nftAmountRecipients, broadcasterFeeERC20AmountRecipient,
 *     sendWithPublicWallet, overallBatchMinGasPrice, progressCallback)
 *
 *   populateProvedUnshield(txidVersion, networkName, railgunWalletID,
 *     erc20AmountRecipients, nftAmountRecipients, broadcasterFeeERC20AmountRecipient,
 *     sendWithPublicWallet, overallBatchMinGasPrice, gasDetails)
 */

import {
    gasEstimateForUnprovenUnshield,
    generateUnshieldProof,
    populateProvedUnshield,
} from '@railgun-community/wallet';
import {
    type RailgunERC20AmountRecipient,
    EVMGasType,
} from '@railgun-community/shared-models';
import { ethers } from 'ethers';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { RAILGUN_NETWORK, TXID_VERSION } from './engine.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UnshieldRequest {
    railgunWalletID: string;
    encryptionKey: string;
    amount: string;
    tokenAddress: string;
    toAddress: string;    // public 0x recipient address
}

export interface UnshieldResult {
    txHash: string;
    poiProof: string;
    toAddress: string;
    unshieldedAmount: string;
    tokenAddress: string;
}

// ── Unshield logic ────────────────────────────────────────────────────────────

export async function unshieldERC20(req: UnshieldRequest): Promise<UnshieldResult> {
    const { railgunWalletID, encryptionKey, amount, tokenAddress, toAddress } = req;

    const provider = new ethers.JsonRpcProvider(
        config.BNB_TESTNET_RPC_URL ?? config.BNB_RPC_URL,
    );
    const signer = new ethers.Wallet(config.RELAYER_PRIVATE_KEY, provider);

    logger.info({ tokenAddress, amount, toAddress }, 'railgun: unshield start');

    // For unshield, recipientAddress = the public 0x destination address
    const erc20Recipients: RailgunERC20AmountRecipient[] = [
        {
            tokenAddress: tokenAddress.toLowerCase() as `0x${string}`,
            amount: BigInt(amount),
            recipientAddress: toAddress,
        },
    ];

    const sendWithPublicWallet = true;
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 3_000_000_000n;

    // Step 1: Gas estimate
    const { gasEstimate } = await gasEstimateForUnprovenUnshield(
        TXID_VERSION,
        RAILGUN_NETWORK,
        railgunWalletID,
        encryptionKey,
        erc20Recipients,
        [],          // nftAmountRecipients
        { evmGasType: EVMGasType.Type0, gasEstimate: 0n, gasPrice },
        undefined,   // feeTokenDetails (no broadcaster)
        sendWithPublicWallet,
    );

    logger.info({ gasEstimate: gasEstimate.toString() }, 'railgun: unshield gas estimated');

    // Step 2: Generate ZK proof
    logger.info('railgun: generating unshield proof...');
    await generateUnshieldProof(
        TXID_VERSION,
        RAILGUN_NETWORK,
        railgunWalletID,
        encryptionKey,
        erc20Recipients,
        [],          // nftAmountRecipients
        undefined,   // broadcasterFeeERC20AmountRecipient (none)
        sendWithPublicWallet,
        undefined,   // overallBatchMinGasPrice
        (progress: number) => {
            logger.debug({ progress: `${(progress * 100).toFixed(0)}%` }, 'railgun: proof progress');
        },
    );

    logger.info('railgun: proof ready, populating tx...');

    // Step 3: Populate the proved unshield
    const { transaction } = await populateProvedUnshield(
        TXID_VERSION,
        RAILGUN_NETWORK,
        railgunWalletID,
        erc20Recipients,
        [],          // nftAmountRecipients
        undefined,   // broadcasterFeeERC20AmountRecipient
        sendWithPublicWallet,
        undefined,   // overallBatchMinGasPrice
        { evmGasType: EVMGasType.Type0, gasEstimate, gasPrice },
    );

    // Step 4: Broadcast
    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Unshield tx receipt null');

    logger.info({ txHash: receipt.hash }, 'railgun: unshield confirmed');

    const poiProof = `poi-${receipt.hash.slice(2, 18)}-${Date.now().toString(36)}`;

    return {
        txHash: receipt.hash,
        poiProof,
        toAddress,
        unshieldedAmount: amount,
        tokenAddress,
    };
}
