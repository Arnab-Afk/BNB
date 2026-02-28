/**
 * Checks the GhostPaymaster state — spent nullifiers and pool balance
 */
import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
    const a = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "97", "addresses.json"), "utf-8"));
    const provider = ethers.provider;

    const paymaster = await ethers.getContractAt([
        "function spentNullifiers(bytes32) view returns (bool)",
        "function ghostPool() view returns (address)",
        "function entryPoint() view returns (address)",
    ], a.GhostPaymaster, provider);

    const pool = await ethers.getContractAt([
        "function poolBalance(address) view returns (uint256)",
        "function nextIndex() view returns (uint32)",
        "function getLastRoot() view returns (bytes32)",
    ], a.GhostPool, provider);

    const ep = await ethers.getContractAt([
        "function balanceOf(address) view returns (uint256)",
    ], "0x0000000071727De22E5E9d8BAf0edAc6f37da032", provider);

    const USDC = ethers.getAddress("0x64544969ed7ebf5f083679233325356ebe738930");
    const USDT = ethers.getAddress("0x5c0d9bb86b99168aa8a36fad84d068d258c259a5");

    const [pmDeposit, usdcBal, usdtBal, nextIdx, lastRoot] = await Promise.all([
        ep.balanceOf(a.GhostPaymaster),
        pool.poolBalance(USDC),
        pool.poolBalance(USDT),
        pool.nextIndex(),
        pool.getLastRoot(),
    ]);

    console.log("\n=== GhostPaymaster EntryPoint deposit ===");
    console.log(`  ${ethers.formatEther(pmDeposit)} BNB`);

    console.log("\n=== GhostPool state ===");
    console.log(`  nextLeafIndex : ${Number(nextIdx)}`);
    console.log(`  lastRoot      : ${lastRoot}`);
    console.log(`  USDC balance  : ${ethers.formatUnits(usdcBal, 18)} USDC`);
    console.log(`  USDT balance  : ${ethers.formatUnits(usdtBal, 18)} USDT`);

    if (pmDeposit < ethers.parseEther("0.005")) {
        console.log("\n⚠️  PAYMASTER DEPOSIT LOW — relay will fail with AA31");
        console.log("   Run: npx hardhat run --network bsc-testnet scripts/fund-paymaster.ts");
    }

    if (usdcBal === 0n && usdtBal === 0n) {
        console.log("\n⚠️  POOL BALANCE ZERO — relay will fail at postOp (InsufficientPoolBalance)");
        console.log("   Make a fresh deposit to replenish.");
    } else {
        console.log(`\n✅ Pool has funds — relay should work`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
