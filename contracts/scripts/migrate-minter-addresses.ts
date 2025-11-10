import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Migration script to set minter addresses for existing NFTs
 * This script:
 * 1. Checks which NFTs don't have minter set yet
 * 2. Sets the contract owner as minter for all NFTs that need it
 * 3. Batch sets minter addresses using batchSetMinters
 */
async function main() {
  console.log("🔄 Migrating Minter Addresses for Existing NFTs\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get contract address
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || "0xF87F9296955439C323ac79769959bEe087f6D06E";
  console.log("NFTManager Address:", PROXY_ADDRESS);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("");

  // Load contract
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = await NFTManager.attach(PROXY_ADDRESS);

  // Get NodeNFT contract address
  let nodeNFTAddress: string;
  try {
    nodeNFTAddress = await manager.nodeNFT();
    console.log("NodeNFT Address:", nodeNFTAddress);
  } catch (error: any) {
    console.error("❌ Error getting NodeNFT address:", error.message);
    process.exit(1);
  }

  // Load NodeNFT contract to check if NFTs exist
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.attach(nodeNFTAddress);

  // Get owner address (will be used as minter for all NFTs)
  let ownerAddress: string;
  try {
    ownerAddress = await manager.owner();
    console.log("Contract Owner:", ownerAddress);
    if (ownerAddress.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("\n❌ ERROR: Deployer is not the contract owner!");
      console.error("   Only the owner can set minter addresses.");
      console.error("   Please use the owner's private key to run this script.");
      process.exit(1);
    }
    console.log("✅ Deployer is the contract owner - can proceed with migration");
    console.log("📝 Will use owner address as minter for all NFTs\n");
  } catch (error: any) {
    console.error("❌ Error checking ownership:", error.message);
    process.exit(1);
  }

  // Get total minted count
  let totalMinted: bigint;
  try {
    totalMinted = await manager.totalMinted();
    console.log(`📊 Total NFTs minted: ${totalMinted.toString()}\n`);
  } catch (error: any) {
    console.error("❌ Error getting total minted:", error.message);
    process.exit(1);
  }

  if (totalMinted === 0n) {
    console.log("ℹ️  No NFTs have been minted yet. Nothing to migrate.");
    process.exit(0);
  }

  // First, check which NFTs need minter addresses set by directly querying the contract
  console.log("🔍 Checking which NFTs need minter addresses set...\n");
  const nftIdsToSet: bigint[] = [];
  let alreadySetCount = 0;
  let errorCount = 0;

  // Iterate through all minted NFTs (from 1 to totalMinted)
  const totalMintedNum = Number(totalMinted);
  for (let i = 1; i <= totalMintedNum; i++) {
    const nftId = BigInt(i);
    try {
      // First check if NFT exists in NodeNFT contract
      let nftExists = false;
      try {
        await nodeNFT.ownerOf(nftId);
        nftExists = true;
      } catch (nftError: any) {
        // NFT doesn't exist in NodeNFT contract, skip it
        errorCount++;
        if (errorCount <= 5) {
          console.log(`   ⚠️  NFT #${nftId.toString()}: does not exist in NodeNFT contract, skipping`);
        }
        continue;
      }

      // NFT exists, now check minter
      // Try to get minter address
      // If getMinter reverts, the pool may not be initialized, but we'll still try to set minter
      let currentMinter: string;
      try {
        currentMinter = await manager.getMinter(nftId);
      } catch (minterError: any) {
        // Pool not initialized, but NFT exists, so we should set minter
        nftIdsToSet.push(nftId);
        if (nftIdsToSet.length <= 10) {
          console.log(`   NFT #${nftId.toString()}: exists but pool not initialized, will set minter`);
        } else if (nftIdsToSet.length === 11) {
          console.log(`   ... (showing first 10, checking remaining NFTs)`);
        }
        continue;
      }
      
      // Check if minter is zero address (not set)
      if (currentMinter === "0x0000000000000000000000000000000000000000") {
        nftIdsToSet.push(nftId);
        if (nftIdsToSet.length <= 10) {
          console.log(`   NFT #${nftId.toString()}: needs minter set`);
        } else if (nftIdsToSet.length === 11) {
          console.log(`   ... (showing first 10, checking remaining NFTs)`);
        }
      } else {
        alreadySetCount++;
      }
    } catch (error: any) {
      // Unexpected error
      errorCount++;
      if (errorCount <= 5) {
        const errorMsg = error.message || String(error);
        console.log(`   ⚠️  NFT #${nftId.toString()}: error - ${errorMsg}`);
      }
      continue; // Skip this NFT and continue with next
    }
  }

  console.log(`\n📊 Check complete:`);
  console.log(`   Total NFTs checked: ${totalMintedNum}`);
  console.log(`   Already have minter: ${alreadySetCount}`);
  console.log(`   Need minter set: ${nftIdsToSet.length}`);
  console.log(`   Errors: ${errorCount}\n`);

  if (nftIdsToSet.length === 0) {
    console.log("✅ All NFTs already have minter addresses set. Nothing to do!");
    process.exit(0);
  }

  // Use owner address as minter for all NFTs that need it
  const minterAddressesToSet: string[] = nftIdsToSet.map(() => ownerAddress);

  console.log("=".repeat(70));
  console.log("📊 Summary:");
  console.log("─".repeat(70));
  console.log(`   Total NFTs checked:    ${totalMintedNum}`);
  console.log(`   Already have minter:   ${alreadySetCount}`);
  console.log(`   Will set minter:       ${nftIdsToSet.length}`);
  console.log(`   Minter address:        ${ownerAddress}`);
  console.log("");

  // Batch set minter addresses
  // Process in batches to avoid gas limit issues
  const BATCH_SIZE = 50; // Process 50 NFTs at a time
  const totalBatches = Math.ceil(nftIdsToSet.length / BATCH_SIZE);

  console.log(`🚀 Setting minter addresses in ${totalBatches} batch(es)...\n`);

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, nftIdsToSet.length);
    const batchNftIds = nftIdsToSet.slice(startIdx, endIdx);
    const batchMinterAddresses = minterAddressesToSet.slice(startIdx, endIdx);

    console.log(`📦 Batch ${i + 1}/${totalBatches}: Setting minter for NFTs ${batchNftIds[0]} to ${batchNftIds[batchNftIds.length - 1]} (${batchNftIds.length} NFTs)...`);

    try {
      const tx = await manager.batchSetMinters(batchNftIds, batchMinterAddresses);
      console.log(`   Transaction hash: ${tx.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Batch ${i + 1} completed! Gas used: ${receipt.gasUsed.toString()}\n`);

      // Verify the minter addresses were set correctly
      console.log(`   🔍 Verifying minter addresses...`);
      let verifiedCount = 0;
      for (let j = 0; j < batchNftIds.length; j++) {
        const nftId = batchNftIds[j];
        const expectedMinter = batchMinterAddresses[j];
        try {
          const actualMinter = await manager.getMinter(nftId);
          if (actualMinter.toLowerCase() === expectedMinter.toLowerCase()) {
            verifiedCount++;
          } else {
            console.log(`   ⚠️  NFT #${nftId.toString()}: verification failed (expected ${expectedMinter}, got ${actualMinter})`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  NFT #${nftId.toString()}: verification error - ${error.message}`);
        }
      }
      console.log(`   ✅ Verified ${verifiedCount}/${batchNftIds.length} NFTs\n`);
    } catch (error: any) {
      console.error(`   ❌ Batch ${i + 1} failed:`, error.message);
      console.error(`   This batch will need to be retried manually.`);
      console.error(`   NFT IDs: ${batchNftIds.map(id => id.toString()).join(", ")}\n`);
    }
  }

  console.log("=".repeat(70));
  console.log("🎉 Migration Complete!");
  console.log("=".repeat(70));
  console.log(`\n✅ Successfully set minter addresses for ${nftIdsToSet.length} NFTs`);
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Verify all NFTs have minter addresses set correctly`);
  console.log(`   2. Test getMinter() function for a few NFTs`);
  console.log(`   3. Update any documentation if needed\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  });

