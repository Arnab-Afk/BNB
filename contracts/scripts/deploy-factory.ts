/**
 * deploy-factory.ts — Deploy GhostSmartAccountFactory
 */
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Ghost Smart Account Factory — Deploy   ║");
    console.log("╚══════════════════════════════════════════╝\n");
    console.log("  Network  :", network.name, "(chainId:", network.chainId.toString() + ")");
    console.log("  Deployer :", deployer.address);
    console.log("  Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    console.log();

    const Factory = await ethers.getContractFactory("GhostSmartAccountFactory");
    console.log("→  Deploying GhostSmartAccountFactory...");
    const factory = await Factory.deploy(ENTRY_POINT);
    await factory.waitForDeployment();
    const factoryAddr = await factory.getAddress();
    console.log("✓  GhostSmartAccountFactory:", factoryAddr);

    // Test: compute a sample account address
    const testOwner = deployer.address;
    const testSalt = 0;
    const predicted = await factory.getAddress(testOwner, testSalt);
    console.log("   Sample account (owner=deployer, salt=0):", predicted);

    // Persist address
    const addrFile = path.join(__dirname, "../deployments/97/addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addrFile, "utf8"));
    addresses.GhostSmartAccountFactory = factoryAddr;
    fs.writeFileSync(addrFile, JSON.stringify(addresses, null, 2));
    console.log("\n✓  addresses.json updated");
    console.log("  BscScan:", `https://testnet.bscscan.com/address/${factoryAddr}`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
