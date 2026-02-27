/**
 * toggle-zk.ts — Toggle zkVerificationEnabled on GhostPaymaster
 * Usage: npx hardhat run scripts/toggle-zk.ts --network bsc-testnet
 */
import { ethers } from "hardhat";

const PAYMASTER = "0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df";
const ENABLE = false;  // ← set to true to re-enable

const ABI = [
    "function zkVerificationEnabled() view returns (bool)",
    "function setZkVerificationEnabled(bool enabled) external",
];

async function main() {
    const [signer] = await ethers.getSigners();
    const pm = new ethers.Contract(PAYMASTER, ABI, signer);

    const before = await pm.zkVerificationEnabled();
    console.log("zkVerificationEnabled before:", before);

    await (await pm.setZkVerificationEnabled(ENABLE)).wait();

    const after = await pm.zkVerificationEnabled();
    console.log("zkVerificationEnabled after :", after);
    console.log(ENABLE ? "✓ ZK ENABLED — real proofs required" : "⚠  ZK DISABLED — skipping proof verification (testing only)");
}

main().catch(e => { console.error(e.message); process.exit(1); });
