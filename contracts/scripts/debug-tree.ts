import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
    const a = JSON.parse(readFileSync(join(__dirname, "..", "deployments", "97", "addresses.json"), "utf-8"));
    const provider = ethers.provider;

    const pool = await ethers.getContractAt("GhostPool", a.GhostPool);

    // Get current state
    const nextLeaf = await pool.nextLeafIndex();
    const lastRoot = await pool.getLastRoot();
    const currentBlock = await provider.getBlockNumber();

    console.log(`\nGhostPool: ${a.GhostPool}`);
    console.log(`Current block: ${currentBlock}`);
    console.log(`Deposits (nextLeafIndex): ${nextLeaf}`);
    console.log(`Last root: ${lastRoot}\n`);

    // Fetch ALL Deposit events from block 0
    console.log("Fetching ALL Deposit events...");
    const CHUNK = 5000;
    const allEvents = [];
    for (let start = 0; start <= currentBlock; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, currentBlock);
        try {
            const events = await pool.queryFilter(pool.filters.Deposit(), start, end);
            allEvents.push(...events);
            if (events.length > 0) {
                console.log(`  Blocks ${start}-${end}: found ${events.length} deposits`);
                for (const ev of events) {
                    const log = ev as ethers.EventLog;
                    console.log(`    leafIndex=${log.args[0]} commitment=${log.args[1]?.toString?.()?.slice(0, 20)}... block=${log.blockNumber}`);
                }
            }
        } catch (e) {
            console.log(`  Blocks ${start}-${end}: ERROR - ${(e as Error).message.slice(0, 60)}`);
        }
    }

    console.log(`\nTotal Deposit events found: ${allEvents.length}`);
    if (allEvents.length > 0) {
        const first = allEvents[0] as ethers.EventLog;
        console.log(`GhostPool deploy block (approx): ~${first.blockNumber}`);
        console.log(`Blocks since deployment: ${currentBlock - first.blockNumber}`);
        console.log(`\n→ Set GHOST_POOL_DEPLOY_BLOCK = ${Math.max(0, first.blockNumber - 10)} in addresses.ts`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
