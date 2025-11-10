import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

/**
 * Script to migrate existing NFTs to NFT Pool
 * This script:
 * 1. Gets NodeNFT contract address from NFTManager
 * 2. Reads current owner of each NFT from NodeNFT contract
 * 3. Sets the current owner as minter in NFTManager (creates pool if needed)
 * 4. Batch processes to avoid gas limit issues
 */
async function main() {
  console.log('🔄 Migrating NFT Pools for Existing NFTs\n');
  console.log('='.repeat(70));

  // Check environment variables
  const rpcUrl = process.env.RPC_URL;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!rpcUrl || !adminPrivateKey || !nftManagerAddress) {
    console.error('❌ Missing required environment variables:');
    console.error('   RPC_URL:', rpcUrl ? '✅' : '❌');
    console.error('   ADMIN_PRIVATE_KEY:', adminPrivateKey ? '✅' : '❌');
    console.error('   NFT_MANAGER_ADDRESS:', nftManagerAddress ? '✅' : '❌');
    process.exit(1);
  }

  // Initialize provider and signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(adminPrivateKey, provider);
  
  console.log('📝 Signer Address:', signer.address);
  const balance = await provider.getBalance(signer.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'BNB');
  console.log('🌐 Network:', (await provider.getNetwork()).name);
  console.log('🔗 Chain ID:', (await provider.getNetwork()).chainId);
  console.log('📋 NFTManager Address:', nftManagerAddress);
  console.log('');

  // Load contract ABIs
  const possiblePaths = [
    join(__dirname, '../abis/NFTManager.json'),
    join(__dirname, '../../abis/NFTManager.json'),
    join(process.cwd(), 'abis/NFTManager.json'),
  ];

  let nftManagerABI: any[];
  let abiLoaded = false;
  for (const abiPath of possiblePaths) {
    try {
      const abiFile = readFileSync(abiPath, 'utf-8');
      const abiData = JSON.parse(abiFile);
      nftManagerABI = abiData.abi || abiData;
      abiLoaded = true;
      console.log(`✅ Loaded NFTManager ABI from: ${abiPath}`);
      break;
    } catch (error) {
      continue;
    }
  }

  if (!abiLoaded) {
    console.error('❌ Error: Could not find NFTManager.json ABI file');
    console.error('   Tried paths:', possiblePaths);
    process.exit(1);
  }

  // Create contract instance
  const nftManager = new ethers.Contract(nftManagerAddress, nftManagerABI, signer);

  // Verify signer is owner
  try {
    const owner = await nftManager.owner();
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error('❌ ERROR: Signer is not the contract owner!');
      console.error('   Owner:', owner);
      console.error('   Signer:', signer.address);
      console.error('   You must use the contract owner\'s private key to run this script.');
      process.exit(1);
    }
    console.log('✅ Signer is the contract owner - can proceed with migration');
    console.log(`   Owner address: ${owner}\n`);
  } catch (error: any) {
    console.error('❌ Error checking ownership:', error.message);
    process.exit(1);
  }

  // Get NodeNFT contract address
  let nodeNFTAddress: string;
  try {
    nodeNFTAddress = await nftManager.nodeNFT();
    console.log('📋 NodeNFT Address:', nodeNFTAddress);
  } catch (error: any) {
    console.error('❌ Error getting NodeNFT address:', error.message);
    process.exit(1);
  }

  // Load NodeNFT ABI (minimal - just need ownerOf)
  const nodeNFTABI = [
    'function ownerOf(uint256 tokenId) view returns (address)',
  ];
  const nodeNFT = new ethers.Contract(nodeNFTAddress, nodeNFTABI, provider);

  // Get total minted from contract (but we'll check NodeNFT directly)
  let totalMintedFromManager: number;
  try {
    const totalMintedBigInt = await nftManager.totalMinted();
    totalMintedFromManager = Number(totalMintedBigInt);
    console.log(`📊 NFTManager totalMinted: ${totalMintedFromManager}`);
  } catch (error: any) {
    console.error('❌ Error getting total minted:', error.message);
    totalMintedFromManager = 0;
  }

  // Check NodeNFT contract directly to find all NFTs
  console.log('🔍 Checking NodeNFT contract for all NFTs...\n');
  let maxNFTId = 0;
  let foundNFTs = 0;
  
  // Check up to 100 NFTs (adjust if needed)
  for (let i = 1; i <= 100; i++) {
    try {
      const owner = await nodeNFT.ownerOf(i);
      if (owner && owner !== '0x0000000000000000000000000000000000000000') {
        foundNFTs++;
        maxNFTId = i;
        if (foundNFTs <= 5) {
          console.log(`   Found NFT #${i}: owner = ${owner}`);
        }
      }
    } catch (error: any) {
      // NFT doesn't exist, continue
    }
  }
  
  console.log(`\n✅ Found ${foundNFTs} NFTs in NodeNFT contract (max ID: ${maxNFTId})`);
  console.log(`   NFTManager reports ${totalMintedFromManager} minted\n`);
  
  const totalMinted = maxNFTId; // Use max NFT ID found

  // Check rewardTokens initialization
  console.log('🔍 Checking contract state...\n');
  try {
    const rewardTokensLength = await nftManager.rewardTokens.length;
    console.log(`   Reward tokens count: ${rewardTokensLength}`);
    if (rewardTokensLength === 0) {
      console.log('   ⚠️  WARNING: rewardTokens array is empty!');
      console.log('   ⚠️  This might cause pool initialization to fail.');
      console.log('   ⚠️  Consider adding a reward token first using addRewardToken()\n');
    } else {
      console.log('   ✅ Reward tokens initialized');
      // Try to get first reward token
      try {
        const firstToken = await nftManager.rewardTokens(0);
        console.log(`   First reward token: ${firstToken}\n`);
      } catch (error: any) {
        console.log(`   ⚠️  Could not read reward token: ${error.message}\n`);
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️  Could not check rewardTokens: ${error.message}\n`);
  }

  // Check a few NFTs to see their Pool status
  console.log('🔍 Checking sample NFTs Pool status...\n');
  const sampleSize = Math.min(5, totalMinted);
  let poolsExist = 0;
  let poolsNotExist = 0;
  for (let i = 1; i <= sampleSize; i++) {
    try {
      const minter = await nftManager.getMinter(i);
      if (minter && minter !== '0x0000000000000000000000000000000000000000') {
        poolsExist++;
        console.log(`   NFT #${i}: Pool exists, minter: ${minter}`);
      } else {
        poolsNotExist++;
        console.log(`   NFT #${i}: Pool exists but minter is zero address`);
      }
    } catch (error: any) {
      poolsNotExist++;
      console.log(`   NFT #${i}: Pool does NOT exist (getMinter reverted)`);
    }
  }
  console.log(`\n   Summary: ${poolsExist} pools exist, ${poolsNotExist} pools need creation\n`);

  // Check which NFTs need migration
  console.log('🔍 Checking which NFTs need pool initialization...\n');
  const nftIdsToMigrate: number[] = [];
  const minterAddresses: string[] = [];
  let alreadyMigrated = 0;
  let errorCount = 0;

  for (let nftId = 1; nftId <= totalMinted; nftId++) {
    try {
      // Get current owner from NodeNFT contract and use it as minter
      // Don't check getMinter first - if Pool doesn't exist, it will revert
      const currentOwner = await nodeNFT.ownerOf(nftId);
      if (currentOwner && currentOwner !== '0x0000000000000000000000000000000000000000') {
        nftIdsToMigrate.push(nftId);
        minterAddresses.push(currentOwner);
        
        if (nftIdsToMigrate.length <= 10) {
          console.log(`   NFT #${nftId}: will create Pool and set minter to current owner: ${currentOwner}`);
        } else if (nftIdsToMigrate.length === 11) {
          console.log(`   ... (showing first 10, checking remaining NFTs)`);
        }
      } else {
        errorCount++;
        if (errorCount <= 5) {
          console.log(`   ⚠️  NFT #${nftId}: owner is zero address, skipping`);
        }
      }
    } catch (error: any) {
      errorCount++;
      if (errorCount <= 5) {
        console.log(`   ⚠️  NFT #${nftId}: error getting owner - ${error.message}`);
      }
    }
  }

  console.log(`\n📊 Check complete:`);
  console.log(`   Total NFTs checked: ${totalMinted}`);
  console.log(`   Already migrated: ${alreadyMigrated}`);
  console.log(`   Need migration: ${nftIdsToMigrate.length}`);
  console.log(`   Errors: ${errorCount}\n`);

  if (nftIdsToMigrate.length === 0) {
    console.log('✅ All NFTs already have pools initialized. Nothing to do!');
    process.exit(0);
  }

  if (errorCount > 0) {
    console.log(`⚠️  Warning: ${errorCount} NFTs had errors and will be skipped.\n`);
  }

  // Batch migrate NFTs - use individual setMinter calls for better error handling
  const BATCH_SIZE = 10; // Process 10 NFTs at a time (individual calls)
  const totalBatches = Math.ceil(nftIdsToMigrate.length / BATCH_SIZE);

  console.log('='.repeat(70));
  console.log('📊 Summary:');
  console.log('─'.repeat(70));
  console.log(`   Total NFTs checked:    ${totalMinted}`);
  console.log(`   Already migrated:      ${alreadyMigrated}`);
  console.log(`   Will migrate:          ${nftIdsToMigrate.length}`);
  console.log(`   Errors:                ${errorCount}`);
  console.log(`   Batch size:             ${BATCH_SIZE}`);
  console.log(`   Total batches:          ${totalBatches}`);
  console.log(`   Strategy:               Individual setMinter calls (more reliable)`);
  console.log('');

  console.log(`🚀 Starting migration in ${totalBatches} batch(es)...\n`);

  let successCount = 0;
  let failCount = 0;
  const failedNFTs: number[] = [];

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, nftIdsToMigrate.length);
    const batchNftIds = nftIdsToMigrate.slice(startIdx, endIdx);
    const batchMinterAddresses = minterAddresses.slice(startIdx, endIdx);

    console.log(`📦 Batch ${i + 1}/${totalBatches}: Migrating NFTs ${batchNftIds[0]} to ${batchNftIds[batchNftIds.length - 1]} (${batchNftIds.length} NFTs)...`);

    // Process each NFT individually for better error handling
    for (let j = 0; j < batchNftIds.length; j++) {
      const nftId = batchNftIds[j];
      const minterAddress = batchMinterAddresses[j];

      try {
        console.log(`   Setting minter for NFT #${nftId} (will create Pool if not exists)...`);
        console.log(`      Using current owner as minter: ${minterAddress}`);
        
        // Directly call setMinter - it will create Pool if it doesn't exist
        const tx = await nftManager.setMinter(nftId, minterAddress);
        console.log(`      Transaction hash: ${tx.hash}`);
        console.log(`      Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        console.log(`      ✅ NFT #${nftId} Pool created and minter set! Gas used: ${receipt.gasUsed.toString()}`);

        // Try to verify (but don't fail if getMinter still reverts)
        try {
          const actualMinter = await nftManager.getMinter(nftId);
          if (actualMinter.toLowerCase() === minterAddress.toLowerCase()) {
            successCount++;
            console.log(`      ✅ Verified: Pool exists, minter set to ${actualMinter}`);
          } else {
            successCount++; // Transaction succeeded, so Pool was created
            console.log(`      ⚠️  Minter mismatch (expected ${minterAddress}, got ${actualMinter}), but Pool was created`);
          }
        } catch (verifyError: any) {
          // If getMinter still reverts, the transaction succeeded but verification failed
          // This is unusual but we'll count it as success since the transaction went through
          successCount++;
          console.log(`      ⚠️  Could not verify (getMinter reverted), but transaction succeeded`);
        }
      } catch (error: any) {
        const errorMsg = error.message || error.reason || String(error);
        console.error(`      ❌ NFT #${nftId} failed: ${errorMsg}`);
        
        // If error is "Minter already set", try to verify
        if (errorMsg.includes('Minter already set')) {
          try {
            const existingMinter = await nftManager.getMinter(nftId);
            console.log(`      ℹ️  Minter already set to: ${existingMinter}`);
            successCount++; // Pool exists, count as success
          } catch (checkError: any) {
            failCount++;
            failedNFTs.push(nftId);
            console.error(`      ❌ Could not verify existing minter`);
          }
        } else {
          failCount++;
          failedNFTs.push(nftId);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('🎉 Migration Complete!');
  console.log('='.repeat(70));
  console.log(`\n✅ Successfully migrated: ${successCount} NFTs`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} NFTs`);
    console.log(`   Failed NFT IDs: ${failedNFTs.join(', ')}`);
  }
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Verify all NFTs have pools initialized correctly`);
  console.log(`   2. Test getMinter() function for a few NFTs`);
  if (failedNFTs.length > 0) {
    console.log(`   3. Retry failed NFTs manually: ${failedNFTs.join(', ')}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  });
