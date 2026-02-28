/**
 * relay-usdc-transfer.ts
 *
 * Full flow:
 *   1. Deployer sends 0.001 BNB to EOA (just enough for one approve tx)
 *   2. EOA approves its SmartAccount to spend USDC
 *   3. Relay UserOp: SmartAccount calls transferFrom(EOA → recipient)
 *      → Gas sponsored by GhostPaymaster via Ghost Note
 *      → EOA spends ZERO BNB for the actual transfer
 */

import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";

// ── Config ────────────────────────────────────────────────────────────────────

const DEPLOYER_KEY = "1437c6e656c9afd75cae09210d80ea969aa614cba8a144ea9a8371e173332ddb";
const USER_KEY     = "7fd207a4b2a0936913f665349b8589087882e70fa798a135952bd15c46726c3b";
const USER_EOA     = "0xe8B3555A33420A389709e436c02871602EAA7e5c";
const RECIPIENT    = "0x0857779Eebf731323A42f81718Aad5552483EE76";
const USDC         = "0x64544969ed7ebf5f083679233325356ebe738930"; // Real BSC testnet USDC (18 dec)
const USDC_AMOUNT  = "0.8";

const GHOST_NOTE   = "ghost:v1:00b5b94e307924d427f9252f84191da7ee4c98dd2bb2cb82d1b16fe8e2c115af:00aea3da6f7d466e287c59f05bf9bcf0fece9ca36861d8fd58a1fe34287c505d:0.5:USDC:12:1a530f765827122d1e3568ed3838fc4a8e20afe0ad8d0e6d590dc53dd45356e0";

// ── Contract addresses ────────────────────────────────────────────────────────
const ENTRY_POINT  = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const GHOST_POOL   = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa";
const GHOST_PM     = "0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df";
const GHOST_FACTORY = "0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0";
const POOL_USDC    = "0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33"; // MockUSDC used as feeToken in pool

// ── ABIs ──────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];
const FACTORY_ABI = [
    "function getAddress(address owner, uint256 salt) view returns (address)",
    "function createAccount(address owner, uint256 salt) returns (address)",
];
const EP_ABI = [
    "function getNonce(address sender, uint192 key) view returns (uint256)",
    "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
    `function handleOps(
        tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops,
        address payable beneficiary
    ) external`,
];
const POOL_ABI = [
    "function getLastRoot() view returns (bytes32)",
    "function isKnownRoot(bytes32) view returns (bool)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function packGas(hi: bigint, lo: bigint): string {
    return ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(hi), 16),
        ethers.zeroPadValue(ethers.toBeHex(lo), 16),
    ]);
}

