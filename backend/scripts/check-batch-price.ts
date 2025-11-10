/**
 * Script to check batch prices from contract
 */

import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

async function checkBatchPrices() {
  const rpcUrl = process.env.RPC_URL;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!rpcUrl || !nftManagerAddress) {
    console.error('❌ Missing RPC_URL or NFT_MANAGER_ADDRESS in .env');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Load ABI
  const abiPath = join(__dirname, '..', 'abis', 'NFTManager.json');
  const fs = require('fs');
  const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
  const abi = abiData.abi || abiData;
  
  const contract = new ethers.Contract(nftManagerAddress, abi, provider);

  try {
    const currentBatchId = await contract.getCurrentBatchId();
    console.log(`\n📊 Current Batch ID: ${currentBatchId.toString()}\n`);

    for (let i = 1; i < Number(currentBatchId); i++) {
      try {
        const batch = await contract.batches(i);
        const mintPriceUSDT = ethers.formatUnits(batch.mintPrice, 18); // BSC USDT has 18 decimals
        
        console.log(`批次 ${i}:`);
        console.log(`  - Batch ID: ${batch.batchId.toString()}`);
        console.log(`  - Max Mintable: ${batch.maxMintable.toString()}`);
        console.log(`  - Current Minted: ${batch.currentMinted.toString()}`);
        console.log(`  - Mint Price (wei): ${batch.mintPrice.toString()}`);
        console.log(`  - Mint Price (USDT): ${mintPriceUSDT}`);
        console.log(`  - Active: ${batch.active}`);
        console.log('');
      } catch (error: any) {
        console.log(`⚠️  Batch ${i} error: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkBatchPrices();

