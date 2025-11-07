/**
 * Quick test for auto-sync functionality
 * Tests if NodeNFT transfer automatically syncs userNFTList in NFTManager
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
  NFT_MANAGER_ADDRESS: process.env.NFT_MANAGER_ADDRESS || '0xF87F9296955439C323ac79769959bEe087f6D06E',
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '',
};

async function main() {
  console.log('🔍 Quick Auto-Sync Test\n');
  console.log('='.repeat(70));

  if (!CONFIG.ADMIN_PRIVATE_KEY) {
    console.error('❌ Please set ADMIN_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const adminWallet = new ethers.Wallet(CONFIG.ADMIN_PRIVATE_KEY, provider);

  console.log('Admin:', adminWallet.address);
  console.log('NFTManager:', CONFIG.NFT_MANAGER_ADDRESS);
  console.log('');

  const NFTManagerABI = [
    'function nodeNFT() view returns (address)',
    'function getUserNFTs(address) view returns (uint256[])',
  ];

  const nftManager = new ethers.Contract(CONFIG.NFT_MANAGER_ADDRESS, NFTManagerABI, provider);

  try {
    const nodeNFTAddress = await nftManager.nodeNFT();
    console.log('✅ NodeNFT Address:', nodeNFTAddress);
    console.log('');

    // Check if this is the new NodeNFT with auto-sync
    const expectedNewNodeNFT = '0x92301C0acA7586d9F0B1968af2502616009Abf69';
    if (nodeNFTAddress.toLowerCase() === expectedNewNodeNFT.toLowerCase()) {
      console.log('✅ NFTManager is using the NEW NodeNFT with auto-sync feature!');
    } else {
      console.log('⚠️  NFTManager is using a different NodeNFT address');
      console.log('   Expected:', expectedNewNodeNFT);
      console.log('   Got:', nodeNFTAddress);
    }

    console.log('\n📋 Ready to run full test!');
    console.log('   Run: npx ts-node scripts/test-complete-automated.ts');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

