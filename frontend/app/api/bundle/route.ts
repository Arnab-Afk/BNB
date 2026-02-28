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

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const PRIVATE_KEY = process.env.BUNDLER_PRIVATE_KEY;
const ENTRY_POINT = process.env.NEXT_PUBLIC_ENTRY_POINT ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

if (!RPC_URL) throw new Error("Missing env: NEXT_PUBLIC_RPC_URL");
if (!PRIVATE_KEY) throw new Error("Missing env: BUNDLER_PRIVATE_KEY");

// After guards both are definitely strings — help TypeScript
const _RPC = RPC_URL as string;
const _PK = PRIVATE_KEY as string;

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

        const provider = new ethers.JsonRpcProvider(_RPC);
        const bundler = new ethers.Wallet(_PK, provider);
        const entryPoint = new ethers.Contract(ENTRY_POINT, ENTRY_POINT_ABI, bundler);

        console.log("[bundler] Submitting UserOp for sender:", userOp.sender);
        console.log("[bundler] Beneficiary (gas fee collector):", bundler.address);

        // handleOps — beneficiary is the bundler itself (collects EntryPoint gas refund)
        // gasLimit must cover:
        //   - paymasterVerificationGasLimit (900k) for Groth16 on-chain verification
        //   - accountVerificationGasLimit   (500k) for smart account validateUserOp
        //   - callGasLimit                  (300k) for smart account execute()
        //   - postOpGasLimit                (200k) for paymaster postOp + deductFee
        //   - preVerificationGas            (300k) overhead
        //   Total budget: ~2.2M → use 5M to be safe
        // ── Simulate first to get clear revert reason without wasting gas ────────
        try {
            await entryPoint.handleOps.staticCall(
                [userOp],
                bundler.address,
                { gasLimit: BigInt(5_000_000) }
            );
        } catch (simErr: unknown) {
            const se = simErr as { data?: string; message?: string; shortMessage?: string };
            // Decode EntryPoint FailedOp(uint256 opIndex, string reason) = 0x220266b6
            let reason = se.shortMessage ?? se.message ?? "simulation failed";
            if (se.data && se.data.startsWith("0x220266b6")) {
                // abi.decode the reason string
                try {
                    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                        ["uint256", "string"], "0x" + se.data.slice(10)
                    );
                    reason = `AA revert: ${decoded[1]} (opIndex ${decoded[0]})`;
                } catch { /* keep original */ }
            }
            console.error("[bundler] simulation failed:", reason, "| data:", se.data);
            return NextResponse.json({ error: `Simulation failed: ${reason}` }, { status: 500 });
        }

        const tx = await entryPoint.handleOps(
            [userOp],
            bundler.address,
            { gasLimit: BigInt(5_000_000) }
        );

        console.log("[bundler] tx submitted:", tx.hash);
        const receipt = await tx.wait();
        console.log("[bundler] confirmed in block:", receipt.blockNumber, "gas used:", receipt.gasUsed.toString());

        return NextResponse.json({ txHash: receipt.hash });

    } catch (e: unknown) {
        const err = e as { message?: string; reason?: string; shortMessage?: string; data?: string };
        const msg = err.shortMessage ?? err.reason ?? err.message ?? String(e);
        console.error("[bundler] error:", msg);
        if (err.data) console.error("[bundler] revert data:", err.data);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
