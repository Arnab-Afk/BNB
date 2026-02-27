import { run } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * verify-contracts.ts
 *
 * Verifies all deployed contracts on BscScan after a successful deployment.
 * Reads constructor args from deployments/{chainId}/addresses.json.
 *
 * Usage:
 *   node node_modules/hardhat/internal/cli/cli.js run scripts/verify-contracts.ts --network bsc-testnet
 *
 * Requires:
 *   BSCSCAN_API_KEY set in .env
 */

async function verify(address: string, constructorArguments: unknown[], label: string) {
    console.log(`\n→  Verifying ${label} (${address})...`);
    try {
        await run("verify:verify", { address, constructorArguments });
        console.log(`✓  ${label} verified on BscScan`);
    } catch (e: any) {
        if (e.message?.includes("Already Verified")) {
            console.log(`✓  ${label} already verified`);
        } else {
            console.error(`✗  ${label} verification failed:`, e.message);
        }
    }
}

async function main() {
    const { ethers } = await import("hardhat");
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    const addressesPath = join(__dirname, "..", "deployments", chainId.toString(), "addresses.json");
    let a: Record<string, string>;
    try {
        a = JSON.parse(readFileSync(addressesPath, "utf-8"));
    } catch {
        throw new Error(`No deployment found for chainId ${chainId}. Run deploy.ts first.`);
    }

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║          👻 GHOST PRIVACY SUITE — VERIFY                ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    // MockPoseidonHasher / PoseidonHasher
    await verify(a.PoseidonHasher, [], "PoseidonHasher");

    // MockGroth16Verifier / Groth16Verifier
    await verify(a.Groth16Verifier, [], "Groth16Verifier");

    // Mock tokens (testnet only)
    if (a.USDC && !["0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"].includes(a.USDC)) {
        await verify(a.USDC, ["USD Coin (Mock)", "USDC", 6], "MockUSDC");
    }
    if (a.USDT && !["0x55d398326f99059fF775485246999027B3197955"].includes(a.USDT)) {
        await verify(a.USDT, ["Tether USD (Mock)", "USDT", 6], "MockUSDT");
    }

    // GhostPool
    const treeHeight = chainId === 56 ? 20 : chainId === 97 ? 10 : 5;
    await verify(a.GhostPool, [
        a.PoseidonHasher,
        treeHeight,
        a.USDC,
        a.USDT,
        a.deployer,
    ], "GhostPool");

    // GhostPaymaster — need the rate used at deploy time (approximate)
    const rate = chainId === 56
        ? (600n * 10n ** 18n).toString()
        : (600n * 10n ** 6n).toString();

    await verify(a.GhostPaymaster, [
        a.entryPoint,
        a.GhostPool,
        a.Groth16Verifier,
        rate,
        a.deployer,
    ], "GhostPaymaster");

    console.log("\n✅ Verification complete.\n");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("\n❌ Verification failed:", err.message);
        process.exit(1);
    });
