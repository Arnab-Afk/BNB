import { ethers } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * recover-funds.ts
 * Recovers BNB locked in the old EntryPoint deposit and stake.
 * Run BEFORE redeploying.
 *
 * node node_modules/hardhat/internal/cli/cli.js run scripts/recover-funds.ts --network bsc-testnet
 */
async function main() {
    const [owner] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const a = JSON.parse(
        readFileSync(join(__dirname, "..", "deployments", chainId.toString(), "addresses.json"), "utf-8")
    );

    // EntryPoint read-only ABI (no modifiers — ethers.js doesn't accept onlyOwner etc)
    const entryPoint = await ethers.getContractAt([
        "function getDepositInfo(address) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)",
    ], a.entryPoint);

    // GhostPaymaster — BasePaymaster exposes these (no modifiers in ABI)
    const paymaster = await ethers.getContractAt([
        "function withdrawTo(address payable withdrawAddress, uint256 amount) external",
        "function unlockStake() external",
        "function withdrawStake(address payable withdrawAddress) external",
    ], a.GhostPaymaster);

    const [deposit, isStaked, stake, unstakeDelay, withdrawTime] =
        await entryPoint.getDepositInfo(a.GhostPaymaster);
    const now = BigInt(Math.floor(Date.now() / 1000));

    console.log("\n Ghost Paymaster -- Fund Recovery\n");
    console.log(`  Paymaster  : ${a.GhostPaymaster}`);
    console.log(`  EP Deposit : ${ethers.formatEther(deposit)} BNB`);
    console.log(`  EP Stake   : ${ethers.formatEther(stake)} BNB  (staked: ${isStaked})`);
    console.log(`  UnlockTime : ${withdrawTime} (now: ${now})\n`);

    // ── 1. Recover deposit (call paymaster.withdrawTo, not entryPoint directly) ──
    if (deposit > 0n) {
        console.log(`-> Withdrawing ${ethers.formatEther(deposit)} BNB deposit...`);
        const tx = await paymaster.withdrawTo(owner.address, deposit);
        await tx.wait();
        console.log(`OK Deposit recovered: ${ethers.formatEther(deposit)} BNB`);
    } else {
        console.log("   No deposit to recover.");
    }

    // ── 2. Recover stake ──────────────────────────────────────────────────────
    if (isStaked && stake > 0n) {
        if (withdrawTime === 0n) {
            // Stake is locked — need to unlock first then wait
            console.log(`\n-> Initiating unstake (${unstakeDelay}s delay)...`);
            const unlockTx = await paymaster.unlockStake();
            await unlockTx.wait();
            const readyAt = new Date((Number(now) + Number(unstakeDelay)) * 1000);
            console.log(`OK Unstake initiated. Ready at: ${readyAt.toLocaleTimeString()}`);
            console.log(`   Waiting ${unstakeDelay}s...`);
            await new Promise(r => setTimeout(r, Number(unstakeDelay) * 1000 + 3000));
            console.log(`-> Withdrawing ${ethers.formatEther(stake)} BNB stake...`);
            const withdrawTx = await paymaster.withdrawStake(owner.address);
            await withdrawTx.wait();
            console.log(`OK Stake recovered: ${ethers.formatEther(stake)} BNB`);
        } else if (now >= withdrawTime) {
            console.log(`\n-> Withdrawing ${ethers.formatEther(stake)} BNB stake...`);
            const withdrawTx = await paymaster.withdrawStake(owner.address);
            await withdrawTx.wait();
            console.log(`OK Stake recovered: ${ethers.formatEther(stake)} BNB`);
        } else {
            const remaining = Number(withdrawTime) - Number(now);
            console.log(`\n   Stake unlock not ready yet. ${remaining}s remaining.`);
            console.log(`   Ready at: ${new Date(Number(withdrawTime) * 1000).toLocaleTimeString()}`);
        }
    } else {
        console.log("   No stake to recover.");
    }

    const finalBalance = await ethers.provider.getBalance(owner.address);
    console.log(`\n  Balance now: ${ethers.formatEther(finalBalance)} BNB`);
    console.log("  Ready to redeploy!\n");
}

main().then(() => process.exit(0)).catch(e => {
    console.error("❌", e.message);
    process.exit(1);
});
