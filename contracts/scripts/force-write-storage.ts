import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0xCB1236c376Cc00d526620418FDd2Ed2EE6C311C6";
  
  console.log("🔧 Force Writing Storage Values\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  // Check owner
  const owner = await manager.owner();
  console.log("Contract owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ Deployer is not the owner!");
    return;
  }
  
  console.log("\n📊 Current state:");
  try {
    const batchId = await manager.currentBatchId();
    console.log("  currentBatchId:", batchId.toString());
  } catch (e: any) {
    console.log("  currentBatchId: FAILED (expected)");
  }
  
  try {
    const orderId = await manager.nextOrderId();
    console.log("  nextOrderId:", orderId.toString());
  } catch (e: any) {
    console.log("  nextOrderId: FAILED");
  }
  
  // Try to create a batch - this should write to currentBatchId
  console.log("\n🔄 Attempting createBatch to trigger currentBatchId write...");
  try {
    const maxMintable = 100n;
    const mintPrice = ethers.parseUnits("10", 18);
    const tx = await manager.createBatch(maxMintable, mintPrice, { gasLimit: 500000 });
    console.log("   Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("   ✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Check if currentBatchId getter works now
    console.log("\n📊 After createBatch:");
    try {
      const batchId = await manager.currentBatchId();
      console.log("  ✅ currentBatchId:", batchId.toString());
    } catch (e: any) {
      console.log("  ❌ currentBatchId still fails:", e.message.slice(0, 100));
    }
    
    // Check storage slot
    const slot14 = await ethers.provider.getStorage(PROXY_ADDRESS, 14);
    console.log("  Slot 14 value:", slot14, "=", BigInt(slot14).toString());
    
  } catch (error: any) {
    console.log("❌ createBatch failed:", error.message.slice(0, 150));
    if (error.data) {
      console.log("   Data:", error.data.slice(0, 20), "...");
    }
    
    // Try to decode the error
    try {
      const iface = new ethers.Interface(["function currentBatchId() view returns (uint256)"]);
      const data = iface.encodeFunctionData("currentBatchId", []);
      console.log("\n🔍 Testing direct getter call with detailed trace:");
      const result = await ethers.provider.call({
        to: PROXY_ADDRESS,
        data,
        gasLimit: 100000
      });
      console.log("   Result:", result);
    } catch (e: any) {
      console.log("   Direct call also fails:", e.message.slice(0, 100));
    }
  }
  
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  });

