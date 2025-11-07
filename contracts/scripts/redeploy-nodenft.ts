import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Re-deploying NodeNFT Contract\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get addresses from environment
  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS;
  
  if (!NFT_MANAGER_ADDRESS) {
    throw new Error("❌ Please set NFT_MANAGER_ADDRESS or MANAGER_ADDRESS in .env file");
  }

  console.log("Using addresses:");
  console.log("  NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("");

  // Deploy NodeNFT
  console.log("📦 Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nodeNFTAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nodeNFTAddress);

  // Set NFTManager in NodeNFT
  console.log("\n📝 Setting NFTManager in NodeNFT...");
  const setManagerTx = await nodeNFT.setNFTManager(NFT_MANAGER_ADDRESS);
  await setManagerTx.wait();
  console.log("✅ NFTManager set in NodeNFT");

  // Verify the setup
  const managerAddress = await nodeNFT.nftManager();
  if (managerAddress.toLowerCase() === NFT_MANAGER_ADDRESS.toLowerCase()) {
    console.log("✅ Verification: NFTManager address is correct");
  } else {
    console.log("❌ Verification failed!");
    console.log("   Expected:", NFT_MANAGER_ADDRESS);
    console.log("   Got:", managerAddress);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 RE-DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 New Contract Address:");
  console.log("─".repeat(70));
  console.log("NodeNFT:", nodeNFTAddress);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "bscTestnet" : network.name;
  const explorerBase = networkName.includes("testnet") 
    ? "https://testnet.bscscan.com" 
    : "https://bscscan.com";
  console.log("NodeNFT:", `${explorerBase}/address/${nodeNFTAddress}`);

  console.log("\n💾 Update your .env file:");
  console.log("─".repeat(70));
  console.log(`NODE_NFT_ADDRESS=${nodeNFTAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nodeNFTAddress}`);

  console.log("\n⚠️  IMPORTANT NOTES:");
  console.log("─".repeat(70));
  console.log("1. This is a NEW NodeNFT contract - all existing NFTs are in the OLD contract");
  console.log("2. You need to update NFTManager to use the new NodeNFT address");
  console.log("3. Update all frontend/backend configurations with the new address");
  console.log("4. If you have existing NFTs, they will remain in the old contract");
  console.log("5. Consider migrating existing NFTs if needed");

  // Update DEPLOYMENT_RESULTS.md if it exists
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      
      // Update NodeNFT address
      const nodeNFTPattern = /(\*\*NodeNFT\*\* \| ✅ Deployed \| )`0x[a-fA-F0-9]+`/;
      if (nodeNFTPattern.test(content)) {
        content = content.replace(nodeNFTPattern, `$1\`${nodeNFTAddress}\``);
        console.log("\n✅ Updated DEPLOYMENT_RESULTS.md with new NodeNFT address");
      }
      
      // Update date
      const currentDate = new Date().toISOString().split("T")[0];
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g,
        `**Last Updated:** ${currentDate}`
      );
      
      fs.writeFileSync(resultsFile, content, "utf-8");
      console.log("✅ Updated DEPLOYMENT_RESULTS.md date");
    }
  } catch (error: any) {
    console.warn("⚠️  Failed to update DEPLOYMENT_RESULTS.md:", error.message);
  }

  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

