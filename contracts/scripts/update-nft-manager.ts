import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Updating NFTManager address in NodeNFT contract\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get addresses from environment
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS;
  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS;

  if (!NODE_NFT_ADDRESS) {
    throw new Error("❌ Please set NODE_NFT_ADDRESS in .env file");
  }

  if (!NFT_MANAGER_ADDRESS) {
    throw new Error("❌ Please set NFT_MANAGER_ADDRESS or MANAGER_ADDRESS in .env file");
  }

  console.log("Using addresses:");
  console.log("  NodeNFT:", NODE_NFT_ADDRESS);
  console.log("  NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("");

  // Load NodeNFT contract
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = NodeNFT.attach(NODE_NFT_ADDRESS);

  // Check current NFTManager address
  try {
    const currentManager = await nodeNFT.nftManager();
    console.log("Current NFTManager in NodeNFT:", currentManager);
    
    if (currentManager.toLowerCase() === NFT_MANAGER_ADDRESS.toLowerCase()) {
      console.log("✅ NFTManager address is already set correctly!");
      return;
    }
    
    console.log("⚠️  NFTManager address mismatch!");
    console.log("   Current:", currentManager);
    console.log("   Expected:", NFT_MANAGER_ADDRESS);
  } catch (error: any) {
    console.log("⚠️  Could not read current NFTManager address:", error.message);
  }

  // Update NFTManager address using updateNFTManager function
  console.log("\n📝 Updating NFTManager address in NodeNFT...");
  try {
    const tx = await nodeNFT.updateNFTManager(NFT_MANAGER_ADDRESS);
    console.log("   Transaction hash:", tx.hash);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ NFTManager address updated successfully!");
    console.log("   Block number:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    // Verify the change
    const newManager = await nodeNFT.nftManager();
    if (newManager.toLowerCase() === NFT_MANAGER_ADDRESS.toLowerCase()) {
      console.log("✅ Verification: NFTManager address is now:", newManager);
    } else {
      console.log("❌ Verification failed!");
      console.log("   Expected:", NFT_MANAGER_ADDRESS);
      console.log("   Got:", newManager);
    }
  } catch (error: any) {
    console.error("❌ Failed to update NFTManager address:");
    console.error("   Error:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    if (error.data) {
      console.error("   Data:", error.data);
    }
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Update Complete!");
  console.log("=".repeat(70));
  console.log("\n💡 Next Steps:");
  console.log("   1. Test NFT minting to verify the setup");
  console.log("   2. Run the automated test script");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

