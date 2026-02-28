import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
    const a = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "97", "addresses.json"), "utf-8"));
    const provider = ethers.provider;

    const EP_ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function getNonce(address,uint192) view returns (uint256)",
    ];
    const ep = new ethers.Contract("0x0000000071727De22E5E9d8BAf0edAc6f37da032", EP_ABI, provider);

    const [pmDeposit, bundlerBnb] = await Promise.all([
        ep.balanceOf(a.GhostPaymaster),
        provider.getBalance("0x90e6a10271D31EA4EA29B66D48e6f078C4091f77"),
    ]);

    console.log(`\nGhostPaymaster deposit in EntryPoint: ${ethers.formatEther(pmDeposit)} BNB`);
    console.log(`Bundler/deployer BNB balance:         ${ethers.formatEther(bundlerBnb)} BNB`);

    if (pmDeposit < ethers.parseEther("0.001")) {
        console.log("\n⚠️  PAYMASTER DEPOSIT TOO LOW — this is why handleOps reverts (AA31)");
        console.log("    Need to top up the paymaster deposit.");
    } else {
        console.log("\n✅ Paymaster deposit looks fine");
    }

    // Also check GhostPool pool balance
    const pool = await ethers.getContractAt([
        "function poolBalance(address) view returns (uint256)",
    ], a.GhostPool);

    const USDC = "0x64544969ed7EBf5f083679233325356ebe738930";
    const USDT = "0x5c0d9bb86b99168aa8a36fad84d068d258c259a5";

    const [usdcBal, usdtBal] = await Promise.all([
        pool.poolBalance(USDC).catch(() => 0n),
        pool.poolBalance(USDT).catch(() => 0n),
    ]);
    console.log(`\nPool USDC balance: ${ethers.formatUnits(usdcBal, 18)} USDC`);
    console.log(`Pool USDT balance: ${ethers.formatUnits(usdtBal, 18)} USDT`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
