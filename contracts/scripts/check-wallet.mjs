import { ethers } from 'ethers';

const RPC = 'https://bsc-testnet.nodereal.io/v1/c282d0f1f2b74678b587e87980d22d5e';
const provider = new ethers.JsonRpcProvider(RPC);
const FACTORY  = '0x7D5eb77Bc8a3f2aDE845c450b9d97bfD20DDEda0';
const EOA      = '0xe8B3555A33420A389709e436c02871602EAA7e5c';
const USDC_REAL = '0x64544969ed7ebf5f083679233325356ebe738930';
const USDC_MOCK = '0xC1d58E84ebFdCd4C29674C805a6CF53a21dC9D33';

const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
const factory = new ethers.Contract(FACTORY, ['function getAddress(address owner, uint256 salt) view returns (address)'], provider);
const real = new ethers.Contract(USDC_REAL, ERC20, provider);
const mock = new ethers.Contract(USDC_MOCK, ERC20, provider);

const sa   = await factory.getFunction('getAddress(address,uint256)')(EOA, 0n);
const code = await provider.getCode(sa);
const decR = Number(await real.decimals());
const decM = Number(await mock.decimals());

console.log('EOA        :', EOA);
console.log('SmartAcct  :', sa);
console.log('SA deployed:', code !== '0x');
console.log('');
console.log('Real USDC (' + decR + ' dec):');
console.log('  EOA bal:', ethers.formatUnits(await real.balanceOf(EOA), decR));
console.log('  SA  bal:', ethers.formatUnits(await real.balanceOf(sa),  decR));
console.log('Mock USDC (' + decM + ' dec):');
console.log('  EOA bal:', ethers.formatUnits(await mock.balanceOf(EOA), decM));
console.log('  SA  bal:', ethers.formatUnits(await mock.balanceOf(sa),  decM));
console.log('');
console.log('EOA BNB :', ethers.formatEther(await provider.getBalance(EOA)));
console.log('SA  BNB :', ethers.formatEther(await provider.getBalance(sa)));

// Check EIP-2612 permit support
try {
  const permitCheck = new ethers.Contract(USDC_REAL, ['function DOMAIN_SEPARATOR() view returns (bytes32)'], provider);
  await permitCheck.DOMAIN_SEPARATOR();
  console.log('\nEIP-2612 permit: SUPPORTED');
} catch (_) {
  console.log('\nEIP-2612 permit: NOT supported');
}
