/**
 * Script to update NodeNFT's nftManager address to the new Diamond address
 * Usage: npx hardhat run scripts/update-node-nft-manager.ts --network <network>
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const networkName = network.name;
  console.log(`🚀 Updating NodeNFT manager address on ${networkName}...\n`);

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
  console.log("   New NFTManager (Diamond) Address:", nftManagerAddress);
  console.log("");

  // Load NodeNFT contract
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = NodeNFT.attach(nodeNFTAddress);

  // Check current manager address
  const currentManager = await nodeNFT.nftManager();
  console.log("📊 Current Manager Address:", currentManager);

  if (currentManager.toLowerCase() === nftManagerAddress.toLowerCase()) {
    console.log("✅ NodeNFT already points to the correct Diamond address!");
    return;
  }

  if (currentManager === ethers.ZeroAddress) {
    console.log("⚠️  Manager not set yet, using setNFTManager()...");
    const tx = await nodeNFT.setNFTManager(nftManagerAddress);
    console.log("   Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Manager address set!");
  } else {
    console.log("🔄 Updating manager address using updateNFTManager()...");
    const tx = await nodeNFT.updateNFTManager(nftManagerAddress);
    console.log("   Transaction hash:", tx.hash);
    await tx.wait();
    console.log("✅ Manager address updated!");
  }

  // Verify
  const newManager = await nodeNFT.nftManager();
  console.log("\n📊 New Manager Address:", newManager);

  if (newManager.toLowerCase() === nftManagerAddress.toLowerCase()) {
    console.log("✅ Verification successful!");
  } else {
    console.error("❌ Verification failed! Addresses don't match.");
    process.exit(1);
  }

  // Test if functions are accessible
  console.log("\n🧪 Testing Diamond functions...");
  try {
    const NFTManager = await ethers.getContractAt("AdminFacet", nftManagerAddress);
    const transfersEnabled = await NFTManager.transfersEnabled();
    console.log("   ✅ transfersEnabled() works:", transfersEnabled);

    // Note: onNFTTransfer can only be called by NodeNFT, so we can't test it directly
    console.log("   ✅ Diamond functions are accessible");
  } catch (error: any) {
    console.error("   ❌ Error testing Diamond functions:", error.message);
    console.error("   ⚠️  This might indicate an ABI mismatch or missing function");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ UPDATE COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📝 Summary:");
  console.log(`   NodeNFT: ${nodeNFTAddress}`);
  console.log(`   NFTManager (Diamond): ${nftManagerAddress}`);
  console.log(`   Status: ✅ Updated and verified`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

