import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x2252c4fC3D79120f001de5C33E5E82F1E56097c5";
  
  console.log("🔍 Testing Direct Contract Calls\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  // Test individual getter calls
  const testFunctions = [
    'whitelistCount',
    'currentBatchId', 
    'totalMinted',
    'transfersEnabled',
    'owner',
    'oracle'
  ];
  
  for (const funcName of testFunctions) {
    try {
      const result = await manager[funcName]();
      console.log(`✅ ${funcName}:`, result.toString ? result.toString() : result);
    } catch (error: any) {
      console.log(`❌ ${funcName}:`, error.message);
      if (error.data) {
        console.log(`   Data:`, error.data);
      }
      if (error.reason) {
        console.log(`   Reason:`, error.reason);
      }
    }
  }
  
  console.log("");
  
  // Test addToWhitelist
  console.log("Testing addToWhitelist...");
  try {
    const testAddress = "0x8202044baBe9070395121350e2DABc2581a4E04E";
    const isWhitelisted = await manager.whitelist(testAddress);
    console.log(`✅ User ${testAddress} is whitelisted:`, isWhitelisted);
    
    if (!isWhitelisted) {
      console.log("Attempting to add to whitelist...");
      const tx = await manager.addToWhitelist([testAddress]);
      console.log("   Tx hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("   ✅ Success! Block:", receipt.blockNumber);
    }
  } catch (error: any) {
    console.log("❌ addToWhitelist error:", error.message);
    if (error.data) {
      console.log("   Data:", error.data);
    }
  }
  
  console.log("");
  
  // Test getActiveBatch
  console.log("Testing getActiveBatch...");
  try {
    const activeBatch = await manager.getActiveBatch();
    console.log(`✅ Active Batch ID:`, activeBatch.toString());
  } catch (error: any) {
    console.log("❌ getActiveBatch error:", error.message);
    if (error.data) {
      console.log("   Data:", error.data);
    }
  }
  
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

