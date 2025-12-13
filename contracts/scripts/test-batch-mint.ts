/**
 * Test script for batchMintNFT function
 * Usage: npx hardhat run scripts/test-batch-mint.ts --network bscTestnet
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" 
    ? (process.env.HARDHAT_NETWORK || "localhost")
    : network.name;

  console.log(`🧪 Testing batchMintNFT on ${networkName.toUpperCase()}...\n`);

  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS;
  if (!NFT_MANAGER_ADDRESS) {
    throw new Error("❌ Please set NFT_MANAGER_ADDRESS in .env file");
  }

  const [signer] = await ethers.getSigners();
  console.log("Tester:", signer.address);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), networkName === "localhost" ? "ETH" : "BNB");
  console.log("NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("");

  // Get NFTManagerFacet interface
  const nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", NFT_MANAGER_ADDRESS);

  // Check if batchMintNFT function exists
  console.log("1️⃣  Checking if batchMintNFT function exists...");
  try {
    // Try to get the function selector
    const iface = new ethers.Interface([
      "function batchMintNFT(uint256 quantity) external returns (uint256[] memory)"
    ]);
    const selector = iface.getFunction("batchMintNFT").selector;
    console.log(`✅ batchMintNFT selector: ${selector}`);

    // Check if function is available on the contract
    const code = await ethers.provider.getCode(NFT_MANAGER_ADDRESS);
    if (code === "0x") {
      throw new Error("Contract not found at address");
    }

    // Try to call the function (this will fail if not whitelisted, but that's OK)
    console.log("\n2️⃣  Testing batchMintNFT function availability...");
    try {
      // This will revert if not whitelisted, but we can check if the function exists
      await nftManagerFacet.batchMintNFT.staticCall(1);
      console.log("✅ Function exists and is callable");
    } catch (error: any) {
      if (error.message?.includes("Not whitelisted") || error.message?.includes("No active batch")) {
        console.log("✅ Function exists (reverted due to business logic, not function missing)");
      } else {
        throw error;
      }
    }

    console.log("\n✅ batchMintNFT function is available on the contract!");
    console.log("\n📝 Function signature:");
    console.log("   batchMintNFT(uint256 quantity) returns (uint256[] memory)");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.message?.includes("does not exist")) {
      console.error("\n⚠️  batchMintNFT function not found. Please upgrade the NFTManagerFacet first.");
      console.error("   Run: npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet");
    }
    throw error;
  }

  // Check active batch
  console.log("\n3️⃣  Checking active batch...");
  try {
    const activeBatchId = await nftManagerFacet.getActiveBatch();
    if (activeBatchId === BigInt(0)) {
      console.log("⚠️  No active batch found");
    } else {
      console.log(`✅ Active batch ID: ${activeBatchId}`);
      const batch = await nftManagerFacet.batches(activeBatchId);
      console.log(`   Max mintable: ${batch[1]}`);
      console.log(`   Current minted: ${batch[2]}`);
      console.log(`   Mint price: ${ethers.formatEther(batch[3])} USDT`);
    }
  } catch (error: any) {
    console.error("❌ Error checking batch:", error.message);
  }

  // Check whitelist status
  console.log("\n4️⃣  Checking whitelist status...");
  try {
    const isWhitelisted = await nftManagerFacet.isWhitelisted(signer.address);
    console.log(`   Whitelisted: ${isWhitelisted ? "✅ Yes" : "❌ No"}`);
  } catch (error: any) {
    console.error("❌ Error checking whitelist:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Test Complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


