import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
  NFT_MANAGER_ADDRESS: process.env.NFT_MANAGER_ADDRESS || '0xF87F9296955439C323ac79769959bEe087f6D06E',
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || '',
};

async function main() {
  console.log('🔍 Checking NFTManager Contract Initialization\n');
  console.log('='.repeat(70));

  if (!CONFIG.ADMIN_PRIVATE_KEY || CONFIG.ADMIN_PRIVATE_KEY.includes('your')) {
    console.error('❌ ERROR: ADMIN_PRIVATE_KEY not set in .env file');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const adminWallet = new ethers.Wallet(CONFIG.ADMIN_PRIVATE_KEY, provider);

  const MANAGER_ABI = [
    'function owner() view returns (address)',
    'function currentBatchId() view returns (uint256)',
    'function whitelistCount() view returns (uint256)',
    'function transfersEnabled() view returns (bool)',
    'function oracle() view returns (address)',
    'function treasury() view returns (address)',
    'function nodeNFT() view returns (address)',
    'function eclvToken() view returns (address)',
    'function usdtToken() view returns (address)',
  ];

  const manager = new ethers.Contract(CONFIG.NFT_MANAGER_ADDRESS, MANAGER_ABI, provider);

  console.log(`Contract Address: ${CONFIG.NFT_MANAGER_ADDRESS}`);
  console.log(`Admin Address: ${adminWallet.address}\n`);

  let isInitialized = true;
  const errors: string[] = [];

  // Check owner
  try {
    const owner = await manager.owner();
    console.log(`✅ Owner: ${owner}`);
    console.log(`   Is Admin Owner: ${owner.toLowerCase() === adminWallet.address.toLowerCase()}\n`);
    
    if (owner === ethers.ZeroAddress) {
      isInitialized = false;
      errors.push('Owner is zero address - contract not initialized');
    }
  } catch (error: any) {
    isInitialized = false;
    errors.push(`Cannot read owner: ${error.message}`);
    console.log(`❌ Owner: Cannot read (contract may not be initialized)\n`);
  }

  // Check currentBatchId
  try {
    const batchId = await manager.currentBatchId();
    console.log(`✅ Current Batch ID: ${batchId.toString()}`);
    if (batchId === 0n) {
      console.log(`   ⚠️  Warning: Batch ID is 0 (should be >= 1 if initialized)`);
    }
    console.log('');
  } catch (error: any) {
    isInitialized = false;
    errors.push(`Cannot read currentBatchId: ${error.message}`);
    console.log(`❌ Current Batch ID: Cannot read\n`);
  }

  // Check other initialized values
  try {
    const whitelistCount = await manager.whitelistCount();
    console.log(`✅ Whitelist Count: ${whitelistCount.toString()}`);
  } catch (error: any) {
    console.log(`❌ Whitelist Count: Cannot read`);
  }

  try {
    const transfersEnabled = await manager.transfersEnabled();
    console.log(`✅ Transfers Enabled: ${transfersEnabled}`);
  } catch (error: any) {
    console.log(`❌ Transfers Enabled: Cannot read`);
  }

  try {
    const oracle = await manager.oracle();
    console.log(`✅ Oracle: ${oracle}`);
  } catch (error: any) {
    console.log(`❌ Oracle: Cannot read`);
  }

  try {
    const treasury = await manager.treasury();
    console.log(`✅ Treasury: ${treasury}`);
  } catch (error: any) {
    console.log(`❌ Treasury: Cannot read`);
  }

  try {
    const nodeNFT = await manager.nodeNFT();
    console.log(`✅ NodeNFT: ${nodeNFT}`);
  } catch (error: any) {
    console.log(`❌ NodeNFT: Cannot read`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 Summary');
  console.log('='.repeat(70));

  if (isInitialized && errors.length === 0) {
    console.log('✅ Contract appears to be initialized');
    console.log('\n💡 If you are still getting errors, the issue might be:');
    console.log('   1. Proxy/Implementation mismatch');
    console.log('   2. ABI mismatch');
    console.log('   3. Network/RPC issues');
  } else {
    console.log('❌ Contract may not be properly initialized');
    console.log('\nErrors:');
    errors.forEach(err => console.log(`   - ${err}`));
    console.log('\n💡 Solution:');
    console.log('   The contract needs to be initialized via the initialize() function.');
    console.log('   This should have been done during deployment.');
    console.log('   If not, you may need to re-deploy or check the deployment script.');
  }

  console.log('');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

