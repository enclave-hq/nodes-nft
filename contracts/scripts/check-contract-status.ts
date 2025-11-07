import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x247EB977A797C7F8F982325C9aF708DD45619438";
  
  console.log("🔍 Checking NFTManager Contract Status\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  try {
    // Check owner
    const owner = await manager.owner();
    console.log("✅ Contract Owner:", owner);
    console.log("✅ Deployer Address:", deployer.address);
    console.log("✅ Is Deployer Owner?", owner.toLowerCase() === deployer.address.toLowerCase());
    console.log("");
    
    // Check whitelist count (try direct call)
    try {
      const whitelistCount = await manager.whitelistCount();
      console.log("✅ Whitelist Count:", whitelistCount.toString());
    } catch (error: any) {
      console.log("⚠️  Whitelist Count error:", error.message);
    }
    console.log("");
    
    // Check current batch
    try {
      const currentBatchId = await manager.currentBatchId();
      console.log("✅ Current Batch ID:", currentBatchId.toString());
      
      try {
        const activeBatchId = await manager.getActiveBatch();
        console.log("✅ Active Batch ID:", activeBatchId.toString());
      } catch (error: any) {
        console.log("⚠️  getActiveBatch error:", error.message);
      }
      
      // Check batch 1
      if (currentBatchId > 0n) {
        try {
          const batch1 = await manager.batches(1);
          console.log("✅ Batch 1:", {
            batchId: batch1.batchId.toString(),
            maxMintable: batch1.maxMintable.toString(),
            currentMinted: batch1.currentMinted.toString(),
            mintPrice: ethers.formatUnits(batch1.mintPrice, 18),
            active: batch1.active
          });
        } catch (error: any) {
          console.log("⚠️  Batch 1 error:", error.message);
        }
      }
    } catch (error: any) {
      console.log("⚠️  Batch error:", error.message);
    }
    
    console.log("");
    
    // Check total minted
    try {
      const totalMinted = await manager.totalMinted();
      console.log("✅ Total Minted:", totalMinted.toString());
    } catch (error: any) {
      console.log("⚠️  Total Minted error:", error.message);
    }
    
    // Check transfers enabled
    try {
      const transfersEnabled = await manager.transfersEnabled();
      console.log("✅ Transfers Enabled:", transfersEnabled);
    } catch (error: any) {
      console.log("⚠️  Transfers Enabled error:", error.message);
    }
    
    // Check oracle
    try {
      const oracle = await manager.oracle();
      console.log("✅ Oracle:", oracle);
    } catch (error: any) {
      console.log("⚠️  Oracle error:", error.message);
    }
    
    // Check global state (try individual fields)
    try {
      const totalActiveNFTs = await manager["globalState()"] ? await manager["globalState()"]() : null;
      if (totalActiveNFTs) {
        console.log("✅ Global State (struct):", totalActiveNFTs);
      } else {
        // Try reading individual fields
        console.log("⚠️  Cannot read globalState struct directly");
      }
    } catch (error: any) {
      console.log("⚠️  Global State error:", error.message);
      // Try reading via storage slot (if needed)
      console.log("   Note: This might be a storage layout issue");
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.data) {
      console.error("   Data:", error.data);
    }
  }
  
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Check failed:");
    console.error(error);
    process.exit(1);
  });

