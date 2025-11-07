import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x2252c4fC3D79120f001de5C33E5E82F1E56097c5";
  
  console.log("🔄 Reinitializing NFTManager Contract\n");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");
  
  // Get addresses from DEPLOYMENT_RESULTS.md or environment
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xe935d3484Fe7fD946720DDA19F82Ad7545Cfb56A";
  const ECLV_ADDRESS = process.env.ECLV_ADDRESS || "0xFdF36AF3d9126CcE3af16Cc3cDcDB7bb7e15138e";
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34";
  const ORACLE_ADDRESS = deployer.address; // Use deployer as oracle
  const TREASURY_ADDRESS = deployer.address; // Use deployer as treasury
  
  console.log("Configuration:");
  console.log("─".repeat(70));
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("NodeNFT:", NODE_NFT_ADDRESS);
  console.log("EnclaveToken:", ECLV_ADDRESS);
  console.log("USDT:", USDT_ADDRESS);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("");
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  // Check if already initialized by trying to read a variable
  try {
    const owner = await manager.owner();
    console.log("✅ Contract owner:", owner);
    
    // Try to read currentBatchId to see if initialization worked
    try {
      const batchId = await manager.currentBatchId();
      console.log("✅ currentBatchId:", batchId.toString());
      console.log("\n⚠️  Contract appears to be initialized, but some getters are failing.");
      console.log("    This might be a storage layout issue or getter function problem.");
      console.log("    Cannot reinitialize - initializer can only be called once.");
      return;
    } catch (error: any) {
      console.log("⚠️  currentBatchId getter failed - initialization may be incomplete");
    }
  } catch (error: any) {
    console.log("⚠️  Could not read owner - contract may not be initialized");
  }
  
  // Try to initialize (will fail if already initialized)
  console.log("\n🔄 Attempting to initialize contract...");
  try {
    const tx = await manager.initialize(
      NODE_NFT_ADDRESS,
      ECLV_ADDRESS,
      USDT_ADDRESS,
      ORACLE_ADDRESS,
      TREASURY_ADDRESS
    );
    console.log("   Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Initialization successful! Block:", receipt.blockNumber);
    
    // Verify initialization
    console.log("\n📋 Verifying initialization...");
    const owner = await manager.owner();
    console.log("✅ Owner:", owner);
    
    try {
      const batchId = await manager.currentBatchId();
      console.log("✅ currentBatchId:", batchId.toString());
    } catch (error: any) {
      console.log("❌ currentBatchId still fails:", error.message);
    }
    
    try {
      const nextOrderId = await manager.nextOrderId();
      console.log("✅ nextOrderId:", nextOrderId.toString());
    } catch (error: any) {
      console.log("❌ nextOrderId fails:", error.message);
    }
    
  } catch (error: any) {
    if (error.message.includes("Initializable: contract is already initialized")) {
      console.log("⚠️  Contract is already initialized");
      console.log("    Cannot reinitialize - this is expected behavior.");
      console.log("\n💡 The issue is likely with getter functions, not initialization.");
    } else {
      console.error("❌ Initialization failed:", error.message);
      if (error.data) {
        console.error("   Data:", error.data);
      }
    }
  }
  
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Reinitialize failed:");
    console.error(error);
    process.exit(1);
  });

