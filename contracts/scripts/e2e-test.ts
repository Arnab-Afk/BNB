/**
 * e2e-test.ts â€” Full end-to-end test without frontend
 *
 * Wallet A (deployer)  : 0x90e6a10271D31EA4EA29B66D48e6f078C4091f77  (funds + owner)
 * Wallet B (blank)     : 0x44cd98CD2E773355dB5761E7D167F57f6a9fE1fB  (the clean recipient)
 *
 * Flow:
 *   1. Deployer mints + deposits USDC â†’ Ghost Note
 *   2. Compute Merkle path from chain events
 *   3. Build PackedUserOperation with correct gas + paymasterAndData
 *   4. Deployer signs (smart account owner)
 *   5. handleOps() via deployer bundler
 *   6. Print gas used + success
 */

import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";

// â”€â”€ Addresses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DEPLOYER_KEY = "1437c6e656c9afd75cae09210d80ea969aa614cba8a144ea9a8371e173332ddb";
const BLANK_WALLET = "0x44cd98CD2E773355dB5761E7D167F57f6a9fE1fB";

const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const GHOST_POOL = "0xd2c227909A77359b422C1BfEa6B482f2559eF6aa";
const GHOST_PM = "0xB5Be8a242feb47A40aE6BBC5C065b77Cec2eD6df";
const GHOST_FACTORY = "0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0";
const USDC = "0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33";

// Zero values read directly from deployed contract
const ZEROS = [
    5705183461228517602336801517105026607504870245084201526585420060990698713278n,
    13200837873415960474277735278496929275161749090519098737025201140524525578013n,
    15081410246777836761430117045741243346940299046218295051624574532193506020713n,
    4465329913260971202987516242986846745981800164654595949290788408555513164652n,
    15345377348476196619442649456655772007084588302342130569424336850247567339074n,
    15714955750633796992850721421408444015705628510842186252441223639217859446043n,
    3569330881614782090938323527786592093458656435567430579673430131460132648225n,
    14205374747123716994110868220597263133502347831021720670789370861912614153270n,
    17695894719908710769018504384570841291192049004492266901744679863670881374004n,
    7419009680392099361765151860919657308533959004408498543155637289070730431489n,
];
const TREE_DEPTH = 10;

// â”€â”€ ABIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ERC20_ABI = [
    "function mint(address to, uint256 amount) external",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
];
const POOL_ABI = [
    "function deposit(bytes32 commitment, uint256 amount, address token) external",
    "function nextLeafIndex() view returns (uint32)",
    "function getLastRoot() view returns (bytes32)",
    "function isKnownRoot(bytes32 root) view returns (bool)",
    "event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, uint256 amount, address indexed token, uint256 timestamp)",
];
const EP_ABI = [
    "function getNonce(address sender, uint192 key) view returns (uint256)",
    "function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
    `function handleOps(
    tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops,
    address payable beneficiary
  ) external`,
    "function getDepositInfo(address) view returns (uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime)",
];
const FACTORY_ABI = [
    "function getAddress(address owner, uint256 salt) view returns (address)",
    "function createAccount(address owner, uint256 salt) returns (address)",
];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function packGas(hi: bigint, lo: bigint): string {
    return ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(hi), 16),
        ethers.zeroPadValue(ethers.toBeHex(lo), 16),
    ]);
}

