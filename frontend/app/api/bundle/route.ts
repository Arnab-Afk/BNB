/**
 * POST /api/bundle
 *
 * Mini-bundler: receives a signed UserOperation from the frontend,
 * calls EntryPoint.handleOps() with the deployer wallet paying BNB gas.
 *
 * The fresh user wallet pays ZERO BNB — real BNB is deducted from the
 * GhostPaymaster's EntryPoint deposit. After execution, GhostPaymaster
 * calls GhostPool.deductFee() to recover the USDC cost from the pool.
 *
 * Request body:
 *   { userOp: PackedUserOperation }
 *
 * Response:
 *   { txHash: string } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// ── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = "https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e";
const PRIVATE_KEY = "1437c6e656c9afd75cae09210d80ea969aa614cba8a144ea9a8371e173332ddb";
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const ENTRY_POINT_ABI = [
    `function handleOps(
    tuple(
      address sender,
      uint256 nonce,
      bytes   initCode,
      bytes   callData,
      bytes32 accountGasLimits,
      uint256 preVerificationGas,
      bytes32 gasFees,
      bytes   paymasterAndData,
      bytes   signature
    )[] ops,
    address payable beneficiary
  ) external`,
    "function getNonce(address sender, uint192 key) view returns (uint256)",
];

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const { userOp } = await req.json() as { userOp: Record<string, string> };
        if (!userOp) {
            return NextResponse.json({ error: "Missing userOp in request body" }, { status: 400 });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const bundler = new ethers.Wallet(PRIVATE_KEY, provider);
        const entryPoint = new ethers.Contract(ENTRY_POINT, ENTRY_POINT_ABI, bundler);

        console.log("[bundler] Submitting UserOp for sender:", userOp.sender);
        console.log("[bundler] Beneficiary (gas fee collector):", bundler.address);

        // handleOps — beneficiary is the bundler itself (collects EntryPoint gas refund)
        const tx = await entryPoint.handleOps(
            [userOp],
            bundler.address,
            {
                gasLimit: 3_000_000n,
            }
        );

        console.log("[bundler] tx submitted:", tx.hash);
        const receipt = await tx.wait();
        console.log("[bundler] confirmed in block:", receipt.blockNumber);

        return NextResponse.json({ txHash: receipt.hash });

    } catch (e: unknown) {
        const err = e as { message?: string; reason?: string; shortMessage?: string };
        const msg = err.shortMessage ?? err.reason ?? err.message ?? String(e);
        console.error("[bundler] error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
