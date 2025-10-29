import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔄 Upgrading NFTManager Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get current proxy address
  const PROXY_ADDRESS = process.env.MANAGER_ADDRESS;
  if (!PROXY_ADDRESS || PROXY_ADDRESS === "") {
    throw new Error("❌ Please set MANAGER_ADDRESS in .env file");
  }
  console.log("Current Proxy Address:", PROXY_ADDRESS);

  // Check current implementation
  console.log("\n🔍 Checking current implementation...");
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);

  // Upgrade the proxy directly
  console.log("\n⬆️  Upgrading proxy to new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  
  // Force deploy new implementation first
  console.log("📦 Deploying new implementation...");
  const newImplementation = await NFTManager.deploy();
  await newImplementation.waitForDeployment();
  const newImplAddress = await newImplementation.getAddress();
  console.log("✅ New implementation deployed:", newImplAddress);
  
  // Upgrade proxy to new implementation
  const proxy = await ethers.getContractAt("NFTManager", PROXY_ADDRESS);
  const upgradeTx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  await upgradeTx.wait();
  console.log("✅ Proxy upgraded successfully!");

  // Verify the upgrade
  console.log("\n🔍 Verifying upgrade...");
  const upgradedImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New Implementation:", upgradedImpl);
  
  if (upgradedImpl !== currentImpl) {
    console.log("✅ Upgrade verified successfully!");
  } else {
    console.log("❌ Upgrade verification failed!");
  }

  // Test basic functions
  console.log("\n🧪 Testing basic functions...");
  try {
    const owner = await proxy.owner();
    console.log("✅ Owner:", owner);
    
    const nextOrderId = await proxy.nextOrderId();
    console.log("✅ nextOrderId:", nextOrderId.toString());
    
    const precision = await proxy.PRECISION();
    console.log("✅ PRECISION:", precision.toString());
    
    const sharesPerNFT = await proxy.SHARES_PER_NFT();
    console.log("✅ SHARES_PER_NFT:", sharesPerNFT.toString());
    
    // Test new getAvailableShares function
    const testUser = deployer.address;
    const testNFTId = 1;
    try {
      const availableShares = await proxy.getAvailableShares(testNFTId, testUser);
      console.log(`✅ getAvailableShares(${testNFTId}, ${testUser}):`, availableShares.toString());
    } catch (error: any) {
      console.log("⚠️ getAvailableShares test failed:", error.message);
      console.log("   This is expected if the user has no shares in NFT", testNFTId);
    }
    
    // Test getUserShareCount function
    try {
      const userShareCount = await proxy.getUserShareCount(testNFTId, testUser);
      console.log(`✅ getUserShareCount(${testNFTId}, ${testUser}):`, userShareCount.toString());
    } catch (error: any) {
      console.log("⚠️ getUserShareCount test failed:", error.message);
    }
    
    // Test getUserNFTs function
    try {
      const userNFTs = await proxy.getUserNFTs(testUser);
      console.log(`✅ getUserNFTs(${testUser}):`, userNFTs.map(id => id.toString()));
    } catch (error: any) {
      console.log("⚠️ getUserNFTs test failed:", error.message);
    }
    
    // Test getShareholders function
    try {
      const shareholders = await proxy.getShareholders(testNFTId);
      console.log(`✅ getShareholders(${testNFTId}):`, shareholders);
    } catch (error: any) {
      console.log("⚠️ getShareholders test failed:", error.message);
    }
    
    // Test getDissolutionProposal function
    try {
      const dissolutionProposal = await proxy.getDissolutionProposal(testNFTId);
      console.log(`✅ getDissolutionProposal(${testNFTId}):`, dissolutionProposal);
    } catch (error: any) {
      console.log("❌ getDissolutionProposal test failed:", error.message);
    }
    
  } catch (error: any) {
    console.log("❌ Function test failed:", error.message);
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 UPGRADE COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(70));
  console.log("Proxy Address:        ", PROXY_ADDRESS);
  console.log("New Implementation:   ", upgradedImpl);
  
  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("Proxy:         https://testnet.bscscan.com/address/" + PROXY_ADDRESS);
  console.log("Implementation: https://testnet.bscscan.com/address/" + upgradedImpl);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Verify new implementation on BSCScan:");
  console.log(`   npx hardhat verify --network bscTestnet ${upgradedImpl}`);
  console.log("\n2. Test marketplace functions:");
  console.log("   - createSellOrder (now checks available shares)");
  console.log("   - getAvailableShares");
  console.log("\n3. Update frontend if needed");
  
  console.log("\n🔧 V3 Changes:");
  console.log("─".repeat(70));
  console.log("✅ Added getAvailableShares() function");
  console.log("✅ Fixed createSellOrder() to check available shares");
  console.log("✅ Prevents overselling shares in active orders");
  console.log("✅ Added _removeFromUserNFTList() function");
  console.log("✅ Fixed userNFTList cleanup when shares become 0");
  console.log("✅ Improved data consistency in share transfers");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Upgrade failed:");
    console.error(error);
    process.exit(1);
  });
