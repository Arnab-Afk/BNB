import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

const REAL_USDT = "0x5c0d9bb86b99168aa8a36fad84d068d258c259a5";

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const a = JSON.parse(
        readFileSync(join(__dirname, "..", "deployments", chainId.toString(), "addresses.json"), "utf-8")
    );
    const [signer] = await ethers.getSigners();

    console.log(`\n👻 Ghost Protocol — Allow Real Testnet USDT`);
    console.log(`   Signer : ${signer.address}`);
    console.log(`   USDT   : ${REAL_USDT}`);

    const usdt = await ethers.getContractAt(
        ["function decimals() view returns (uint8)", "function name() view returns (string)", "function symbol() view returns (string)"],
        REAL_USDT
    );
    const [name, symbol, decimals] = await Promise.all([usdt.name(), usdt.symbol(), usdt.decimals()]);
    console.log(`\n   Token    : ${name} (${symbol}), ${decimals} decimals`);

    const pool = await ethers.getContractAt("GhostPool", a.GhostPool, signer);
    const alreadyAllowed = await pool.allowedTokens(REAL_USDT);

    if (alreadyAllowed) {
        console.log(`\n✅  USDT already allowed — nothing to do.`);
        return;
    }

    console.log(`\nCalling GhostPool.setTokenAllowed(${REAL_USDT}, true)...`);
    const tx = await pool.setTokenAllowed(REAL_USDT, true);
    await tx.wait();
    console.log(`✅  Tx: ${tx.hash}`);
    console.log(`   https://testnet.bscscan.com/tx/${tx.hash}`);

    const base = `https://testnet.bscscan.com`;
    console.log(`\n── Final State ──`);
    console.log(`   GhostPool USDT allowed: ${await pool.allowedTokens(REAL_USDT) ? "✅ yes" : "❌ no"}`);
    console.log(`   GhostPool: ${base}/address/${a.GhostPool}`);
    console.log(`\n✅  Done.\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
