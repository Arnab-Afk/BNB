import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * fund-paymaster.ts
 *
 * Run after deploy.ts to top up a deployed GhostPaymaster's stake and deposit.
 * Useful for ongoing maintenance — re-run whenever the deposit runs low.
 *
 * Usage:
 *   node node_modules/hardhat/internal/cli/cli.js run scripts/fund-paymaster.ts --network bsc-testnet
 */

async function main() {
    const [funder] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Load deployed addresses
    const addressesPath = join(__dirname, "..", "deployments", chainId.toString(), "addresses.json");
    let addresses: Record<string, string>;
    try {
        addresses = JSON.parse(readFileSync(addressesPath, "utf-8"));
    } catch {
        throw new Error(
            `No deployment found for chainId ${chainId}.\n` +
            `Run deploy.ts first: node node_modules/hardhat/internal/cli/cli.js run scripts/deploy.ts --network <network>`
        );
    }

    const paymasterAddress = addresses.GhostPaymaster;
    const entryPointAddress = addresses.entryPoint;
    if (!paymasterAddress) throw new Error("GhostPaymaster address not found in deployment file");

    const paymaster = await ethers.getContractAt("GhostPaymaster", paymasterAddress);
    const entryPoint = await ethers.getContractAt(
        // Minimal ABI for balanceOf
        ["function balanceOf(address account) view returns (uint256)",
            "function getDepositInfo(address account) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"],
        entryPointAddress
    );

    const balance = await ethers.provider.getBalance(funder.address);
    const [deposit, , stake] = await entryPoint.getDepositInfo(paymasterAddress);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║          👻 GHOST PAYMASTER — FUND                      ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`\n  Paymaster  : ${paymasterAddress}`);
    console.log(`  Funder     : ${funder.address}`);
    console.log(`  Balance    : ${ethers.formatEther(balance)} BNB`);
    console.log(`  EP Deposit : ${ethers.formatEther(deposit)} BNB`);
    console.log(`  EP Stake   : ${ethers.formatEther(stake)} BNB\n`);

    // Deposit 0.1 BNB for gas sponsorship (reduced for testnet)
    const depositAmount = ethers.parseEther("0.1");
    console.log(`→  Depositing ${ethers.formatEther(depositAmount)} BNB to EntryPoint...`);
    const depositTx = await paymaster.depositToEntryPoint({ value: depositAmount });
    await depositTx.wait();
    console.log("✓  Deposit complete");

    // Only add stake if not already staked
    if (stake === 0n) {
        const stakeAmount = ethers.parseEther("0.05");
        const unstakeDelay = chainId === 56 ? 86400 : 60;
        console.log(`→  Staking ${ethers.formatEther(stakeAmount)} BNB (delay: ${unstakeDelay}s)...`);
        const stakeTx = await paymaster.addStake(unstakeDelay, { value: stakeAmount });
        await stakeTx.wait();
        console.log("✓  Stake complete");
    } else {
        console.log(`✓  Already staked: ${ethers.formatEther(stake)} BNB`);
    }

    console.log("\n✅ Paymaster funded successfully.\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Funding failed:", err.message);
        process.exit(1);
    });
