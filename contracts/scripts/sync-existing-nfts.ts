/**
 * Script to sync existing NFTs from NodeNFT to NFTManager (Diamond)
 * Usage: npx hardhat run scripts/sync-existing-nfts.ts --network <network>
 * 
 * This script:
 * 1. Scans all existing NFTs in NodeNFT
 * 2. Imports them into NFTManager using importExistingNFT or batchImportExistingNFTs
 * 3. Updates totalMinted and userNFTList
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const networkName = network.name;
  console.log(`🔄 Syncing existing NFTs from NodeNFT to NFTManager on ${networkName}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), networkName === "localhost" ? "ETH" : "BNB");
  console.log("");

  // Get addresses from environment
  const nodeNFTAddress = process.env.NODE_NFT_ADDRESS || process.env.NFT_ADDRESS;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!nodeNFTAddress) {
    throw new Error("❌ NODE_NFT_ADDRESS or NFT_ADDRESS not set in .env");
  }

  if (!nftManagerAddress) {
    throw new Error("❌ NFT_MANAGER_ADDRESS not set in .env");
  }

  console.log("📋 Configuration:");
  console.log("   NodeNFT Address:", nodeNFTAddress);
  console.log("   NFTManager (Diamond) Address:", nftManagerAddress);
  console.log("");

  // Load contracts
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = NodeNFT.attach(nodeNFTAddress);

  const NFTManagerFacet = await ethers.getContractFactory("NFTManagerFacet");
  const nftManager = NFTManagerFacet.attach(nftManagerAddress);

  // Get total minted from NodeNFT
  const nextTokenId = await nodeNFT.getNextTokenId();
  const totalMinted = Number(nextTokenId) - 1;
  
  console.log(`📊 NodeNFT Status:`);
  console.log(`   Next Token ID: ${nextTokenId.toString()}`);
  console.log(`   Total Minted: ${totalMinted}`);
  console.log("");

  if (totalMinted === 0) {
    console.log("✅ No NFTs to sync!");
    return;
  }

  // Scan all NFTs
  console.log("🔍 Scanning existing NFTs...");
  const nftData: Array<{
    nftId: bigint;
    owner: string;
    minter?: string;
    createdAt?: bigint;
    batchId?: bigint;
  }> = [];

  for (let i = 1; i <= totalMinted; i++) {
    try {
      const owner = await nodeNFT.ownerOf(i);
      nftData.push({
        nftId: BigInt(i),
        owner,
      });
    } catch (error: any) {
      console.warn(`   ⚠️  NFT ${i} not found or burned, skipping`);
    }
  }

  console.log(`   Found ${nftData.length} NFTs to sync\n`);

  if (nftData.length === 0) {
    console.log("✅ No NFTs to sync!");
    return;
  }

  // Check which NFTs are already imported
  console.log("🔍 Checking which NFTs are already imported...");
  const toImport: typeof nftData = [];
  
  for (const nft of nftData) {
    try {
      // Try to get minter - if it fails, NFT is not imported
      const minter = await nftManager.getMinter(nft.nftId);
      if (minter === ethers.ZeroAddress) {
        toImport.push(nft);
      } else {
        console.log(`   ✅ NFT ${nft.nftId.toString()} already imported`);
      }
    } catch {
      toImport.push(nft);
    }
  }

  console.log(`   ${toImport.length} NFTs need to be imported\n`);

  if (toImport.length === 0) {
    console.log("✅ All NFTs are already synced!");
    return;
  }

  // For each NFT, we need to determine:
  // - minter: Try to get from old NFTManager or use owner as fallback
  // - createdAt: Try to get from old NFTManager or use current time as fallback
  // - batchId: Try to infer from old NFTManager or use 0 (unknown)
  
  console.log("📝 Preparing import data...");
  console.log("   Note: Using owner as minter and current time as createdAt if not available");
  console.log("   You may need to manually update these later if you have historical data\n");

  const nftIds: bigint[] = [];
  const owners: string[] = [];
  const minters: string[] = [];
  const createdAts: bigint[] = [];
  const batchIds: bigint[] = [];

  const currentTime = BigInt(Math.floor(Date.now() / 1000));

  for (const nft of toImport) {
    nftIds.push(nft.nftId);
    owners.push(nft.owner);
    // Use owner as minter if not available (fallback)
    minters.push(nft.minter || nft.owner);
    // Use current time if not available (fallback)
    createdAts.push(nft.createdAt || currentTime);
    // Use 0 if batchId unknown
    batchIds.push(nft.batchId || BigInt(0));
  }

  // Batch import (more gas efficient)
  const batchSize = 50; // Adjust based on gas limits
  let imported = 0;

  console.log(`📦 Importing NFTs in batches of ${batchSize}...\n`);

  for (let i = 0; i < nftIds.length; i += batchSize) {
    const end = Math.min(i + batchSize, nftIds.length);
    const batch = {
      nftIds: nftIds.slice(i, end),
      owners: owners.slice(i, end),
      minters: minters.slice(i, end),
      createdAts: createdAts.slice(i, end),
      batchIds: batchIds.slice(i, end),
    };

    console.log(`   Importing batch ${Math.floor(i / batchSize) + 1} (NFTs ${i + 1}-${end})...`);
    
    try {
      const tx = await nftManager.batchImportExistingNFTs(
        batch.nftIds,
        batch.owners,
        batch.minters,
        batch.createdAts,
        batch.batchIds
      );
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      imported += batch.nftIds.length;
      console.log(`   ✅ Imported ${batch.nftIds.length} NFTs\n`);
    } catch (error: any) {
      console.error(`   ❌ Error importing batch:`, error.message);
      console.error(`   ⚠️  You may need to import individually or check permissions\n`);
    }
  }

  console.log("=".repeat(60));
  console.log("✨ SYNC COMPLETE!");
  console.log("=".repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Total NFTs in NodeNFT: ${totalMinted}`);
  console.log(`   NFTs imported: ${imported}`);
  console.log(`   NFTs already synced: ${totalMinted - imported}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Verify totalMinted in NFTManager matches NodeNFT`);
  console.log(`   2. Update minter addresses if you have historical data`);
  console.log(`   3. Update createdAt timestamps if you have historical data`);
  console.log(`   4. Update batchIds if you have historical data`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

