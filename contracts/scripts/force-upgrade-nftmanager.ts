import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Force Upgrading NFTManager Proxy\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
  
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("");

  // Check owner
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const proxy = NFTManager.attach(PROXY_ADDRESS);
  const owner = await proxy.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployer is not the owner!");
  }
  console.log("✅ Deployer is the owner\n");

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);

  // Deploy new implementation manually
  console.log("\n📦 Deploying new implementation contract...");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("✅ New Implementation deployed:", newImplAddress);

  // Upgrade proxy to new implementation
  console.log("\n🔄 Upgrading proxy to new implementation...");
  const upgradedProxy = await upgrades.upgradeProxy(PROXY_ADDRESS, NFTManager);
  await upgradedProxy.waitForDeployment();
  console.log("✅ Proxy upgraded!");

  // Verify new implementation address
  const verifiedImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("✅ Verified Implementation:", verifiedImpl);
  
  if (verifiedImpl.toLowerCase() !== newImplAddress.toLowerCase()) {
    console.log("⚠️  Warning: Implementation address mismatch!");
    console.log("   Expected:", newImplAddress);
    console.log("   Got:", verifiedImpl);
  } else {
    console.log("✅ Implementation address matches!");
  }

  // Test setNodeNFT function
  console.log("\n🧪 Testing setNodeNFT function...");
  const hasFunction = upgradedProxy.interface.hasFunction("setNodeNFT");
  console.log("Has setNodeNFT:", hasFunction);
  
  if (hasFunction) {
    const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
    try {
      const tx = await upgradedProxy.setNodeNFT(NODE_NFT_ADDRESS, { gasLimit: 500000 });
      console.log("Tx hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ setNodeNFT called successfully! Block:", receipt.blockNumber);
      
      const newNodeNFT = await upgradedProxy.nodeNFT();
      console.log("New NodeNFT address:", newNodeNFT);
    } catch (error: any) {
      console.log("❌ Failed to call setNodeNFT:", error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Force Upgrade Complete!");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