function decodeNote(raw: string) {
    const parts = raw.trim().split(":");
    return {
        secret:       BigInt("0x" + parts[2]),
        nullifier:    BigInt("0x" + parts[3]),
        amount:       parts[4],
        tokenSymbol:  parts[5],
        leafIndex:    Number(parts[6]),
        commitment:   BigInt("0x" + parts[7]),
    };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const provider  = ethers.provider;
    const deployer  = new ethers.Wallet(DEPLOYER_KEY, provider);
    const user      = new ethers.Wallet(USER_KEY, provider);

    const usdc    = new ethers.Contract(USDC, ERC20_ABI, provider);
    const factory = new ethers.Contract(GHOST_FACTORY, FACTORY_ABI, provider);
    const ep      = new ethers.Contract(ENTRY_POINT, EP_ABI, deployer);
    const pool    = new ethers.Contract(GHOST_POOL, POOL_ABI, provider);
    const dec     = Number(await usdc.decimals());

    const sa = await factory.getFunction("getAddress(address,uint256)")(USER_EOA, 0n);

    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   Ghost Protocol — Gasless USDC Transfer Demo        ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");
    console.log("  EOA       :", USER_EOA);
    console.log("  SmartAcct :", sa);
    console.log("  Recipient :", RECIPIENT);
    console.log("  Amount    :", USDC_AMOUNT, "USDC");
    console.log("");
    console.log("  EOA BNB   :", ethers.formatEther(await provider.getBalance(USER_EOA)));
    console.log("  EOA USDC  :", ethers.formatUnits(await usdc.balanceOf(USER_EOA), dec));
    console.log("  Recipient USDC before:", ethers.formatUnits(await usdc.balanceOf(RECIPIENT), dec));

    // ── Step 1: Send tiny BNB to EOA for the approval tx ─────────────────────
    const eoaBnb = await provider.getBalance(USER_EOA);
    if (eoaBnb < ethers.parseEther("0.001")) {
        console.log("\n── Step 1: Fund EOA with 0.001 BNB for approval tx ──");
        const fundTx = await deployer.sendTransaction({
            to: USER_EOA,
            value: ethers.parseEther("0.001"),
        });
        await fundTx.wait();
        console.log("  ✓ Sent 0.001 BNB →", USER_EOA);
        console.log("  tx:", fundTx.hash);
    } else {
        console.log("\n── Step 1: EOA already has BNB ──");
        console.log("  ✓ Skipping fund step");
    }

    // ── Step 2: EOA approves SmartAccount to spend USDC ──────────────────────
    console.log("\n── Step 2: EOA approves SmartAccount ──");
    const usdcWithUser  = new ethers.Contract(USDC, ERC20_ABI, user);
    const amtWei = ethers.parseUnits(USDC_AMOUNT, dec);
    const allowance = await usdc.allowance(USER_EOA, sa);

    if (allowance < amtWei) {
        const approveTx = await usdcWithUser.approve(sa, amtWei);
        await approveTx.wait();
        console.log("  ✓ Approved SmartAccount to spend", USDC_AMOUNT, "USDC");
        console.log("  tx:", approveTx.hash);
    } else {
        console.log("  ✓ Already approved — skipping");
    }

    // ── Step 3: Deploy SmartAccount if needed ─────────────────────────────────
    console.log("\n── Step 3: SmartAccount ──");
    const code = await provider.getCode(sa);
    const isDeployed = code !== "0x";
    const initCode = isDeployed ? "0x" :
        ethers.concat([
            GHOST_FACTORY,
            new ethers.Interface(FACTORY_ABI).encodeFunctionData("createAccount", [USER_EOA, 0n]),
        ]);
    console.log("  SA deployed:", isDeployed ? "yes" : "no (will deploy in UserOp)");

    // ── Step 4: Decode Ghost Note ─────────────────────────────────────────────
    console.log("\n── Step 4: Ghost Note ──");
    const note = decodeNote(GHOST_NOTE);
    console.log("  Nullifier hash leaf:", note.leafIndex);

    const poseidonLib = await buildPoseidon();
    const poseidon = (inputs: bigint[]): bigint => poseidonLib.F.toObject(poseidonLib(inputs));
    const nullifierHash = poseidon([note.nullifier]);
    console.log("  Nullifier hash:", "0x" + nullifierHash.toString(16));

    const root = BigInt(await pool.getLastRoot());
    const isKnown = await pool.isKnownRoot(ethers.toBeHex(root, 32));
    console.log("  Merkle root known:", isKnown ? "✓" : "✗");
    if (!isKnown) throw new Error("Root not known!");

    // ── Step 5: Build paymasterAndData ────────────────────────────────────────
    const pubSignals: [bigint, bigint, bigint] = [root, nullifierHash, BigInt(sa)];
    const pA: [bigint, bigint] = [1n, 2n];
    const pB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
    const pC: [bigint, bigint] = [1n, 2n];

    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[3]"],
        [pA, pB, pC, pubSignals],
    );
    const header = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address"],
        [0n, 0n, POOL_USDC],
    );
    const pmVerGas  = ethers.zeroPadValue(ethers.toBeHex(900_000n), 16);
    const pmPostGas = ethers.zeroPadValue(ethers.toBeHex(200_000n), 16);
    const paymasterAndData = ethers.concat([GHOST_PM, pmVerGas, pmPostGas, header, proofEncoded]);

    // ── Step 6: Build UserOp callData ─────────────────────────────────────────
    // SmartAccount.execute → USDC.transferFrom(EOA, recipient, amount)
    const transferFromCall = new ethers.Interface(ERC20_ABI)
        .encodeFunctionData("transferFrom", [USER_EOA, RECIPIENT, amtWei]);

    const callData = new ethers.Interface(
        ["function execute(address target, uint256 value, bytes calldata data) external"]
    ).encodeFunctionData("execute", [USDC, 0n, transferFromCall]);

    // ── Step 7: Build + sign UserOp ───────────────────────────────────────────
    console.log("\n── Step 5: UserOperation ──");
    const nonce    = await ep.getNonce(sa, 0n);
    const gasPrice = BigInt(await provider.send("eth_gasPrice", []));
    console.log("  Nonce:", nonce.toString(), "| Gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");

    const partialOp = {
        sender:            sa,
        nonce:             nonce.toString(),
        initCode,
        callData,
        accountGasLimits:  packGas(500_000n, 300_000n),
        preVerificationGas: "300000",
        gasFees:            packGas(gasPrice, (gasPrice * 120n) / 100n),
        paymasterAndData,
        signature: "0x",
    };

    const userOpHash = await ep.getUserOpHash(partialOp);
    console.log("  UserOpHash:", userOpHash);

    const sig     = await user.signMessage(ethers.getBytes(userOpHash));
    const finalOp = { ...partialOp, signature: sig };

    // ── Step 8: Simulate ──────────────────────────────────────────────────────
    console.log("\n── Step 6: Simulate ──");
    try {
        await ep.handleOps.staticCall([finalOp], deployer.address, { gasLimit: 6_000_000n });
        console.log("  ✓ Simulation passed!");
    } catch (e: unknown) {
        const err = e as { reason?: string; message?: string; data?: string };
        console.log("  ✗ Simulation failed:", err.reason ?? err.message);
        if (err.data) console.log("  Raw:", err.data.slice(0, 100));
        throw new Error("Aborting — simulation failed");
    }

    // ── Step 9: Submit ────────────────────────────────────────────────────────
    console.log("\n── Step 7: Submit ──");
    const tx = await ep.handleOps([finalOp], deployer.address, { gasLimit: 6_000_000n });
    console.log("  tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("  ✓ Mined! Block:", receipt.blockNumber, "| Gas used:", receipt.gasUsed.toString());

    // ── Result ────────────────────────────────────────────────────────────────
    const recipientAfter = ethers.formatUnits(await usdc.balanceOf(RECIPIENT), dec);
    const eoaAfter       = ethers.formatUnits(await usdc.balanceOf(USER_EOA), dec);

    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║                  TRANSFER COMPLETE ✓                 ║");
    console.log("╠═══════════════════════════════════════════════════════╣");
    console.log(`║  Sent          : ${USDC_AMOUNT} USDC`);
    console.log(`║  From (EOA)    : ${USER_EOA}`);
    console.log(`║  To            : ${RECIPIENT}`);
    console.log(`║  EOA USDC left : ${eoaAfter}`);
    console.log(`║  Recipient bal : ${recipientAfter} USDC`);
    console.log(`║  Gas paid by   : GhostPaymaster (0 BNB from EOA)`);
    console.log("╠═══════════════════════════════════════════════════════╣");
    console.log("║  BscScan: https://testnet.bscscan.com/tx/" + receipt.hash.slice(0, 20) + "...");
    console.log("╚═══════════════════════════════════════════════════════╝");
    console.log("\nFull BscScan:", `https://testnet.bscscan.com/tx/${receipt.hash}`);
}

main().catch(e => { console.error("\n❌ FAILED:", e.message); process.exit(1); });
