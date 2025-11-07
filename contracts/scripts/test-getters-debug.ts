import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0xCB1236c376Cc00d526620418FDd2Ed2EE6C311C6";
  
  console.log("🔍 Debugging Getter Functions\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  // Test reading storage slots directly
  console.log("📊 Reading Storage Slots Directly:");
  const slots = [11, 12, 14, 15, 22];
  const labels: Record<number, string> = {
    11: "whitelistCount",
    12: "transfersEnabled", 
    14: "currentBatchId",
    15: "totalMinted",
    22: "nextOrderId"
  };
  
  for (const slot of slots) {
    const value = await ethers.provider.getStorage(PROXY_ADDRESS, slot);
    const num = BigInt(value);
    console.log(`Slot ${slot} (${labels[slot]}): ${value} = ${num.toString()}`);
  }
  
  console.log("\n📋 Testing Getter Functions:");
  
  // Test getters
  const getters = [
    { name: "owner", type: "address" },
    { name: "currentBatchId", type: "uint256" },
    { name: "nextOrderId", type: "uint256" },
    { name: "whitelistCount", type: "uint256" },
    { name: "totalMinted", type: "uint256" },
    { name: "transfersEnabled", type: "bool" }
  ];
  
  for (const getter of getters) {
    try {
      const result = await (manager as any)[getter.name]();
      if (typeof result === "string" && result.startsWith("0x")) {
        console.log(`✅ ${getter.name}(): ${result.slice(0, 12)}...`);
      } else {
        console.log(`✅ ${getter.name}(): ${result.toString()}`);
      }
    } catch (error: any) {
      console.log(`❌ ${getter.name}(): FAILED`);
      console.log(`   Error: ${error.message.slice(0, 100)}`);
      if (error.data) {
        console.log(`   Data: ${error.data.slice(0, 20)}...`);
      }
    }
  }
  
  console.log("\n🔄 Testing Write Operations:");
  
  // Try to create a batch
  try {
    console.log("Attempting createBatch...");
    const maxMintable = 100n;
    const mintPrice = ethers.parseUnits("10", 18);
    const tx = await manager.createBatch(maxMintable, mintPrice);
    console.log("   Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ createBatch succeeded! Block:", receipt.blockNumber);
    
    // Now try to read currentBatchId again
    console.log("\n📋 Re-testing currentBatchId() after createBatch:");
    try {
      const batchId = await manager.currentBatchId();
      console.log(`✅ currentBatchId(): ${batchId.toString()}`);
    } catch (error: any) {
      console.log(`❌ currentBatchId() still fails: ${error.message.slice(0, 100)}`);
    }
    
    // Check storage slot 14 again
    const slot14After = await ethers.provider.getStorage(PROXY_ADDRESS, 14);
    console.log(`   Slot 14 after createBatch: ${slot14After} = ${BigInt(slot14After).toString()}`);
    
  } catch (error: any) {
    console.log("❌ createBatch failed:", error.message.slice(0, 150));
    if (error.data) {
      console.log("   Data:", error.data.slice(0, 20), "...");
    }
  }
  
  // Try to add to whitelist
  try {
    console.log("\nAttempting addToWhitelist...");
    const testAddress = "0x8202044baBe9070395121350e2DABc2581a4E04E";
    const tx = await manager.addToWhitelist([testAddress]);
    console.log("   Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ addToWhitelist succeeded! Block:", receipt.blockNumber);
    
    // Now try to read whitelistCount again
    console.log("\n📋 Re-testing whitelistCount() after addToWhitelist:");
    try {
      const count = await manager.whitelistCount();
      console.log(`✅ whitelistCount(): ${count.toString()}`);
    } catch (error: any) {
      console.log(`❌ whitelistCount() still fails: ${error.message.slice(0, 100)}`);
    }
    
    // Check storage slot 11 again
    const slot11After = await ethers.provider.getStorage(PROXY_ADDRESS, 11);
    console.log(`   Slot 11 after addToWhitelist: ${slot11After} = ${BigInt(slot11After).toString()}`);
    
  } catch (error: any) {
    console.log("❌ addToWhitelist failed:", error.message.slice(0, 150));
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

