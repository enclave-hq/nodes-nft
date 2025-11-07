import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Updating new NFTManager Proxy to point to new NodeNFT\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");
  
  // Use new addresses (hardcoded to ensure updating the correct contracts)
  const NEW_NFT_MANAGER = '0xF87F9296955439C323ac79769959bEe087f6D06E';
  const NEW_NODE_NFT = '0x92301C0acA7586d9F0B1968af2502616009Abf69';

  console.log("New NFTManager Proxy:", NEW_NFT_MANAGER);
  console.log("New NodeNFT:", NEW_NODE_NFT);
  console.log("");

  const NFTManagerABI = [
    "function setNodeNFT(address nodeNFT_) external",
    "function nodeNFT() view returns (address)"
  ];
  const nftManager = new ethers.Contract(NEW_NFT_MANAGER, NFTManagerABI, deployer);

  const currentNodeNFT = await nftManager.nodeNFT();
  console.log("Current NodeNFT Address:", currentNodeNFT);

  if (currentNodeNFT.toLowerCase() === NEW_NODE_NFT.toLowerCase()) {
    console.log("✅ New NFTManager already points to new NodeNFT");
    return;
  }

  console.log("\n📝 Updating new NFTManager to point to new NodeNFT...");
  const tx = await nftManager.setNodeNFT(NEW_NODE_NFT);
  console.log("   Transaction Hash:", tx.hash);
  await tx.wait();
  console.log("✅ Update confirmed!");

  const verified = await nftManager.nodeNFT();
  console.log("✅ Verified NodeNFT Address:", verified);

  if (verified.toLowerCase() === NEW_NODE_NFT.toLowerCase()) {
    console.log("✅ Successfully updated new NFTManager!");
  } else {
    console.log("❌ Verification failed!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });

