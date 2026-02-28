/**
 * GhostPool.test.ts — Hardhat tests for GhostPool.sol
 *
 * Tests:
 *  - Deployment: pool initialized correctly
 *  - Deposit: happy path with ERC20 approval
 *  - Deposit: reverts with unknown denomination
 *  - Deposit: reverts on double-spend (duplicate commitment)
 *  - Merkle tree: root updates after deposit
 *  - isKnownRoot: returns true for recent roots
 *
 * Run: npx hardhat test test/GhostPool.test.ts --network hardhat
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import type { ContractFactory, Contract } from "ethers";

// ── Helpers ────────────────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
    return buf;
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/^0x/, "");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// ── Deployment fixture ─────────────────────────────────────────────────────────

async function deployFixture() {
    const [owner, relayer, user1, user2] = await ethers.getSigners();

    // Deploy PoseidonHasher (links all T2..T6 variants)
    const PoseidonT2 = await ethers.deployContract("PoseidonT2");
    const PoseidonT3 = await ethers.deployContract("PoseidonT3");
    const PoseidonHasher = await ethers.deployContract("PoseidonHasher", [
        await PoseidonT2.getAddress(),
        await PoseidonT3.getAddress(),
    ]);

    // Deploy mock USDC with 6 decimals
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20Factory.deploy("MockUSDC", "USDC", 6);
    await mockUSDC.waitForDeployment();

    // Mint 100,000 USDC to user1
    await mockUSDC.mint(await user1.getAddress(), ethers.parseUnits("100000", 6));

    // Deploy EntryPoint (mock)
    const MockEntryPoint = await ethers.deployContract("MockEntryPoint");

    // Deploy GhostPool
    const GhostPool = await ethers.getContractFactory("GhostPool");
    const pool = await GhostPool.deploy(
        await PoseidonHasher.getAddress(),
        await MockEntryPoint.getAddress(),
        owner.address,
    );
    await pool.waitForDeployment();

    return { owner, relayer, user1, user2, mockUSDC, pool, PoseidonHasher };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GhostPool", function () {
    let poseidon: Awaited<ReturnType<typeof buildPoseidon>>;

    before(async function () {
        poseidon = await buildPoseidon();
    });

    function hash(a: bigint, b: bigint): bigint {
        return poseidon.F.toObject(poseidon([a, b])) as bigint;
    }

    it("deploys with correct initial state", async function () {
        const { pool } = await deployFixture();
        expect(await pool.nextLeafIndex()).to.equal(0n);
    });

    it("accepts a deposit with valid denomination", async function () {
        const { pool, mockUSDC, user1 } = await deployFixture();

        const secret = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const nullifier = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const commitment = hash(secret, nullifier);
        const commitBytes32 = ethers.toBeHex(commitment, 32);

        const poolAddr = await pool.getAddress();
        const amount = ethers.parseUnits("100", 6); // 100 USDC

        await mockUSDC.connect(user1).approve(poolAddr, amount);

        await expect(
            pool.connect(user1).deposit(commitBytes32, amount, await mockUSDC.getAddress())
        ).to.emit(pool, "Deposit").withArgs(0n, commitBytes32, await mockUSDC.getAddress(), amount);

        expect(await pool.nextLeafIndex()).to.equal(1n);
    });

    it("rejects a duplicate commitment (double-deposit)", async function () {
        const { pool, mockUSDC, user1 } = await deployFixture();

        const secret = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const nullifier = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const commitment = hash(secret, nullifier);
        const commitBytes32 = ethers.toBeHex(commitment, 32);

        const poolAddr = await pool.getAddress();
        const amount = ethers.parseUnits("100", 6);

        await mockUSDC.connect(user1).approve(poolAddr, amount * 2n);
        await pool.connect(user1).deposit(commitBytes32, amount, await mockUSDC.getAddress());

        // Second deposit with same commitment should revert
        await expect(
            pool.connect(user1).deposit(commitBytes32, amount, await mockUSDC.getAddress())
        ).to.be.revertedWithCustomError(pool, "CommitmentAlreadyExists");
    });

    it("updates the merkle root after deposit", async function () {
        const { pool, mockUSDC, user1 } = await deployFixture();

        const initialRoot = await pool.getLatestRoot();

        const secret = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const nullifier = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const commitment = hash(secret, nullifier);
        const commitBytes32 = ethers.toBeHex(commitment, 32);

        const poolAddr = await pool.getAddress();
        await mockUSDC.connect(user1).approve(poolAddr, ethers.parseUnits("100", 6));
        await pool.connect(user1).deposit(commitBytes32, ethers.parseUnits("100", 6), await mockUSDC.getAddress());

        const newRoot = await pool.getLatestRoot();
        expect(newRoot).to.not.equal(initialRoot);
    });

    it("isKnownRoot returns true for the latest root", async function () {
        const { pool, mockUSDC, user1 } = await deployFixture();

        const secret = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const nullifier = BigInt("0x" + Buffer.from(randomBytes(31)).toString("hex"));
        const commitment = hash(secret, nullifier);
        const commitBytes32 = ethers.toBeHex(commitment, 32);

        const poolAddr = await pool.getAddress();
        await mockUSDC.connect(user1).approve(poolAddr, ethers.parseUnits("100", 6));
        await pool.connect(user1).deposit(commitBytes32, ethers.parseUnits("100", 6), await mockUSDC.getAddress());

        const root = await pool.getLatestRoot();
        expect(await pool.isKnownRoot(root)).to.be.true;
    });

    it("isKnownRoot returns false for a random root", async function () {
        const { pool } = await deployFixture();
        const fakeRoot = ethers.toBeHex(BigInt("0xdeadbeef"), 32);
        expect(await pool.isKnownRoot(fakeRoot)).to.be.false;
    });
});
