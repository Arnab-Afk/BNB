import { encodeAbiParameters, parseAbiParameters, Hex } from "viem";

export class UserOpBuilder {
  /**
   * Encodes the paymasterAndData field exactly matching GhostPaymaster._decodePaymasterData()
   * Layout: [validUntil:32][validAfter:32][feeToken:32][abi.encode(ZKProof)]
   */
  static encodePaymasterAndData(
    validUntil: number,
    validAfter: number,
    feeToken: Hex,
    proof: any
  ): Hex {
    // Encodes ZKProof using the standard 8 uint256 array representation for Groth16
    const encodedProof = encodeAbiParameters(
      parseAbiParameters("uint256[2] pA, uint256[2][2] pB, uint256[2] pC"),
      [
        [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
        [
          [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
          [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]
        ],
        [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])]
      ]
    );

    // Encode standard 32-byte chunks (uint256 natively pads to 32 bytes)
    const packedTimestampsAndToken = encodeAbiParameters(
      parseAbiParameters("uint256 validUntil, uint256 validAfter, address feeToken"),
      [BigInt(validUntil), BigInt(validAfter), feeToken]
    );

    // Combine them, stripping the "0x" from the encodedProof
    return (packedTimestampsAndToken + encodedProof.slice(2)) as Hex;
  }

  static buildUserOp(
    callData: Hex,
    proof: any,
    publicSignals: any[],
    feeToken: Hex,
    options: any = {}
  ) {
    const paymasterAndData = this.encodePaymasterAndData(
      options.validUntil || 0,
      options.validAfter || 0,
      feeToken,
      proof
    );

    // Structure matching generic EntryPoint V6 UserOperation
    return {
      sender: options.sender || "0x",
      nonce: options.nonce || "0x0",
      initCode: options.initCode || "0x",
      callData,
      callGasLimit: options.callGasLimit || "0x5208", 
      verificationGasLimit: options.verificationGasLimit || "0x186a0", 
      preVerificationGas: options.preVerificationGas || "0x5208", 
      maxFeePerGas: options.maxFeePerGas || "0x0",
      maxPriorityFeePerGas: options.maxPriorityFeePerGas || "0x0",
      paymasterAndData,
      signature: options.signature || "0x"
    };
  }
}
