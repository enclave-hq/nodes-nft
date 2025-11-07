import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Updating NodeNFT's nftManager address\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Use new addresses (hardcoded to ensure updating the correct contracts)
  const NODE_NFT = '0x92301C0acA7586d9F0B1968af2502616009Abf69';
  const NEW_NFT_MANAGER = '0xF87F9296955439C323ac79769959bEe087f6D06E';

  console.log("NodeNFT Address:", NODE_NFT);
  console.log("New NFTManager Proxy:", NEW_NFT_MANAGER);
  console.log("");

  const NodeNFTABI = [
    "function nftManager() view returns (address)",
    "function updateNFTManager(address manager_) external",
    "function owner() view returns (address)"
  ];
  const nodeNFT = new ethers.Contract(NODE_NFT, NodeNFTABI, deployer);

  try {
    // Check current nftManager address
    const currentManager = await nodeNFT.nftManager();
    console.log("Current nftManager Address:", currentManager);
    console.log("");

    if (currentManager.toLowerCase() === NEW_NFT_MANAGER.toLowerCase()) {
      console.log("✅ NodeNFT's nftManager address is already correct!");
      return;
    }

    // Check owner
    const owner = await nodeNFT.owner();
    console.log("NodeNFT Owner:", owner);
    console.log("Deployer:", deployer.address);
    console.log("");

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("❌ Error: Deployer is not the owner of NodeNFT!");
      console.log("   Required owner address:", owner);
      process.exit(1);
    }

    // Update nftManager address
    console.log("📝 Updating NodeNFT's nftManager address...");
    const tx = await nodeNFT.updateNFTManager(NEW_NFT_MANAGER);
    console.log("   Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Update confirmed!");

    // Verify
    const verified = await nodeNFT.nftManager();
    console.log("✅ Verified nftManager Address:", verified);

    if (verified.toLowerCase() === NEW_NFT_MANAGER.toLowerCase()) {
      console.log("✅ Successfully updated NodeNFT's nftManager address!");
    } else {
      console.log("❌ Verification failed!");
    }
  } catch (error: any) {
    console.error("❌ Update failed:", error.message);
    if (error.data) {
      console.error("   Error Data:", error.data);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

