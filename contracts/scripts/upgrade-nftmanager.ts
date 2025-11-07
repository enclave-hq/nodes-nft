import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Upgrading NFTManager Proxy to Latest Implementation\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get proxy address from environment or use default
  // Updated to use the correct address from DEPLOYMENT_RESULTS.md
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || "0x8959EaF389e49f040A11ca27D783F4900532c1F1";
  
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("");

  // Verify current implementation
  try {
    const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("Current Implementation:", currentImpl);
  } catch (error: any) {
    console.log("⚠️  Could not read current implementation:", error.message);
  }

  // Check if deployer is the owner
  try {
    const NFTManager = await ethers.getContractFactory("NFTManager");
    const proxy = await NFTManager.attach(PROXY_ADDRESS);
    const owner = await proxy.owner();
    console.log("Contract Owner:", owner);
    console.log("Deployer:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("\n❌ ERROR: Deployer is not the contract owner!");
      console.error("   Only the owner can upgrade the contract.");
      console.error("   Please use the owner's private key to run this script.");
      process.exit(1);
    }
    console.log("✅ Deployer is the contract owner - can proceed with upgrade\n");
  } catch (error: any) {
    console.error("❌ Error checking ownership:", error.message);
    process.exit(1);
  }

  // First, register the existing proxy if not already registered
  console.log("📝 Registering existing proxy...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  
  try {
    // Try to force import the existing proxy
    await upgrades.forceImport(PROXY_ADDRESS, NFTManager, { kind: "uups" });
    console.log("✅ Proxy registered successfully\n");
  } catch (error: any) {
    // If already registered or other error, continue
    if (error.message.includes("already registered")) {
      console.log("✅ Proxy already registered\n");
    } else {
      console.log("⚠️  Could not register proxy (may already be registered):", error.message);
      console.log("   Continuing with upgrade...\n");
    }
  }

  // Deploy new implementation and upgrade
  console.log("📦 Deploying new implementation and upgrading proxy...");
  console.log("   This will deploy a new implementation and update the proxy.\n");

  // Force upgrade by deploying new implementation first
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, NFTManager, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"]
  });
  await upgraded.waitForDeployment();
  
  console.log("✅ Proxy upgraded successfully!");

  // Get new implementation address
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("✅ New Implementation Address:", newImplAddress);
  console.log("✅ Proxy Address (unchanged):", PROXY_ADDRESS);

  // Verify the upgrade worked by calling functions
  try {
    const owner = await upgraded.owner();
    console.log("✅ Owner verification:", owner);
    
    // Try to read currentBatchId to verify it works
    try {
      const batchId = await upgraded.currentBatchId();
      console.log("✅ Current Batch ID:", batchId.toString());
    } catch (error: any) {
      console.log("⚠️  Warning: Could not read currentBatchId -", error.message);
    }
    
    // Verify new functions exist
    try {
      // Test getNFTPool returns producedDebt (should have 9 return values now)
      const testNftId = 1;
      const poolData = await upgraded.getNFTPool(testNftId);
      if (poolData.length >= 9) {
        console.log("✅ getNFTPool returns producedDebt (9 values)");
      } else {
        console.log("⚠️  Warning: getNFTPool may not return producedDebt");
      }
    } catch (error: any) {
      console.log("⚠️  Warning: Could not test getNFTPool -", error.message);
    }
    
    try {
      // Test getAccRewardPerNFT function exists
      const usdtAddress = await upgraded.usdtToken();
      const accReward = await upgraded.getAccRewardPerNFT(usdtAddress);
      console.log("✅ getAccRewardPerNFT function works");
    } catch (error: any) {
      console.log("⚠️  Warning: Could not test getAccRewardPerNFT -", error.message);
    }
    
    try {
      // Test getRewardDebt function exists
      const testNftId = 1;
      const usdtAddress = await upgraded.usdtToken();
      const rewardDebt = await upgraded.getRewardDebt(testNftId, usdtAddress);
      console.log("✅ getRewardDebt function works");
    } catch (error: any) {
      console.log("⚠️  Warning: Could not test getRewardDebt -", error.message);
    }
    
    try {
      // Test setNodeNFT function exists
      const hasSetNodeNFT = upgraded.interface.hasFunction("setNodeNFT");
      if (hasSetNodeNFT) {
        console.log("✅ setNodeNFT function exists in upgraded contract");
      } else {
        console.log("❌ setNodeNFT function NOT found in upgraded contract!");
      }
    } catch (error: any) {
      console.log("⚠️  Warning: Could not test setNodeNFT -", error.message);
    }
  } catch (error: any) {
    console.log("⚠️  Warning: Could not verify upgrade -", error.message);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 UPGRADE COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 Updated Addresses:");
  console.log("─".repeat(70));
  console.log("Proxy Address:      ", PROXY_ADDRESS);
  console.log("New Implementation:  ", newImplAddress);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("Proxy:       https://testnet.bscscan.com/address/" + PROXY_ADDRESS);
  console.log("Implementation: https://testnet.bscscan.com/address/" + newImplAddress);

  console.log("\n💡 Next Steps:");
  console.log("─".repeat(70));
  console.log("1. Verify the new implementation on BSCScan:");
  console.log(`   npx hardhat verify --network bscTestnet ${newImplAddress}`);
  console.log("\n2. Update DEPLOYMENT_RESULTS.md with the new implementation address");
  console.log("\n3. Test the contract functions to ensure everything works");

  // Update DEPLOYMENT_RESULTS.md if it exists
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      
      // Update implementation address
      const implPattern = /(\*\*Implementation Address:\*\* )`0x[a-fA-F0-9]+`/;
      if (implPattern.test(content)) {
        content = content.replace(implPattern, `$1\`${newImplAddress}\``);
        console.log("\n✅ Updated DEPLOYMENT_RESULTS.md with new implementation address");
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
    console.error("\n❌ Upgrade failed:");
    console.error(error);
    process.exit(1);
  });
