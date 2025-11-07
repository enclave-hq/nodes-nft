import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Manually Upgrading NFTManager Proxy\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
  
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("");

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);

  // Deploy new implementation
  console.log("\n📦 Deploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("✅ New Implementation:", newImplAddress);

  // Get proxy contract
  const proxy = NFTManager.attach(PROXY_ADDRESS);
  const owner = await proxy.owner();
  console.log("Proxy Owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployer is not the owner!");
  }

  // Call upgradeToAndCall on the proxy (UUPS pattern)
  console.log("\n🔄 Calling upgradeToAndCall on proxy...");
  try {
    // UUPS proxy uses upgradeToAndCall function
    const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, "0x", { gasLimit: 1000000 });
    console.log("Upgrade tx hash:", upgradeTx.hash);
    const receipt = await upgradeTx.wait();
    console.log("✅ Upgrade transaction confirmed! Block:", receipt.blockNumber);
    
    // Verify new implementation
    const verifiedImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("✅ Verified Implementation:", verifiedImpl);
    
    if (verifiedImpl.toLowerCase() === newImplAddress.toLowerCase()) {
      console.log("✅ Implementation successfully upgraded!");
    } else {
      console.log("⚠️  Implementation address mismatch!");
      console.log("   Expected:", newImplAddress);
      console.log("   Got:", verifiedImpl);
    }
  } catch (error: any) {
    console.error("❌ Upgrade failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    throw error;
  }

  // Test setNodeNFT
  console.log("\n🧪 Testing setNodeNFT function...");
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
  try {
    const tx = await proxy.setNodeNFT(NODE_NFT_ADDRESS, { gasLimit: 500000 });
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ setNodeNFT called successfully! Block:", receipt.blockNumber);
    
    const newNodeNFT = await proxy.nodeNFT();
    console.log("New NodeNFT address:", newNodeNFT);
  } catch (error: any) {
    console.log("❌ Failed to call setNodeNFT:", error.message);
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Manual Upgrade Complete!");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

