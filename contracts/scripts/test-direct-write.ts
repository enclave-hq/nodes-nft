import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x2252c4fC3D79120f001de5C33E5E82F1E56097c5";
  
  console.log("🔍 Testing Direct Contract Calls with Write Operations\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  // Check owner
  try {
    const owner = await manager.owner();
    console.log(`✅ Owner: ${owner}`);
    console.log(`✅ Is deployer owner? ${owner.toLowerCase() === deployer.address.toLowerCase()}`);
  } catch (error: any) {
    console.log(`❌ Owner check failed: ${error.message}`);
    return;
  }
  
  console.log("");
  
  // Try to create a batch (this should set currentBatchId if it works)
  console.log("Testing createBatch...");
  try {
    const maxMintable = 100n;
    const mintPrice = ethers.parseUnits('10', 18); // 10 USDT in wei
    const tx = await manager.createBatch(maxMintable, mintPrice);
    console.log("   Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Batch created! Block:", receipt.blockNumber);
    
    // Now try to read currentBatchId
    console.log("\nTesting currentBatchId after createBatch...");
    try {
      const batchId = await manager.currentBatchId();
      console.log(`   ✅ currentBatchId: ${batchId.toString()}`);
    } catch (error: any) {
      console.log(`   ❌ currentBatchId still fails: ${error.message}`);
    }
  } catch (error: any) {
    console.log(`❌ createBatch failed: ${error.message}`);
    if (error.data) {
      console.log(`   Data: ${error.data}`);
    }
  }
  
  console.log("");
  
  // Try to add to whitelist
  console.log("Testing addToWhitelist...");
  try {
    const testAddress = "0x8202044baBe9070395121350e2DABc2581a4E04E";
    const tx = await manager.addToWhitelist([testAddress]);
    console.log("   Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Added to whitelist! Block:", receipt.blockNumber);
    
    // Now try to read whitelistCount
    console.log("\nTesting whitelistCount after addToWhitelist...");
    try {
      const count = await manager.whitelistCount();
      console.log(`   ✅ whitelistCount: ${count.toString()}`);
    } catch (error: any) {
      console.log(`   ❌ whitelistCount still fails: ${error.message}`);
    }
  } catch (error: any) {
    console.log(`❌ addToWhitelist failed: ${error.message}`);
    if (error.data) {
      console.log(`   Data: ${error.data}`);
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

