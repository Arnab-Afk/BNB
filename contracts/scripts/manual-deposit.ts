/**
 * manual-deposit.ts
 * Deposits USDC into GhostPool from a specific wallet and prints the Ghost Note.
 */

import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";

const USER_KEY  = "cd1974264936d8999d5207885abcab1c2a5eab1aa3d3ad7d0d0d4403299d1793";
const DEPOSIT_AMOUNT = "0.5"; // USDC

const GHOST_POOL  = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa";
// Try MockUSDC first (deployed with contracts), then real BSC testnet USDC
const MOCK_USDC   = "0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33";
const REAL_USDC   = "0x64544969ed7ebf5f083679233325356ebe738930";

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
];
const POOL_ABI = [
    "function deposit(bytes32 commitment, uint256 amount, address token) external",
    "function nextLeafIndex() view returns (uint32)",
    "function allowedTokens(address) view returns (bool)",
];

function encodeNote(
    secret: bigint,
    nullifier: bigint,
    amount: string,
    token: string,
    leafIndex: number,
    commitment: bigint,
): string {
    return [
        "ghost:v1",
        secret.toString(16).padStart(64, "0"),
        nullifier.toString(16).padStart(64, "0"),
        amount,
        token,
        leafIndex.toString(),
        commitment.toString(16).padStart(64, "0"),
    ].join(":");
}

async function main() {
    const provider = ethers.provider;
    const user = new ethers.Wallet(USER_KEY, provider);

    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║         Ghost Protocol — Manual Deposit           ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");
    console.log("  Wallet :", user.address);
    console.log("  BNB bal:", ethers.formatEther(await provider.getBalance(user.address)), "BNB\n");

    // ── Find which USDC token has balance ────────────────────────────────────
    const pool = new ethers.Contract(GHOST_POOL, POOL_ABI, user);

    let usdcAddr = "";
    let decimals = 6;

    for (const addr of [MOCK_USDC, REAL_USDC]) {
        const token = new ethers.Contract(addr, ERC20_ABI, user);
        const bal = await token.balanceOf(user.address);
        const dec = Number(await token.decimals());
        const isAllowed = await pool.allowedTokens(addr);
        console.log(`  Token ${addr} — bal: ${ethers.formatUnits(bal, dec)} — allowed: ${isAllowed}`);
        if (bal > 0n && isAllowed) {
            usdcAddr = addr;
            decimals = dec;
        }
    }

    if (!usdcAddr) throw new Error("No USDC balance found on any allowed token address!");
    console.log(`\n  Using token: ${usdcAddr}`);

    const erc20 = new ethers.Contract(usdcAddr, ERC20_ABI, user);
    const amountWei = ethers.parseUnits(DEPOSIT_AMOUNT, decimals);
    const balance = await erc20.balanceOf(user.address);
    console.log(`  Balance  : ${ethers.formatUnits(balance, decimals)} USDC`);
    console.log(`  Depositing: ${DEPOSIT_AMOUNT} USDC\n`);

    if (balance < amountWei) throw new Error(`Insufficient balance: have ${ethers.formatUnits(balance, decimals)}, need ${DEPOSIT_AMOUNT}`);

    // ── Generate secret + nullifier ──────────────────────────────────────────
    const poseidonLib = await buildPoseidon();
    const poseidon = (inputs: bigint[]): bigint => poseidonLib.F.toObject(poseidonLib(inputs));

    const secret   = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const nullifier = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const commitment = poseidon([secret, nullifier]);

    console.log("  Secret      :", "0x" + secret.toString(16));
    console.log("  Nullifier   :", "0x" + nullifier.toString(16));
    console.log("  Commitment  : 0x" + commitment.toString(16).padStart(64, "0"));

    // ── Approve ──────────────────────────────────────────────────────────────
    const allowance = await erc20.allowance(user.address, GHOST_POOL);
    if (allowance < amountWei) {
        console.log("\n→  Approving GhostPool...");
        const approveTx = await erc20.approve(GHOST_POOL, amountWei);
        await approveTx.wait();
        console.log("  ✓ Approved");
    } else {
        console.log("\n  ✓ Already approved");
    }

    // ── Deposit ──────────────────────────────────────────────────────────────
    const leafIndex = Number(await pool.nextLeafIndex());
    console.log(`\n→  Depositing ${DEPOSIT_AMOUNT} USDC (leafIndex: ${leafIndex})...`);
    const depositTx = await pool.deposit(
        ethers.toBeHex(commitment, 32),
        amountWei,
        usdcAddr,
    );
    const receipt = await depositTx.wait();
    console.log("  ✓ Deposit tx:", receipt.hash);
    console.log("  ✓ Block     :", receipt.blockNumber);

    // ── Encode note ──────────────────────────────────────────────────────────
    const note = encodeNote(secret, nullifier, DEPOSIT_AMOUNT, "USDC", leafIndex, commitment);

    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    YOUR GHOST NOTE                           ║");
    console.log("║        SAVE THIS — it cannot be recovered if lost            ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║");
    console.log("║  " + note);
    console.log("║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    console.log("\n  BscScan deposit tx:", `https://testnet.bscscan.com/tx/${receipt.hash}`);
}

main().catch(e => { console.error("\n❌ FAILED:", e.message); process.exit(1); });
