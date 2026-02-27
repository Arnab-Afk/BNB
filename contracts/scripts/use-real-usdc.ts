import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * use-real-usdc.ts
 *
 * Switches the Ghost Protocol from MockERC20 to the real BSC Testnet USDC:
 *   0x64544969ed7ebf5f083679233325356ebe738930  (18 decimals)
 *
 * Changes made:
 *   1. GhostPool.setTokenAllowed(realUSDC, true)   — allow deposits in real USDC
 *   2. GhostPaymaster.setRate(newRate)              — fix rate for 18-decimal token
 *
 * Rate formula:
 *   feeToken = actualGasCost(wei) * rate / 1e18
 *   For 18dp USDC at $600/BNB:
 *     rate = 600 * 10^18 = 600_000_000_000_000_000_000n
 *
 * Run:
 *   npx hardhat run scripts/use-real-usdc.ts --network bsc-testnet
 */

const REAL_USDC = "0x64544969ed7ebf5f083679233325356ebe738930";

// BNB price ~$600, USDC has 18 decimals
// rate = price_usd * 10^(usdc_decimals) = 600 * 10^18
const NEW_RATE = 600_000_000_000_000_000_000n;

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const a = JSON.parse(
        readFileSync(join(__dirname, "..", "deployments", chainId.toString(), "addresses.json"), "utf-8")
    );

    const [signer] = await ethers.getSigners();
    console.log(`\n👻 Ghost Protocol — Switch to Real USDC`);
    console.log(`   Network   : ${a.network} (chainId: ${chainId})`);
    console.log(`   Signer    : ${signer.address}`);
    console.log(`   Real USDC : ${REAL_USDC}`);

    // ── Verify real USDC decimals ──────────────────────────────────────────────
    const usdc = await ethers.getContractAt(
        ["function decimals() view returns (uint8)", "function name() view returns (string)", "function symbol() view returns (string)"],
        REAL_USDC
    );
    const [name, symbol, decimals] = await Promise.all([usdc.name(), usdc.symbol(), usdc.decimals()]);
    console.log(`\n   Token     : ${name} (${symbol})`);
    console.log(`   Decimals  : ${decimals}`);

    if (Number(decimals) !== 18) {
        console.warn(`\n⚠️  WARNING: expected 18 decimals, got ${decimals}. Rate calculation may be wrong.`);
    }

    // ── Step 1: GhostPool.setTokenAllowed ─────────────────────────────────────
    console.log(`\n[1/2] Calling GhostPool.setTokenAllowed(${REAL_USDC}, true)...`);
    const pool = await ethers.getContractAt("GhostPool", a.GhostPool, signer);

    const alreadyAllowed = await pool.allowedTokens(REAL_USDC);
    if (alreadyAllowed) {
        console.log(`  ✅ Already allowed — skipping`);
    } else {
        const tx1 = await pool.setTokenAllowed(REAL_USDC, true);
        await tx1.wait();
        console.log(`  ✅ Tx: ${tx1.hash}`);
        console.log(`  https://testnet.bscscan.com/tx/${tx1.hash}`);
    }

    // ── Step 2: GhostPaymaster.setRate ────────────────────────────────────────
    console.log(`\n[2/2] Calling GhostPaymaster.setRate(${NEW_RATE.toString()})...`);
    console.log(`  Old rate was: 600_000_000 (for 6-decimal MockUSDC)`);
    console.log(`  New rate is : ${NEW_RATE.toString()} (for 18-decimal real USDC)`);

    const paymaster = await ethers.getContractAt("GhostPaymaster", a.GhostPaymaster, signer);
    const currentRate = await paymaster.bnbToUsdcRate();
    console.log(`  Current on-chain rate: ${currentRate.toString()}`);

    if (currentRate === NEW_RATE) {
        console.log(`  ✅ Rate already correct — skipping`);
    } else {
        const tx2 = await paymaster.setRate(NEW_RATE);
        await tx2.wait();
        console.log(`  ✅ Tx: ${tx2.hash}`);
        console.log(`  https://testnet.bscscan.com/tx/${tx2.hash}`);
    }

    // ── Verify final state ─────────────────────────────────────────────────────
    console.log(`\n── Final State ──`);
    const finalAllowed = await pool.allowedTokens(REAL_USDC);
    const finalRate = await paymaster.bnbToUsdcRate();
    console.log(`  GhostPool: real USDC allowed = ${finalAllowed ? "✅ yes" : "❌ no"}`);
    console.log(`  GhostPaymaster: rate = ${finalRate.toString()}`);
    console.log(`  Fee example: 844,440 gas @ 0.1 Gwei = ${Number((844440n * 100_000_000n * finalRate) / 10n ** 18n) / 10 ** 18
        } USDC`);

    console.log(`\n✅  Done. Frontend can now use real USDC for deposits.\n`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Script failed:", err.message);
        process.exit(1);
    });
