/**
 * UserOpBuilder — builds PackedUserOperation structs for ERC-4337 EntryPoint v0.7
 *
 * EntryPoint v0.7 uses a PACKED layout, different from v0.6:
 *   - accountGasLimits = verificationGasLimit(16B) | callGasLimit(16B)  as bytes32
 *   - gasFees          = maxPriorityFeePerGas(16B) | maxFee(16B)         as bytes32
 *   - initCode can be "0x" (not present) or factory addr + calldata
 *
 * paymasterAndData layout (Ghost-specific):
 *   [0:20]    GhostPaymaster address
 *   [20:36]   verificationGasLimit for paymaster (uint128, 16B)
 *   [36:52]   postOpGasLimit (uint128, 16B)
 *   [52:84]   validUntil (uint256)
 *   [84:116]  validAfter (uint256)
 *   [116:148] feeToken address (uint256-padded)
 *   [148:]    abi.encode(pi_a, pi_b, pi_c, publicSignals)
 */

import { ethers } from "ethers";
import type { Groth16Proof } from "snarkjs";

// ─── Packed helpers ────────────────────────────────────────────────────────────

function pack128(hi: bigint, lo: bigint): string {
  const hiPad = ethers.zeroPadValue(ethers.toBeHex(hi), 16);
  const loPad = ethers.zeroPadValue(ethers.toBeHex(lo), 16);
  return ethers.concat([hiPad, loPad]);
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PackedUserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  accountGasLimits: string;   // bytes32 packed
  preVerificationGas: bigint | string;
  gasFees: string;            // bytes32 packed
  paymasterAndData: string;
  signature: string;
}

export interface GhostPaymasterData {
  paymasterAddress: string;
  /** Gas limit for GhostPaymaster.validatePaymasterUserOp (Groth16 ~800k) */
  verificationGasLimit?: bigint;
  /** Gas limit for GhostPaymaster._postOp (deductFee ~50k) */
  postOpGasLimit?: bigint;
  validUntil?: bigint;        // 0 = no expiry
  validAfter?: bigint;        // 0 = no delay
  feeToken: string;           // ERC-20 address to pay gas in
  proof: Groth16Proof;
  root: bigint;
  nullifierHash: bigint;
  recipient: string;
}

// ─── UserOpBuilder ────────────────────────────────────────────────────────────

export class UserOpBuilder {
  /**
   * Build paymasterAndData for GhostPaymaster (ERC-4337 v0.7).
   *
   * Layout matches GhostPaymaster._decodePaymasterData() exactly.
   * The pi_b field is swapped per Groth16 BN128 on-chain convention.
   */
  static encodePaymasterAndData(data: GhostPaymasterData): string {
    const {
      paymasterAddress,
      verificationGasLimit = 900_000n,
      postOpGasLimit = 200_000n,
      validUntil = 0n,
      validAfter = 0n,
      feeToken,
      proof,
      root,
      nullifierHash,
      recipient,
    } = data;

    // Groth16 on-chain convention: pi_b rows are swapped
    const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
    const pubSignals: [bigint, bigint, bigint] = [root, nullifierHash, BigInt(recipient)];

    // ABI-encode the ZK proof + public signals
    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[3]"],
      [pA, pB, pC, pubSignals],
    );

    // ABI-encode the header (validUntil, validAfter, feeToken)
    const header = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "address"],
      [validUntil, validAfter, feeToken],
    );

    // v0.7 paymasterAndData = addr(20) + verGasLim(16) + postOpGasLim(16) + header + proof
    const verGasLimPacked = ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16);
    const postOpGasLimPacked = ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16);

    return ethers.concat([
      paymasterAddress,
      verGasLimPacked,
      postOpGasLimPacked,
      header,
      proofEncoded,
    ]);
  }

  /**
   * Build a complete PackedUserOperation for EntryPoint v0.7.
   * Signature field is "0x" — sign the hash returned by EntryPoint.getUserOpHash()
   * and set it before submitting.
   */
  static buildUserOp(options: {
    sender: string;
    nonce: bigint;
    initCode: string;
    callData: string;
    paymasterData: GhostPaymasterData;
    verificationGasLimit?: bigint;
    callGasLimit?: bigint;
    preVerificationGas?: bigint;
    gasPrice: bigint;
  }): PackedUserOperation {
    const {
      sender,
      nonce,
      initCode,
      callData,
      paymasterData,
      verificationGasLimit = 500_000n,
      callGasLimit = 300_000n,
      preVerificationGas = 300_000n,
      gasPrice,
    } = options;

    const gasBump = (gasPrice * 120n) / 100n; // +20% tip

    return {
      sender,
      nonce,
      initCode,
      callData,
      accountGasLimits: pack128(verificationGasLimit, callGasLimit),
      preVerificationGas,
      gasFees: pack128(gasPrice, gasBump),
      paymasterAndData: UserOpBuilder.encodePaymasterAndData(paymasterData),
      signature: "0x",
    };
  }
}
