# setup-zk.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Ghost Privacy Suite — Full ZK Setup Script (Windows PowerShell)
#
# What this does:
#   1. Installs circomlibjs (Poseidon constants generator)
#   2. Generates real PoseidonHasher.sol with embedded circomlibjs bytecode
#   3. Installs circom compiler
#   4. Compiles merkle_proof.circom → .r1cs + .wasm
#   5. Downloads powers of tau (trusted setup file)
#   6. Runs phase 2 setup → merkle_proof_final.zkey
#   7. Exports Groth16Verifier.sol (replaces mock verifier)
#   8. Compiles all contracts
#
# Run from the contracts/ directory:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-zk.ps1
#
# Requirements: Node.js 18+, npm, internet connection (~300MB download)
# Time: ~15-20 minutes (dominated by powers of tau download)
# ─────────────────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log-Step($msg) { Write-Host "`n  [$msg]" -ForegroundColor Cyan }
function Log-Ok($msg)   { Write-Host "  ✓ $msg"  -ForegroundColor Green }
function Log-Warn($msg) { Write-Host "  ⚠ $msg"  -ForegroundColor Yellow }
function Log-Error($msg){ Write-Host "  ✗ $msg"  -ForegroundColor Red }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   👻 Ghost Privacy Suite — ZK Setup                 ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Verify we're in the right place ──────────────────────────────────────────
if (-not (Test-Path "package.json")) {
    Log-Error "Run this script from the contracts/ directory."
    exit 1
}

# ── Step 1: Install circomlibjs ───────────────────────────────────────────────
Log-Step "Step 1: Installing circomlibjs"
npm install --save-dev circomlibjs snarkjs 2>&1 | Select-String -NotMatch "npm warn"
Log-Ok "circomlibjs + snarkjs installed"

# ── Step 2: Generate real PoseidonHasher.sol ──────────────────────────────────
Log-Step "Step 2: Generating real PoseidonHasher.sol"
node scripts/generate-contracts.js
Log-Ok "PoseidonHasher.sol written with circomlibjs bytecode"

# ── Step 3: Install circom compiler ──────────────────────────────────────────
Log-Step "Step 3: Installing circom compiler"
$circomVersion = "2.1.8"
$circomUrl = "https://github.com/iden3/circom/releases/download/v$circomVersion/circom-windows-amd64.exe"
$circomPath = "$env:USERPROFILE\.circom\circom.exe"

if (-not (Test-Path $circomPath)) {
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.circom" | Out-Null
    Write-Host "  Downloading circom $circomVersion (~5MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $circomUrl -OutFile $circomPath
    Log-Ok "circom downloaded to $circomPath"
} else {
    Log-Ok "circom already installed"
}

# Add to PATH for this session
$env:PATH = "$env:USERPROFILE\.circom;$env:PATH"

# Verify
$ver = & circom --version 2>&1
Log-Ok "circom version: $ver"

# ── Step 4: Install circomlib (circuit dependency) ────────────────────────────
Log-Step "Step 4: Installing circomlib"
if (-not (Test-Path "node_modules/circomlib")) {
    npm install --save-dev circomlib 2>&1 | Select-String -NotMatch "npm warn"
}
Log-Ok "circomlib ready"

# ── Step 5: Compile the circuit ───────────────────────────────────────────────
Log-Step "Step 5: Compiling merkle_proof.circom"
$circuitsDir = "circuits"
$buildDir    = "circuits/build"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

