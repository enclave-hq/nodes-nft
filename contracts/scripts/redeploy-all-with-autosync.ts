import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Re-deploying NodeNFT and NFTManager with Auto-Sync Feature\n");
  console.log("=".repeat(70));
  console.log("⚠️  WARNING: This will deploy NEW contracts!");
  console.log("   All existing NFTs will remain in the OLD contracts.");
  console.log("   This is a fresh start with auto-sync functionality.\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get contract addresses from environment
  const ECLV_TOKEN_ADDRESS = process.env.ECLV_TOKEN_ADDRESS || process.env.$E_ADDRESS;
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;

  if (!ECLV_TOKEN_ADDRESS || !USDT_ADDRESS) {
    throw new Error("❌ Please set ECLV_TOKEN_ADDRESS (or $E_ADDRESS) and USDT_ADDRESS in .env file");
  }

  console.log("Using addresses:");
  console.log("  EnclaveToken:", ECLV_TOKEN_ADDRESS);
  console.log("  USDT:", USDT_ADDRESS);
  console.log("  Oracle:", ORACLE_ADDRESS);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("");

  // Step 1: Deploy new NodeNFT (with auto-sync feature)
  console.log("📦 Step 1: Deploying new NodeNFT (with auto-sync)...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nodeNFTAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nodeNFTAddress);

  // Step 2: Deploy new NFTManager (Upgradeable)
  console.log("\n📦 Step 2: Deploying new NFTManager (Upgradeable UUPS Proxy)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [nodeNFTAddress, ECLV_TOKEN_ADDRESS, USDT_ADDRESS, ORACLE_ADDRESS, TREASURY_ADDRESS],
    { initializer: "initialize", kind: "uups" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager Proxy deployed to:", managerAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
  console.log("✅ NFTManager Implementation:", implAddress);

  // Step 3: Set NFTManager in NodeNFT
  console.log("\n📝 Step 3: Setting NFTManager in NodeNFT...");
  const setManagerTx = await nodeNFT.setNFTManager(managerAddress);
  await setManagerTx.wait();
  console.log("✅ NFTManager set in NodeNFT");
  console.log("   Transaction hash:", setManagerTx.hash);

  // Step 4: Verify the setup
  console.log("\n🔍 Step 4: Verifying deployment...");
  try {
    const owner = await nftManager.owner();
    console.log("✅ NFTManager Owner:", owner);
    
    const nodeNFTFromManager = await nftManager.nodeNFT();
    console.log("✅ NodeNFT address in NFTManager:", nodeNFTFromManager);
    if (nodeNFTFromManager.toLowerCase() !== nodeNFTAddress.toLowerCase()) {
      throw new Error("NodeNFT address mismatch!");
    }
    
    const nftManagerFromNFT = await nodeNFT.nftManager();
    console.log("✅ NFTManager address in NodeNFT:", nftManagerFromNFT);
    if (nftManagerFromNFT.toLowerCase() !== managerAddress.toLowerCase()) {
      throw new Error("NFTManager address mismatch!");
    }
    
    const eclvToken = await nftManager.eclvToken();
    console.log("✅ EnclaveToken address:", eclvToken);
    
    const usdtToken = await nftManager.usdtToken();
    console.log("✅ USDT address:", usdtToken);
    
    console.log("\n✅ All verifications passed!");
  } catch (error: any) {
    console.log("❌ Verification failed:", error.message);
    throw error;
  }

  // Step 5: Add USDT as reward token (if not already added)
  console.log("\n📝 Step 5: Adding USDT as reward token...");
  try {
    const isRewardToken = await nftManager.isRewardToken(USDT_ADDRESS);
    if (!isRewardToken) {
      const addRewardTx = await nftManager.addRewardToken(USDT_ADDRESS);
      await addRewardTx.wait();
      console.log("✅ USDT added as reward token");
      console.log("   Transaction hash:", addRewardTx.hash);
    } else {
      console.log("✅ USDT already added as reward token");
    }
  } catch (error: any) {
    console.log("⚠️  Warning: Could not add USDT as reward token -", error.message);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 RE-DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 New Contract Addresses:");
  console.log("─".repeat(70));
  console.log("NodeNFT:                    ", nodeNFTAddress);
  console.log("NFTManager (Proxy):         ", managerAddress);
  console.log("NFTManager (Implementation):", implAddress);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "bscTestnet" : network.name;
  const explorerBase = networkName.includes("testnet") 
    ? "https://testnet.bscscan.com" 
    : "https://bscscan.com";
  console.log("NodeNFT:       ", `${explorerBase}/address/${nodeNFTAddress}`);
  console.log("Proxy:         ", `${explorerBase}/address/${managerAddress}`);
  console.log("Implementation:", `${explorerBase}/address/${implAddress}`);

  console.log("\n💾 Update your .env files:");
  console.log("─".repeat(70));
  console.log("# Contracts");
  console.log(`NODE_NFT_ADDRESS=${nodeNFTAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nodeNFTAddress}`);
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);

  console.log("\n💡 Next Steps:");
  console.log("─".repeat(70));
  console.log("1. Update frontend .env file with new addresses");
  console.log("2. Update backend .env file with new addresses");
  console.log("3. Update ABI files in frontend and backend");
  console.log("4. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network ${networkName} ${nodeNFTAddress} "Enclave Node NFT" "ENFT"`);
  console.log(`   npx hardhat verify --network ${networkName} ${implAddress}`);

  console.log("\n⚠️  IMPORTANT NOTES:");
  console.log("─".repeat(70));
  console.log("1. This is a FRESH deployment - no existing NFT data");
  console.log("2. Auto-sync feature is enabled (NodeNFT._update calls NFTManager.onNFTTransfer)");
  console.log("3. All new NFTs minted will automatically sync userNFTList");
  console.log("4. Old contracts remain unchanged with existing NFTs");

  // Update DEPLOYMENT_RESULTS.md if it exists
  const deploymentResultsPath = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
  if (fs.existsSync(deploymentResultsPath)) {
    try {
      let content = fs.readFileSync(deploymentResultsPath, "utf-8");
      const date = new Date().toISOString().split("T")[0];
      
      // Update NodeNFT address
      content = content.replace(
        /NodeNFT:\s*0x[a-fA-F0-9]{40}/g,
        `NodeNFT: ${nodeNFTAddress}`
      );
      
      // Update NFTManager Proxy address
      content = content.replace(
        /NFTManager \(Proxy\):\s*0x[a-fA-F0-9]{40}/g,
        `NFTManager (Proxy): ${managerAddress}`
      );
      
      // Update NFTManager Implementation address
      content = content.replace(
        /NFTManager \(Implementation\):\s*0x[a-fA-F0-9]{40}/g,
        `NFTManager (Implementation): ${implAddress}`
      );
      
      // Update date
      content = content.replace(
        /Last Updated:.*/g,
        `Last Updated: ${date}`
      );
      
      fs.writeFileSync(deploymentResultsPath, content, "utf-8");
      console.log("\n✅ Updated DEPLOYMENT_RESULTS.md");
    } catch (error: any) {
      console.log("\n⚠️  Could not update DEPLOYMENT_RESULTS.md:", error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

