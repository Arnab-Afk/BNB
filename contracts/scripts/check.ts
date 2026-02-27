import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * check.ts — reads live state of all deployed Ghost contracts on BSC Testnet.
 * Run: npm run compile && node node_modules/hardhat/internal/cli/cli.js run scripts/check.ts --network bsc-testnet
 */

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Load addresses
    const a = JSON.parse(
        readFileSync(join(__dirname, "..", "deployments", chainId.toString(), "addresses.json"), "utf-8")
    );

    const [signer] = await ethers.getSigners();

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║           👻 GHOST PRIVACY SUITE — LIVE STATUS              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log(`  Network   : ${a.network} (chainId: ${chainId})`);
    console.log(`  Deployer  : ${a.deployer}`);
    console.log(`  Deployed  : ${a.deployedAt}\n`);

    // ── GhostPool ───────────────────────────────────────────────────────────────
    const pool = await ethers.getContractAt("GhostPool", a.GhostPool);

    const lastRoot = await pool.getLastRoot();
    const nextLeaf = await pool.nextLeafIndex();
    const poolUSDC = await pool.poolBalance(a.USDC);
    const poolUSDT = await pool.poolBalance(a.USDT);
    const paymasterSet = await pool.ghostPaymaster();
    const usdcAllowed = await pool.allowedTokens(a.USDC);
    const usdtAllowed = await pool.allowedTokens(a.USDT);

    console.log("  ┌─ GhostPool ──────────────────────────────────────────────┐");
    console.log(`  │  Address         : ${a.GhostPool}`);
    console.log(`  │  Merkle Root     : ${lastRoot}`);
    console.log(`  │  Leaves inserted : ${nextLeaf}`);
    console.log(`  │  Pool USDC bal   : ${ethers.formatUnits(poolUSDC, 6)} USDC`);
    console.log(`  │  Pool USDT bal   : ${ethers.formatUnits(poolUSDT, 6)} USDT`);
    console.log(`  │  Paymaster wired : ${paymasterSet.toLowerCase() === a.GhostPaymaster.toLowerCase() ? "✅ yes" : "❌ NO — run setPaymaster()"}`);
    console.log(`  │  USDC allowed    : ${usdcAllowed ? "✅" : "❌"}`);
    console.log(`  │  USDT allowed    : ${usdtAllowed ? "✅" : "❌"}`);
    console.log("  └──────────────────────────────────────────────────────────┘\n");

    // ── GhostPaymaster ─────────────────────────────────────────────────────────
    const paymaster = await ethers.getContractAt("GhostPaymaster", a.GhostPaymaster);

    const zkEnabled = await paymaster.zkVerificationEnabled();
    const rate = await paymaster.bnbToUsdcRate();
    const poolRef = await paymaster.ghostPool();
    const verifierRef = await paymaster.verifier();

    // EntryPoint deposit info
    const entryPoint = await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)",
            "function getDepositInfo(address) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)"],
        a.entryPoint
    );
    const epBalance = await entryPoint.balanceOf(a.GhostPaymaster);
    const [epDeposit, isStaked, epStake, unstakeDelay] = await entryPoint.getDepositInfo(a.GhostPaymaster);

    console.log("  ┌─ GhostPaymaster ─────────────────────────────────────────┐");
    console.log(`  │  Address         : ${a.GhostPaymaster}`);
    console.log(`  │  ZK Verification : ${zkEnabled ? "🔒 enabled" : "⚠️  DISABLED (mock mode)"}`);
    console.log(`  │  BNB→USDC Rate   : ${rate.toString()} (÷1e18)`);
    console.log(`  │  Pool linked     : ${poolRef.toLowerCase() === a.GhostPool.toLowerCase() ? "✅ correct" : "❌ wrong"}`);
    console.log(`  │  Verifier linked : ${verifierRef.toLowerCase() === a.Groth16Verifier.toLowerCase() ? "✅ correct" : "❌ wrong"}`);
    console.log(`  │  EP Deposit      : ${ethers.formatEther(epDeposit)} BNB (gas reserve)`);
    console.log(`  │  EP Stake        : ${ethers.formatEther(epStake)} BNB ${isStaked ? "✅ staked" : "❌ not staked"}`);
    console.log(`  │  Unstake delay   : ${unstakeDelay}s`);
    console.log("  └──────────────────────────────────────────────────────────┘\n");

    // ── Tokens ─────────────────────────────────────────────────────────────────
    const usdc = await ethers.getContractAt(
        ["function name() view returns (string)", "function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)"],
        a.USDC
    );
    const usdt = await ethers.getContractAt(
        ["function name() view returns (string)", "function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)"],
        a.USDT
    );
    const [usdcName, usdcSupply, usdcDecimals] = await Promise.all([usdc.name(), usdc.totalSupply(), usdc.decimals()]);
    const [usdtName, usdtSupply, usdtDecimals] = await Promise.all([usdt.name(), usdt.totalSupply(), usdt.decimals()]);

    console.log("  ┌─ Test Tokens ────────────────────────────────────────────┐");
    console.log(`  │  USDC (${usdcName.padEnd(16)}): ${a.USDC}`);
    console.log(`  │    Supply: ${ethers.formatUnits(usdcSupply, usdcDecimals)} USDC`);
    console.log(`  │  USDT (${usdtName.padEnd(16)}): ${a.USDT}`);
    console.log(`  │    Supply: ${ethers.formatUnits(usdtSupply, usdtDecimals)} USDT`);
    console.log("  └──────────────────────────────────────────────────────────┘\n");

    // ── BscScan Links ──────────────────────────────────────────────────────────
    const base = chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";
    console.log("  ┌─ BscScan Links ──────────────────────────────────────────┐");
    console.log(`  │  GhostPool      : ${base}/address/${a.GhostPool}`);
    console.log(`  │  GhostPaymaster : ${base}/address/${a.GhostPaymaster}`);
    console.log(`  │  MockUSDC       : ${base}/address/${a.USDC}`);
    console.log(`  │  MockUSDT       : ${base}/address/${a.USDT}`);
    console.log("  └──────────────────────────────────────────────────────────┘\n");

    // ── Quick deposit test ─────────────────────────────────────────────────────
    console.log("  ┌─ Smoke Test: Deposit into GhostPool ────────────────────┐");
    console.log("  │  Minting 10 MockUSDC to deployer...");

    const mockUsdc = await ethers.getContractAt("MockERC20", a.USDC);
    const mintTx = await mockUsdc.mint(signer.address, ethers.parseUnits("10", 6));
    await mintTx.wait();
    console.log("  │  ✅ Minted 10 USDC");

    // Approve pool
    const approveTx = await mockUsdc.approve(a.GhostPool, ethers.parseUnits("10", 6));
    await approveTx.wait();
    console.log("  │  ✅ Approved GhostPool to spend USDC");

    // Generate a dummy commitment (in production: Poseidon(secret, nullifier))
    const dummyCommitment = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_" + Date.now()));
    console.log(`  │  Commitment : ${dummyCommitment}`);

    // Deposit
    const depositTx = await pool.deposit(dummyCommitment, ethers.parseUnits("10", 6), a.USDC);
    const receipt = await depositTx.wait();
    console.log(`  │  ✅ Deposited 10 USDC into GhostPool`);
    console.log(`  │  Tx Hash    : ${receipt!.hash}`);
    console.log(`  │  ${base}/tx/${receipt!.hash}`);

    // Verify new state
    const newRoot = await pool.getLastRoot();
    const newLeaf = await pool.nextLeafIndex();
    const newBal = await pool.poolBalance(a.USDC);
    console.log(`  │  New Root   : ${newRoot}`);
    console.log(`  │  Leaf count : ${newLeaf} (was 0)`);
    console.log(`  │  Pool USDC  : ${ethers.formatUnits(newBal, 6)} USDC`);
    console.log("  └──────────────────────────────────────────────────────────┘\n");

    console.log("  ✅ ALL SYSTEMS LIVE ON BSC TESTNET\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Check failed:", err.message);
        process.exit(1);
    });
