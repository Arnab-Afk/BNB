/**
 * top-up-pool.ts
 *
 * Makes a fresh USDC deposit into GhostPool to replenish the pool balance
 * so the paymaster can deduct fees again.
 *
 * Run: npx hardhat run --network bsc-testnet scripts/top-up-pool.ts
 */

import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";
import { buildPoseidon } from "circomlibjs";

async function main() {
    const a = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "97", "addresses.json"), "utf-8"));
    const [signer] = await ethers.getSigners();

    const REAL_USDC = ethers.getAddress("0x64544969ed7ebf5f083679233325356ebe738930");
    const REAL_USDT = ethers.getAddress("0x5c0d9bb86b99168aa8a36fad84d068d258c259a5");

    const pool = await ethers.getContractAt([
        "function poolBalance(address) view returns (uint256)",
        "function deposit(bytes32 commitment, uint256 amount, address token) external",
        "function nextIndex() view returns (uint32)",
    ], a.GhostPool, signer);

    const usdc = await ethers.getContractAt([
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address,address) view returns (uint256)",
        "function approve(address,uint256) external returns (bool)",
    ], REAL_USDC, signer);

    const usdt = await ethers.getContractAt([
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address,address) view returns (uint256)",
        "function approve(address,uint256) external returns (bool)",
    ], REAL_USDT, signer);

    const [usdcBal, usdtBal, poolUsdcBal, poolUsdtBal, nextLeaf] = await Promise.all([
        usdc.balanceOf(signer.address),
        usdt.balanceOf(signer.address),
        pool.poolBalance(REAL_USDC),
        pool.poolBalance(REAL_USDT),
        pool.nextIndex(),
    ]);

    console.log(`\nSigner: ${signer.address}`);
    console.log(`Signer USDC: ${ethers.formatUnits(usdcBal, 18)}`);
    console.log(`Signer USDT: ${ethers.formatUnits(usdtBal, 18)}`);
    console.log(`Pool USDC tracked balance: ${ethers.formatUnits(poolUsdcBal, 18)}`);
    console.log(`Pool USDT tracked balance: ${ethers.formatUnits(poolUsdtBal, 18)}`);
    console.log(`Next leaf index: ${nextLeaf}`);

    // Pick the token with sufficient balance
    let token: string;
    let tokenContract: Awaited<ReturnType<typeof ethers.getContractAt>>;
    let signerBalance: bigint;

    if (usdcBal >= ethers.parseUnits("1", 18)) {
        token = REAL_USDC;
        tokenContract = usdc;
        signerBalance = usdcBal;
        console.log("\nUsing USDC");
    } else if (usdtBal >= ethers.parseUnits("1", 18)) {
        token = REAL_USDT;
        tokenContract = usdt;
        signerBalance = usdtBal;
        console.log("\nUsing USDT");
    } else {
        console.log("\n❌ Insufficient USDC/USDT balance! Claim from faucets first.");
        console.log("   USDC faucet on testnet.bscscan.com/token/0x64544969:");
        console.log("   USDT faucet on testnet.bscscan.com/token/0x5c0d9bb8 → Write Contract → claimFaucet");
        process.exit(1);
    }

    const DEPOSIT_AMOUNT = ethers.parseUnits("2", 18); // 2 tokens

    // Generate a fresh commitment
    const poseidon = await buildPoseidon();
    const secret = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const nullifier = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const commitment = poseidon.F.toObject(poseidon([secret, nullifier]));
    const commitmentHex = "0x" + commitment.toString(16).padStart(64, "0");

    console.log(`\nCommitment: ${commitmentHex.slice(0, 20)}...`);
    console.log(`Deposit amount: ${ethers.formatUnits(DEPOSIT_AMOUNT, 18)} tokens`);

    // Approve
    const allowance = await tokenContract.allowance(signer.address, a.GhostPool);
    if (allowance < DEPOSIT_AMOUNT) {
        console.log("\nApproving...");
        const appTx = await tokenContract.approve(a.GhostPool, ethers.MaxUint256);
        await appTx.wait();
        console.log("Approved ✓");
    }

    // Deposit
    console.log("\nDepositing to replenish pool balance...");
    const tx = await pool.deposit(commitmentHex, DEPOSIT_AMOUNT, token);
    const receipt = await tx.wait();

    console.log(`\n✅ Deposit confirmed! tx: ${receipt.hash}`);
    console.log(`   Block: ${receipt.blockNumber}`);

    // Check new balance
    const newPoolBal = await pool.poolBalance(token);
    console.log(`\nNew pool tracked balance: ${ethers.formatUnits(newPoolBal, 18)} tokens`);
    console.log("\n→ Pool can now cover ~${ethers.formatUnits(newPoolBal / 100000n, 18)} relay fees at ~$0.01 each");
    console.log(`\n→ Pool can now cover many relay fees`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
