/**
 * deploy-new-contracts.ts — Deploy NEW contracts only
 *
 * Deploys AssociationSetProvider and GhostNameService to BSC Testnet.
 * Does NOT redeploy the already-deployed core contracts (GhostPool, GhostPaymaster, etc.)
 *
 * Run:
 *   npx hardhat run scripts/deploy-new-contracts.ts --network bsc-testnet
 */

import { ethers } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEPLOYER_IS_OWNER = true; // set false if you want a multisig as owner

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║      👻 GHOST — Deploy New Contracts (ASP + GNS)       ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`\n  Network  : chainId ${chainId}`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(balance)} BNB\n`);

    // ── Load existing addresses ───────────────────────────────────────────────
    const deploymentsDir = join(__dirname, "..", "deployments", chainId.toString());
    const addressesPath = join(deploymentsDir, "addresses.json");

    let existingAddresses: Record<string, string> = {};
    if (existsSync(addressesPath)) {
        existingAddresses = JSON.parse(readFileSync(addressesPath, "utf8"));
        console.log("  Existing addresses loaded from:", addressesPath);
    } else {
        console.log("  ⚠️  No existing addresses.json found — starting fresh record");
    }

    const newAddresses: Record<string, string> = { ...existingAddresses };

    // ── 1. AssociationSetProvider ─────────────────────────────────────────────
    console.log("\n→  Deploying AssociationSetProvider...");
    console.log(`   Owner: ${deployer.address}`);

    const ASP = await ethers.getContractFactory("AssociationSetProvider");
    const asp = await ASP.deploy(deployer.address);
    await asp.waitForDeployment();
    const aspAddress = await asp.getAddress();
    console.log("✓  AssociationSetProvider deployed:", aspAddress);

    if (chainId === 97) {
        console.log(`   BscScan: https://testnet.bscscan.com/address/${aspAddress}`);
    }

    newAddresses.AssociationSetProvider = aspAddress;

    // ── 2. GhostNameService ───────────────────────────────────────────────────
    console.log("\n→  Deploying GhostNameService...");
    console.log(`   Owner              : ${deployer.address}`);
    console.log("   Registration fee  : 0.001 BNB");
    console.log("   Renewal fee       : 0.0005 BNB");
    console.log("   TTL               : 365 days");

    const GNS = await ethers.getContractFactory("GhostNameService");
    const gns = await GNS.deploy(deployer.address);
    await gns.waitForDeployment();
    const gnsAddress = await gns.getAddress();
    console.log("✓  GhostNameService deployed:", gnsAddress);

    if (chainId === 97) {
        console.log(`   BscScan: https://testnet.bscscan.com/address/${gnsAddress}`);
    }

    newAddresses.GhostNameService = gnsAddress;

    // ── 3. Summary ────────────────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║              NEW CONTRACTS DEPLOYED ✅                  ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log("  New Contract Addresses:");
    console.log(`    AssociationSetProvider : ${aspAddress}`);
    console.log(`    GhostNameService       : ${gnsAddress}\n`);

    // ── 4. Save to addresses.json ─────────────────────────────────────────────
    if (!existsSync(deploymentsDir)) {
        mkdirSync(deploymentsDir, { recursive: true });
    }

    newAddresses.deployedAt = new Date().toISOString();
    writeFileSync(addressesPath, JSON.stringify(newAddresses, null, 2));
    console.log(`  Addresses saved to: deployments/${chainId}/addresses.json\n`);

    // ── 5. Instructions ───────────────────────────────────────────────────────
    console.log("  Next steps:");
    console.log("  1. Add to backend/.env:");
    console.log(`       ASP_CONTRACT_ADDRESS=${aspAddress}`);
    console.log(`       GNS_CONTRACT_ADDRESS=${gnsAddress}`);
    console.log("  2. Add to frontend/.env.local:");
    console.log(`       NEXT_PUBLIC_ASP_ADDRESS=${aspAddress}`);
    console.log(`       NEXT_PUBLIC_GNS_ADDRESS=${gnsAddress}`);
    console.log("  3. Wire GhostPaymaster to call asp.isKnownRoot() in validatePaymasterUserOp");
    console.log("  4. Verify on BscScan:");
    if (chainId === 97) {
        console.log(`       npx hardhat verify --network bsc-testnet ${aspAddress} "${deployer.address}"`);
        console.log(`       npx hardhat verify --network bsc-testnet ${gnsAddress} "${deployer.address}"`);
    }
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Deployment failed:", err.message);
        process.exit(1);
    });
