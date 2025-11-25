/**
 * Diagnostic script to check why batches API is failing
 * Usage: ts-node scripts/diagnose-batches-error.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Diagnosing Batches API Error...\n');

  // Check 1: Environment variables
  console.log('1️⃣  Checking environment variables...');
  const rpcUrl = process.env.RPC_URL;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

  console.log(`   RPC_URL: ${rpcUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   NFT_MANAGER_ADDRESS: ${nftManagerAddress ? `✅ ${nftManagerAddress}` : '❌ Missing'}`);
  console.log(`   ADMIN_PRIVATE_KEY: ${adminPrivateKey ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!rpcUrl || !nftManagerAddress) {
    console.error('❌ Missing required environment variables!');
    process.exit(1);
  }

  // Check 2: RPC connection
  console.log('2️⃣  Testing RPC connection...');
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ RPC connected (block: ${blockNumber})\n`);
  } catch (error: any) {
    console.error(`   ❌ RPC connection failed: ${error.message}\n`);
    process.exit(1);
  }

  // Check 3: Contract exists
  console.log('3️⃣  Checking contract existence...');
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const code = await provider.getCode(nftManagerAddress);
    if (code === '0x') {
      console.error(`   ❌ Contract does not exist at ${nftManagerAddress}\n`);
      process.exit(1);
    }
    console.log(`   ✅ Contract exists\n`);
  } catch (error: any) {
    console.error(`   ❌ Error checking contract: ${error.message}\n`);
    process.exit(1);
  }

  // Check 4: Load ABI
  console.log('4️⃣  Checking ABI file...');
  try {
    const fs = require('fs');
    const path = require('path');
    const abiPath = path.join(__dirname, '..', 'abis', 'NFTManager.json');
    const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
    const abi = abiData.abi || abiData;
    console.log(`   ✅ ABI loaded (${abi.length} items)\n`);
  } catch (error: any) {
    console.error(`   ❌ ABI file not found: ${error.message}\n`);
    process.exit(1);
  }

  // Check 5: Test contract functions
  console.log('5️⃣  Testing contract functions...');
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const fs = require('fs');
    const path = require('path');
    const abiPath = path.join(__dirname, '..', 'abis', 'NFTManager.json');
    const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
    const abi = abiData.abi || abiData;
    
    const contract = new ethers.Contract(nftManagerAddress, abi, provider);

    // Test getCurrentBatchId
    try {
      const currentBatchId = await contract.getCurrentBatchId();
      console.log(`   ✅ getCurrentBatchId(): ${currentBatchId.toString()}\n`);
    } catch (error: any) {
      console.error(`   ❌ getCurrentBatchId() failed: ${error.message}\n`);
      console.error(`   This is likely the cause of the error!\n`);
    }

    // Test getActiveBatch
    try {
      const activeBatch = await contract.getActiveBatch();
      console.log(`   ✅ getActiveBatch(): ${activeBatch.toString()}\n`);
    } catch (error: any) {
      console.error(`   ❌ getActiveBatch() failed: ${error.message}\n`);
    }

    // Test batches(1)
    try {
      const batch1 = await contract.batches(1);
      console.log(`   ✅ batches(1):`, {
        batchId: batch1.batchId?.toString() || 'N/A',
        maxMintable: batch1.maxMintable?.toString() || 'N/A',
        active: batch1.active,
      });
      console.log('');
    } catch (error: any) {
      console.error(`   ❌ batches(1) failed: ${error.message}\n`);
      console.error(`   This might be OK if batch 1 doesn't exist\n`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error testing contract: ${error.message}\n`);
  }

  // Check 6: Database connection
  console.log('6️⃣  Testing database connection...');
  try {
    const batchCount = await prisma.batch.count();
    console.log(`   ✅ Database connected (${batchCount} batches in DB)\n`);
  } catch (error: any) {
    console.error(`   ❌ Database connection failed: ${error.message}\n`);
  }

  console.log('✅ Diagnosis complete!');
  console.log('\n💡 If all checks passed, the error might be:');
  console.log('   1. Contract service not initialized properly');
  console.log('   2. ABI mismatch (function not found)');
  console.log('   3. Network/RPC timeout');
  console.log('   4. Contract address mismatch');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

