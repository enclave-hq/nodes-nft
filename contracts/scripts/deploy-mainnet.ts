import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Mainnet Deployment Script for BSC
 * 
 * This script deploys:
 * 1. EnclaveToken ($E) - ERC20 token
 * 2. NodeNFT - ERC721 NFT contract
 * 3. NFTManager - Upgradeable UUPS proxy contract
 * 
 * Prerequisites:
 * - Set USDT_ADDRESS in .env (BSC mainnet USDT: 0x55d398326f99059fF775485246999027B3197955)
 * - Set PRIVATE_KEY in .env (deployer wallet with BNB for gas)
 * - Set BSC_MAINNET_RPC_URL in .env
 * - Set BSCSCAN_API_KEY in .env (for verification)
 */
async function main() {
  console.log("🚀 Deploying Contracts to BSC Mainnet...\n");
  console.log("⚠️  WARNING: This is a MAINNET deployment!");
  console.log("⚠️  Make sure you have verified all configurations!\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Check if we have enough balance
  if (balance < ethers.parseEther("0.1")) {
    throw new Error("❌ Insufficient BNB balance! Need at least 0.1 BNB for deployment.");
  }

  // Get USDT address from environment (BSC mainnet USDT)
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955";
  if (!USDT_ADDRESS || USDT_ADDRESS === "") {
    throw new Error("❌ Please set USDT_ADDRESS in .env file");
  }
  console.log("Using USDT:", USDT_ADDRESS);
  console.log("⚠️  Verify this is the correct BSC mainnet USDT address!\n");

  // Get Oracle and Treasury addresses (default to deployer for now)
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("⚠️  You can change these later via setOracle() and setTreasury()\n");

  // Confirm deployment
  console.log("=".repeat(70));
  console.log("📋 Deployment Configuration:");
  console.log("=".repeat(70));
  console.log("Network: BSC Mainnet (Chain ID: 56)");
  console.log("Deployer:", deployer.address);
  console.log("USDT:", USDT_ADDRESS);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("=".repeat(70));
  console.log("\n⏳ Starting deployment in 3 seconds...\n");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 1. Deploy EnclaveToken
  console.log("1️⃣  Deploying EnclaveToken ($E)...");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const eclvToken = await EnclaveToken.deploy();
  await eclvToken.waitForDeployment();
  const eclvAddress = await eclvToken.getAddress();
  console.log("✅ EnclaveToken deployed to:", eclvAddress);
  
  const totalSupply = await eclvToken.totalSupply();
  console.log("   Total supply:", ethers.formatEther(totalSupply), "$E");
  console.log("   Transaction hash:", (await eclvToken.deploymentTransaction())?.hash);

  // 2. Deploy NodeNFT
  console.log("\n2️⃣  Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nftAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nftAddress);
  console.log("   Transaction hash:", (await nodeNFT.deploymentTransaction())?.hash);

  // 3. Deploy NFTManager (Upgradeable UUPS Proxy)
  console.log("\n3️⃣  Deploying NFTManager (Upgradeable UUPS Proxy)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [
      nftAddress,        // nodeNFT address
      eclvAddress,       // eclvToken address
      USDT_ADDRESS,     // usdtToken address
      ORACLE_ADDRESS,    // oracle address
      TREASURY_ADDRESS,  // treasury address
    ],
    { 
      initializer: "initialize", 
      kind: "uups",
      timeout: 600000, // 10 minutes timeout for mainnet
    }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager (Proxy) deployed to:", managerAddress);
  
  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
  console.log("✅ NFTManager (Implementation) deployed to:", implementationAddress);
  console.log("   Transaction hash:", (await nftManager.deploymentTransaction())?.hash);

  // 4. Set NFTManager in NodeNFT
  console.log("\n4️⃣  Configuring NodeNFT...");
  const tx1 = await nodeNFT.setNFTManager(managerAddress);
  await tx1.wait();
  console.log("✅ NFTManager set in NodeNFT");
  console.log("   Transaction hash:", tx1.hash);

  // 5. Set Base URI (optional, using placeholder)
  const baseURI = process.env.BASE_URI || "https://api.enclave.com/nft/metadata/";
  const tx2 = await nodeNFT.setBaseURI(baseURI);
  await tx2.wait();
  console.log("✅ Base URI set:", baseURI);
  console.log("   Transaction hash:", tx2.hash);

  // 6. Add reward tokens
  console.log("\n5️⃣  Adding reward tokens...");
  try {
    const tx3 = await nftManager.addRewardToken(USDT_ADDRESS);
    await tx3.wait();
    console.log("✅ USDT added as reward token");
    console.log("   Transaction hash:", tx3.hash);
  } catch (error: any) {
    if (error.message.includes("Already added")) {
      console.log("✅ USDT already added as reward token");
    } else {
      throw error;
    }
  }

  // 7. Transfer initial $E to NFTManager (optional, for production distribution)
  if (process.env.INITIAL_ECLV_TRANSFER) {
    console.log("\n6️⃣  Setting up initial $E balance...");
    const initial$E = ethers.parseEther(process.env.INITIAL_ECLV_TRANSFER);
    const tx4 = await eclvToken.transfer(managerAddress, initial$E);
    await tx4.wait();
    console.log(`✅ Transferred ${ethers.formatEther(initial$E)} $E to NFTManager`);
    console.log("   Transaction hash:", tx4.hash);
  }

  // 8. Set Oracle (if not deployer)
  if (ORACLE_ADDRESS !== deployer.address) {
    console.log("\n7️⃣  Setting Oracle...");
    const tx5 = await nftManager.setOracle(ORACLE_ADDRESS);
    await tx5.wait();
    console.log("✅ Oracle set to:", ORACLE_ADDRESS);
    console.log("   Transaction hash:", tx5.hash);
  } else {
    console.log("\n7️⃣  Oracle set to deployer (can be changed later)");
  }

  // Print final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 Contract Addresses (SAVE THESE!):");
  console.log("─".repeat(70));
  console.log("EnclaveToken ($E): ", eclvAddress);
  console.log("NodeNFT:             ", nftAddress);
  console.log("NFTManager (Proxy): ", managerAddress);
  console.log("NFTManager (Impl):  ", implementationAddress);
  console.log("USDT:               ", USDT_ADDRESS);
  
  console.log("\n💾 Add these to contracts/.env:");
  console.log("─".repeat(70));
  console.log(`ECLV_ADDRESS=${eclvAddress}`);
  console.log(`NFT_ADDRESS=${nftAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);
  console.log(`MANAGER_IMPL_ADDRESS=${implementationAddress}`);
  console.log(`USDT_ADDRESS=${USDT_ADDRESS}`);

  console.log("\n💾 Add these to frontend/.env.local:");
  console.log("─".repeat(70));
  console.log(`NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${eclvAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=56`);
  console.log(`NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org`);

  console.log("\n💾 Add these to backend/.env:");
  console.log("─".repeat(70));
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`RPC_URL=https://bsc-dataseed1.binance.org`);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("EnclaveToken: https://bscscan.com/address/" + eclvAddress);
  console.log("NodeNFT:      https://bscscan.com/address/" + nftAddress);
  console.log("NFTManager:    https://bscscan.com/address/" + managerAddress);
  console.log("Implementation: https://bscscan.com/address/" + implementationAddress);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network bscMainnet ${eclvAddress}`);
  console.log(`   npx hardhat verify --network bscMainnet ${nftAddress} "Enclave Node NFT" "ENFT"`);
  console.log(`   npx hardhat verify --network bscMainnet ${implementationAddress}`);
  console.log("\n2. Verify proxy (if needed):");
  console.log(`   npx hardhat verify --network bscMainnet ${managerAddress}`);
  console.log("\n3. Update frontend and backend .env files");
  console.log("\n4. Test basic functionality on mainnet");
  console.log("\n5. Set up monitoring and alerts");
  
  console.log("\n⚠️  IMPORTANT REMINDERS:");
  console.log("─".repeat(70));
  console.log("- Save all addresses to a secure location");
  console.log("- Verify all contracts on BSCScan");
  console.log("- Update frontend and backend configurations");
  console.log("- Test thoroughly before allowing public access");
  console.log("- Monitor contract interactions and gas costs");

  // Update deployment date in DEPLOYMENT_RESULTS.md
  console.log("\n📝 Updating deployment date...");
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      let content = fs.readFileSync(resultsFile, "utf-8");
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g,
        `**Last Updated:** ${currentDate}`
      );
      fs.writeFileSync(resultsFile, content, "utf-8");
      console.log(`✅ Updated DEPLOYMENT_RESULTS.md date to ${currentDate}`);
    }
  } catch (error: any) {
    console.warn("⚠️  Failed to update deployment date:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