async function main() {
    const provider = ethers.provider;
    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

    console.log("â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
    console.log("â•‘     Ghost Protocol â€” Full E2E Test (Node)        â•‘");
    console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
    console.log("  Deployer  :", deployer.address);
    console.log("  Blank     :", BLANK_WALLET);
    console.log("  Balance   :", ethers.formatEther(await provider.getBalance(deployer.address)), "BNB\n");

    const poseidonLib = await buildPoseidon();
    const poseidon = (inputs: bigint[]): bigint => poseidonLib.F.toObject(poseidonLib(inputs));

    // â”€â”€ Step 1: Check Paymaster deposit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ep = new ethers.Contract(ENTRY_POINT, EP_ABI, deployer);
    const pmInfo = await ep.getDepositInfo(GHOST_PM);
    console.log("â”€â”€ Paymaster EntryPoint state â”€â”€");
    console.log("  Deposit :", ethers.formatEther(pmInfo.deposit), "BNB");
    console.log("  Staked  :", pmInfo.staked);
    if (pmInfo.deposit < ethers.parseEther("0.01")) {
        throw new Error("Paymaster has insufficient EntryPoint deposit! Top it up.");
    }

    // â”€â”€ Step 2: Deposit USDC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 1: Deposit â”€â”€");
    const erc20 = new ethers.Contract(USDC, ERC20_ABI, deployer);
    const pool = new ethers.Contract(GHOST_POOL, POOL_ABI, deployer);
    const dec = await erc20.decimals();
    const amt = ethers.parseUnits("1", dec);

    const secret = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const nullif = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const commit = poseidon([secret, nullif]);
    const nullHash = poseidon([nullif]);

    console.log("  Minting 1 USDC...");
    await (await erc20.mint(deployer.address, amt)).wait();
    console.log("  Approving GhostPool...");
    await (await erc20.approve(GHOST_POOL, amt)).wait();

    const leafIdx = Number(await pool.nextLeafIndex());
    console.log("  Depositing (leafIndex will be", leafIdx + ")...");
    const depositTx = await (await pool.deposit(ethers.toBeHex(commit, 32), amt, USDC)).wait();
    console.log("  âœ“ Deposit tx:", depositTx.hash);

    // â”€â”€ Step 3: Rebuild Merkle tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 2: Merkle tree â”€â”€");
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - 60000);
    const allEvents: ethers.EventLog[] = [];
    const CHUNK = 5000;
    for (let s = fromBlock; s <= latest; s += CHUNK) {
        const evs = await pool.queryFilter(pool.filters.Deposit(), s, Math.min(s + CHUNK - 1, latest));
        for (const ev of evs) allEvents.push(ev as ethers.EventLog);
    }
    console.log("  Deposit events found:", allEvents.length);

    const leaves: bigint[] = Array(2 ** TREE_DEPTH).fill(ZEROS[0]);
    for (const ev of allEvents) {
        leaves[Number(ev.args.leafIndex)] = BigInt(ev.args.commitment);
    }

    const layers: bigint[][] = [leaves];
    for (let d = 0; d < TREE_DEPTH; d++) {
        const prev = layers[d];
        const next: bigint[] = [];
        for (let i = 0; i < prev.length; i += 2) {
            next.push(poseidon([prev[i] ?? ZEROS[d], prev[i + 1] ?? ZEROS[d]]));
        }
        layers.push(next);
    }
    const root = layers[TREE_DEPTH][0];
    const onChainRoot = BigInt(await pool.getLastRoot());

    console.log("  JS root   :", "0x" + root.toString(16));
    console.log("  Chain root:", "0x" + onChainRoot.toString(16));
    console.log("  Match?    :", root === onChainRoot ? "âœ“ YES" : "âœ— NO â€” MISMATCH!");

    if (root !== onChainRoot) throw new Error("Root mismatch!");

    const isKnown = await pool.isKnownRoot(ethers.toBeHex(root, 32));
    console.log("  isKnownRoot:", isKnown ? "âœ“" : "âœ—");

    // â”€â”€ Step 4: Smart account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 3: Smart Account â”€â”€");
    const factory = new ethers.Contract(GHOST_FACTORY, FACTORY_ABI, deployer);
    const sa = await factory.getFunction("getAddress(address,uint256)")(deployer.address, 0n);
    const code = await provider.getCode(sa);
    const isDepl = code !== "0x";
    console.log("  Address :", sa);
    console.log("  Deployed:", isDepl ? "yes" : "no (initCode will deploy)");

    const initCode = isDepl ? "0x" :
        ethers.concat([
            GHOST_FACTORY,
            new ethers.Interface(FACTORY_ABI).encodeFunctionData("createAccount", [deployer.address, 0n]),
        ]);

    // â”€â”€ Step 5: Build paymasterAndData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 4: UserOperation â”€â”€");
    const nonce = await ep.getNonce(sa, 0n);
    console.log("  Nonce:", nonce.toString());

    const gasPrice = BigInt(await provider.send("eth_gasPrice", []));
    console.log("  Gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");

    // pubSignals[0]=root, [1]=nullifierHash, [2]=recipient(sa)
    const pubSignals: [bigint, bigint, bigint] = [root, nullHash, BigInt(sa)];

    // Dummy proof (ZK disabled â€” values ignored on-chain)
    const pA: [bigint, bigint] = [1n, 2n];
    const pB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
    const pC: [bigint, bigint] = [1n, 2n];

    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[3]"],
        [pA, pB, pC, pubSignals],
    );
    const header = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "address"],
        [0n, 0n, USDC],
    );

    const pmVerGas = ethers.zeroPadValue(ethers.toBeHex(900_000n), 16);
    const pmPostGas = ethers.zeroPadValue(ethers.toBeHex(200_000n), 16);
    const paymasterAndData = ethers.concat([GHOST_PM, pmVerGas, pmPostGas, header, proofEncoded]);
    console.log("  paymasterAndData length:", (paymasterAndData.length - 2) / 2, "bytes");

    // callData: smart account executes call to blank wallet
    const execCall = new ethers.Interface(
        ["function execute(address target, uint256 value, bytes calldata data) external"]
    ).encodeFunctionData("execute", [BLANK_WALLET, 0n, "0x"]);

    const partialOp = {
        sender: sa,
        nonce: nonce.toString(),
        initCode,
        callData: execCall,
        accountGasLimits: packGas(500_000n, 300_000n),
        preVerificationGas: "300000",
        gasFees: packGas(gasPrice, (gasPrice * 120n) / 100n),
        paymasterAndData,
        signature: "0x",
    };

    const userOpHash = await ep.getUserOpHash(partialOp);
    console.log("  UserOpHash:", userOpHash);

    const sig = await deployer.signMessage(ethers.getBytes(userOpHash));
    const finalOp = { ...partialOp, signature: sig };

    // â”€â”€ Step 6: Simulate first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 5: Simulate (eth_call) â”€â”€");
    try {
        await ep.handleOps.staticCall([finalOp], deployer.address, { gasLimit: BigInt(6_000_000) });
        console.log("  âœ“ Simulation passed!");
    } catch (simE: unknown) {
        const e = simE as { message?: string; reason?: string; data?: string };
        console.log("  âœ— Simulation failed:", e.reason ?? e.message);
        if (e.data) {
            // decode inner
            const pmIface = new ethers.Interface([
                "error InvalidPaymasterData()",
                "error InvalidZKProof()",
                "error UnknownMerkleRoot(bytes32)",
                "error NullifierAlreadySpent(bytes32)",
                "error RecipientMismatch(address,address)",
                "error TokenNotAllowed(address)",
                "error CallerNotPaymaster(address)",
                "error AA23 reverted()",
            ]);
            try { console.log("  Inner:", pmIface.parseError(e.data)); }
            catch (_) { console.log("  Raw data:", e.data?.slice(0, 100)); }
        }
        throw new Error("Simulation failed â€” not submitting");
    }

    // â”€â”€ Step 7: Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nâ”€â”€ Step 6: Submit handleOps â”€â”€");
    const tx = await ep.handleOps([finalOp], deployer.address, { gasLimit: BigInt(6_000_000) });
    console.log("  tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("  âœ“ Mined! Block:", receipt.blockNumber, " Gas used:", receipt.gasUsed.toString());
    console.log("\nðŸŽ‰ E2E test PASSED!");
    console.log("  BscScan:", `https://testnet.bscscan.com/tx/${receipt.hash}`);
}

main().catch(e => { console.error("\nâŒ FAILED:", e.message); process.exit(1); });

