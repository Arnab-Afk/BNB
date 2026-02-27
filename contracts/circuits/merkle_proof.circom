pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

/*
 * GhostCommitment — Merkle inclusion proof circuit for Ghost Privacy Pool
 *
 * Private inputs (never revealed on-chain):
 *   secret         : random 32-byte value known only to depositor
 *   nullifier      : random 32-byte value known only to depositor
 *   pathElements   : sibling hashes along the Merkle path
 *   pathIndices    : 0 = current node is LEFT child, 1 = RIGHT child
 *
 * Public inputs (broadcast on-chain inside the proof):
 *   root           : Merkle tree root the user proves against (must be known to GhostPool)
 *   nullifierHash  : Poseidon(nullifier) — stored on-chain to prevent double-spend
 *   recipient      : userOp.sender — binds this proof to exactly one UserOperation
 *                    (prevents a bundler from re-routing the proof to another wallet)
 *
 * What the circuit proves:
 *   1. nullifierHash == Poseidon(nullifier)                          <- prevent double-spend
 *   2. commitment   == Poseidon(secret, nullifier)                   <- you know the secret
 *   3. MerkleRoot(commitment, pathElements, pathIndices) == root     <- commitment is in tree
 *   4. recipient    is included as a public signal                   <- proof is bound to sender
 *
 * Tree depth (levels) must match GhostPool.sol constructor argument:
 *   testnet  : 10  (1,024 max deposits)
 *   mainnet  : 20  (1,048,576 max deposits)
 */

// Verifies a Merkle membership proof for a binary Poseidon Merkle tree
template MerkleTreeChecker(levels) {
    signal input  leaf;
    signal input  pathElements[levels];
    signal input  pathIndices[levels];
    signal output root;

    component hashers[levels];
    component mux[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {

        // Enforce binary path index (0 or 1)
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Route: if pathIndices[i] == 0  →  hash(currentNode, sibling)
        //        if pathIndices[i] == 1  →  hash(sibling, currentNode)
        mux[i]       = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];    // left  when index=0
        mux[i].c[0][1] <== pathElements[i];   // left  when index=1
        mux[i].c[1][0] <== pathElements[i];   // right when index=0
        mux[i].c[1][1] <== levelHashes[i];    // right when index=1
        mux[i].s       <== pathIndices[i];

        hashers[i]          = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[levels];
}

// Main Ghost Privacy Pool commitment circuit (levels = tree depth)
template GhostCommitment(levels) {

    // ── Private inputs ────────────────────────────────────────────────────────
    signal input secret;
    signal input nullifier;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────────────────────────
    signal input root;           // Public signal index 0
    signal input nullifierHash;  // Public signal index 1
    signal input recipient;      // Public signal index 2

    // ── 1. Verify nullifierHash = Poseidon(nullifier) ─────────────────────────
    component nullifierHasher    = Poseidon(1);
    nullifierHasher.inputs[0]   <== nullifier;
    nullifierHash               === nullifierHasher.out;

    // ── 2. Compute commitment = Poseidon(secret, nullifier) ───────────────────
    component commitmentHasher   = Poseidon(2);
    commitmentHasher.inputs[0]  <== secret;
    commitmentHasher.inputs[1]  <== nullifier;

    // ── 3. Verify commitment ∈ Merkle tree with given root ────────────────────
    component tree              = MerkleTreeChecker(levels);
    tree.leaf                   <== commitmentHasher.out;

    for (var i = 0; i < levels; i++) {
        tree.pathElements[i]    <== pathElements[i];
        tree.pathIndices[i]     <== pathIndices[i];
    }

    root                        === tree.root;

    // ── 4. Bind proof to recipient (prevents proof re-use across UserOps) ─────
    // We square recipient to create a real constraint involving it.
    // This forces the prover to commit to the exact recipient address.
    signal recipientSquared;
    recipientSquared            <== recipient * recipient;
}

// Instantiate for testnet (levels=10) and mainnet (levels=20).
// Change this number to match your GhostPool deployment.
component main { public [root, nullifierHash, recipient] } = GhostCommitment(10);
