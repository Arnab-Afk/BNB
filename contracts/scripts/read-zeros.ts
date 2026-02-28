import { ethers } from "hardhat";

async function main() {
    const POOL = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa";
    const pool = await ethers.getContractAt([
        "function levels() view returns (uint32)",
        "function nextIndex() view returns (uint32)",
        "function getLastRoot() view returns (bytes32)",
        "function zeros(uint256 i) view returns (bytes32)",
    ], POOL);

    const [levels, nextIdx, lastRoot] = await Promise.all([
        pool.levels(), pool.nextIndex(), pool.getLastRoot(),
    ]);

    const n = Number(levels);
    console.log(`levels: ${n}`);
    console.log(`nextIndex: ${Number(nextIdx)}`);
    console.log(`lastRoot: ${lastRoot}`);
    console.log(`\nconst TREE_DEPTH = ${n};`);
    console.log(`export const ZEROS: readonly bigint[] = [`);

    for (let i = 0; i < n; i++) {
        const z = await pool.zeros(i);
        console.log(`    ${BigInt(z)}n,  // zeros[${i}]`);
    }
    console.log(`] as const;`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
