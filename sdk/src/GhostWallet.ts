/**
 * GhostWallet — spending key + viewing key management
 *
 * Secret/nullifier generation uses crypto.getRandomValues (browser + Node 19+)
 * for cryptographically secure randomness — NOT Math.random.
 *
 * Note encoding matches frontend/lib/ghost.ts so notes are cross-compatible.
 */

export interface GhostNote {
  secret: string;      // hex, 31 bytes (62 chars), no 0x
  nullifier: string;   // hex, 31 bytes (62 chars), no 0x
  commitment: string;  // hex, 32 bytes (64 chars), no 0x
  amount: string;
  token: string;
  leafIndex: number;
  raw: string;         // ghost:v1:... encoded string (save & restore)
}

export class GhostWallet {
  /** Relayer-level spending key (hex, 32 bytes) */
  public readonly spendingKey: string;
  /** Viewing key — share with auditor to reveal tx history */
  public readonly viewingKey: string;

  constructor(spendingKey: string, viewingKey: string) {
    this.spendingKey = spendingKey;
    this.viewingKey = viewingKey;
  }

  // ── Key generation ──────────────────────────────────────────────────────────

  /** Create a new wallet with a fresh random spending + viewing key pair. */
  static create(): GhostWallet {
    const spending = GhostWallet._randomHex(32);
    // Viewing key is a deterministic derivation of spending key (XOR + shift).
    // For production, use BabyJubJub key derivation.
    const viewBuf = Buffer.from(spending, "hex");
    viewBuf[0] ^= 0xff;
    const viewing = viewBuf.toString("hex");
    return new GhostWallet(spending, viewing);
  }

  /** Restore from a 64-char hex spending key (load from local storage). */
  static fromSpendingKey(spendingKey: string): GhostWallet {
    const raw = spendingKey.replace(/^0x/, "");
    const viewBuf = Buffer.from(raw, "hex");
    viewBuf[0] ^= 0xff;
    return new GhostWallet(raw, viewBuf.toString("hex"));
  }

  // ── Note generation ─────────────────────────────────────────────────────────

  /**
   * Generate cryptographically random secret + nullifier.
   * Commitment must be computed on-chain or via poseidon(secret, nullifier).
   * This returns a partial note — leafIndex + commitment are set after deposit.
   */
  generateSecretAndNullifier(): { secret: string; nullifier: string } {
    return {
      secret: GhostWallet._randomHex(31),
      nullifier: GhostWallet._randomHex(31),
    };
  }

  // ── Note encoding / decoding ────────────────────────────────────────────────
  // Format: ghost:v1:<secretHex>:<nullifierHex>:<amount>:<token>:<leafIndex>:<commitmentHex>
  // Matches frontend/lib/ghost.ts — notes are cross-compatible.

  static encodeNote(
    secret: string,
    nullifier: string,
    amount: string,
    token: string,
    leafIndex: number,
    commitment: string,
  ): string {
    return [
      "ghost:v1",
      secret.replace(/^0x/, "").padStart(64, "0"),
      nullifier.replace(/^0x/, "").padStart(64, "0"),
      amount,
      token,
      leafIndex.toString(),
      commitment.replace(/^0x/, "").padStart(64, "0"),
    ].join(":");
  }

  static decodeNote(raw: string): GhostNote {
    const parts = raw.trim().split(":");
    if (parts.length !== 8 || parts[0] !== "ghost" || parts[1] !== "v1") {
      throw new Error(
        `Invalid Ghost Note — expected ghost:v1:…(8 parts), got ${parts.length} parts`,
      );
    }
    return {
      secret: parts[2]!,
      nullifier: parts[3]!,
      amount: parts[4]!,
      token: parts[5]!,
      leafIndex: Number(parts[6]),
      commitment: parts[7]!,
      raw,
    };
  }

  // ── Compliance ──────────────────────────────────────────────────────────────

  /**
   * Export viewing key in hex for sharing with an auditor.
   * The auditor can use this to reconstruct the tx history — the chain still
   * sees nothing.
   */
  exportViewingKey(): string {
    return "0x" + this.viewingKey;
  }

  // ── Utils ───────────────────────────────────────────────────────────────────

  private static _randomHex(bytes: number): string {
    const buf = new Uint8Array(bytes);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
    } else {
      // Node.js fallback
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { randomBytes } = require("crypto") as { randomBytes: (n: number) => Buffer };
      const rb = randomBytes(bytes);
      rb.copy(Buffer.from(buf.buffer));
    }
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
