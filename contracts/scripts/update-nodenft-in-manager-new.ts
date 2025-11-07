import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Updating NFTManager to use new NodeNFT address\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  const NFT_MANAGER = process.env.NFT_MANAGER_ADDRESS || '0xF87F9296955439C323ac79769959bEe087f6D06E';
  const NEW_NODE_NFT = process.env.NODE_NFT_ADDRESS || '0x92301C0acA7586d9F0B1968af2502616009Abf69';

  console.log("NFTManager:", NFT_MANAGER);
  console.log("New NodeNFT:", NEW_NODE_NFT);
  console.log("");

  const NFTManagerABI = [
    "function setNodeNFT(address nodeNFT_) external",
    "function nodeNFT() view returns (address)"
  ];
  const nftManager = new ethers.Contract(NFT_MANAGER, NFTManagerABI, deployer);

  const currentNodeNFT = await nftManager.nodeNFT();
  console.log("Current NodeNFT in NFTManager:", currentNodeNFT);

  if (currentNodeNFT.toLowerCase() === NEW_NODE_NFT.toLowerCase()) {
    console.log("✅ NFTManager already points to the new NodeNFT");
    return;
  }

  console.log("\n📝 Updating NFTManager to use new NodeNFT...");
  const tx = await nftManager.setNodeNFT(NEW_NODE_NFT);
  console.log("   Transaction hash:", tx.hash);
  await tx.wait();
  console.log("✅ Update confirmed!");

  const verified = await nftManager.nodeNFT();
  console.log("✅ Verified NodeNFT address:", verified);

  if (verified.toLowerCase() === NEW_NODE_NFT.toLowerCase()) {
    console.log("✅ Successfully updated!");
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

