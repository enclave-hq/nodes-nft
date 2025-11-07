import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Setting NodeNFT address in NFTManager contract\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get addresses from environment
  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS;
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS;

  if (!NFT_MANAGER_ADDRESS) {
    throw new Error("❌ Please set NFT_MANAGER_ADDRESS or MANAGER_ADDRESS in .env file");
  }

  if (!NODE_NFT_ADDRESS) {
    throw new Error("❌ Please set NODE_NFT_ADDRESS in .env file");
  }

  console.log("Using addresses:");
  console.log("  NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("  NodeNFT:", NODE_NFT_ADDRESS);
  console.log("");

  // Load NFTManager contract
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = NFTManager.attach(NFT_MANAGER_ADDRESS);

  // Check current NodeNFT address
  try {
    const currentNodeNFT = await nftManager.nodeNFT();
    console.log("Current NodeNFT in NFTManager:", currentNodeNFT);
    
    if (currentNodeNFT.toLowerCase() === NODE_NFT_ADDRESS.toLowerCase()) {
      console.log("✅ NodeNFT address is already set correctly!");
      return;
    }
    
    console.log("⚠️  NodeNFT address mismatch!");
    console.log("   Current:", currentNodeNFT);
    console.log("   Expected:", NODE_NFT_ADDRESS);
  } catch (error: any) {
    console.log("⚠️  Could not read current NodeNFT address:", error.message);
  }

  // Check if we're the owner
  const owner = await nftManager.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`❌ Deployer is not the owner! Owner: ${owner}`);
  }
  console.log("✅ Deployer is the owner\n");

  // Update NodeNFT address
  console.log("📝 Setting NodeNFT address in NFTManager...");
  try {
    const tx = await nftManager.setNodeNFT(NODE_NFT_ADDRESS);
    console.log("   Transaction hash:", tx.hash);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ NodeNFT address set successfully!");
    console.log("   Block number:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    // Verify the change
    const newNodeNFT = await nftManager.nodeNFT();
    if (newNodeNFT.toLowerCase() === NODE_NFT_ADDRESS.toLowerCase()) {
      console.log("✅ Verification: NodeNFT address is now:", newNodeNFT);
    } else {
      console.log("❌ Verification failed!");
      console.log("   Expected:", NODE_NFT_ADDRESS);
      console.log("   Got:", newNodeNFT);
    }
  } catch (error: any) {
    console.error("❌ Failed to set NodeNFT address:");
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
  console.log("🎉 Setup Complete!");
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