& circom "$circuitsDir/merkle_proof.circom" `
    --r1cs `
    --wasm `
    --sym  `
    --output $buildDir `
    --include node_modules

if ($LASTEXITCODE -ne 0) {
    Log-Error "Circuit compilation failed. Check circuits/merkle_proof.circom"
    exit 1
}
Log-Ok "Circuit compiled → circuits/build/merkle_proof.r1cs"
Log-Ok "Witness generator → circuits/build/merkle_proof_js/merkle_proof.wasm"

# ── Step 6: Download powers of tau ────────────────────────────────────────────
Log-Step "Step 6: Powers of tau (trusted setup)"
$ptauFile = "circuits/build/powersOfTau28_hez_final_15.ptau"

if (-not (Test-Path $ptauFile)) {
    # For 10-level tree: circuit has ~10,000 constraints → ptau 15 is sufficient (2^15 = 32768)
    # Source: Hermez/iden3 ceremony (publicly verified)
    $ptauUrl = "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau"
    Write-Host "  Downloading powers of tau (~200MB, this takes a few minutes)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $ptauUrl -OutFile $ptauFile
    Log-Ok "Powers of tau downloaded"
} else {
    Log-Ok "Powers of tau already downloaded"
}

# ── Step 7: Phase 2 setup (circuit-specific) ──────────────────────────────────
Log-Step "Step 7: Phase 2 setup (groth16)"
$zkeyFile  = "circuits/build/merkle_proof_0.zkey"
$finalZkey = "circuits/build/merkle_proof_final.zkey"

Write-Host "  Running groth16 setup..." -ForegroundColor Gray
npx snarkjs groth16 setup `
    "$buildDir/merkle_proof.r1cs" `
    $ptauFile `
    $zkeyFile

if ($LASTEXITCODE -ne 0) { Log-Error "Phase 2 setup failed"; exit 1 }

# Contribute randomness for the testnet ceremony
# NOTE: For mainnet, use a proper multi-party ceremony (MPC)
Write-Host "  Contributing randomness (testnet only)..." -ForegroundColor Gray
$entropy = -join ((65..90) + (97..122) | Get-Random -Count 50 | ForEach-Object {[char]$_})
echo $entropy | npx snarkjs zkey contribute `
    $zkeyFile `
    $finalZkey `
    --name="Ghost Privacy Testnet Deploy" `
    -v

if ($LASTEXITCODE -ne 0) { Log-Error "zkey contribute failed"; exit 1 }
Log-Ok "Final zkey ready: $finalZkey"

# ── Step 8: Export verification key ──────────────────────────────────────────
Log-Step "Step 8: Exporting verification key"
npx snarkjs zkey export verificationkey `
    $finalZkey `
    "circuits/build/verification_key.json"

Log-Ok "Verification key exported: circuits/build/verification_key.json"

# ── Step 9: Generate Groth16Verifier.sol ──────────────────────────────────────
Log-Step "Step 9: Generating Groth16Verifier.sol"
npx snarkjs zkey export solidityverifier `
    $finalZkey `
    "contracts/Groth16Verifier.sol"

if ($LASTEXITCODE -ne 0) { Log-Error "Verifier export failed"; exit 1 }

# Fix SPDX license header (snarkjs doesn't always add it)
$verifierContent = Get-Content "contracts/Groth16Verifier.sol" -Raw
if (-not $verifierContent.StartsWith("// SPDX")) {
    "// SPDX-License-Identifier: MIT`n" + $verifierContent | Set-Content "contracts/Groth16Verifier.sol"
}

Log-Ok "Groth16Verifier.sol generated: contracts/Groth16Verifier.sol"

# ── Step 10: Compile everything ────────────────────────────────────────────────
Log-Step "Step 10: Compiling all contracts"
node node_modules/hardhat/internal/cli/cli.js compile

if ($LASTEXITCODE -ne 0) { Log-Error "Hardhat compile failed"; exit 1 }
Log-Ok "All contracts compiled"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ ZK SETUP COMPLETE                               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Generated files:" -ForegroundColor White
Write-Host "    contracts/PoseidonHasher.sol       (real circomlibjs Poseidon)"
Write-Host "    contracts/Groth16Verifier.sol      (real ZK verifier from snarkjs)"
Write-Host "    circuits/build/merkle_proof.wasm   (client-side proof generator)"
Write-Host "    circuits/build/merkle_proof_final.zkey (proving key)"
Write-Host "    circuits/build/verification_key.json  (for backend verification)"
Write-Host ""
Write-Host "  Now update scripts/deploy.ts config for chainId 97:" -ForegroundColor Yellow
Write-Host "    useRealHasher:   true"
Write-Host "    useRealVerifier: true"
Write-Host ""
Write-Host "  Then deploy:" -ForegroundColor Yellow
Write-Host "    npm run deploy:testnet"
Write-Host ""
