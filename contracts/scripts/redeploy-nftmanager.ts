import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Re-deploying NFTManager Proxy and Implementation\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get contract addresses from environment
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS;
  const ECLV_TOKEN_ADDRESS = process.env.ECLV_TOKEN_ADDRESS || process.env.$E_ADDRESS;
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;

  if (!NODE_NFT_ADDRESS || !ECLV_TOKEN_ADDRESS || !USDT_ADDRESS) {
    throw new Error("❌ Please set NODE_NFT_ADDRESS, ECLV_TOKEN_ADDRESS (or $E_ADDRESS), and USDT_ADDRESS in .env file");
  }

  console.log("Using addresses:");
  console.log("  NodeNFT:", NODE_NFT_ADDRESS);
  console.log("  EnclaveToken:", ECLV_TOKEN_ADDRESS);
  console.log("  USDT:", USDT_ADDRESS);
  console.log("  Oracle:", ORACLE_ADDRESS);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("");

  // Deploy NFTManager (Upgradeable)
  console.log("📦 Deploying NFTManager (Upgradeable UUPS Proxy)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [NODE_NFT_ADDRESS, ECLV_TOKEN_ADDRESS, USDT_ADDRESS, ORACLE_ADDRESS, TREASURY_ADDRESS],
    { initializer: "initialize", kind: "uups" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager Proxy deployed to:", managerAddress);

  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
  console.log("✅ NFTManager Implementation:", implAddress);

  // Verify the deployment
  try {
    const owner = await nftManager.owner();
    console.log("✅ Owner verification:", owner);
    
    const nodeNFT = await nftManager.nodeNFT();
    console.log("✅ NodeNFT address:", nodeNFT);
    
    const eclvToken = await nftManager.eclvToken();
    console.log("✅ EnclaveToken address:", eclvToken);
    
    const usdtToken = await nftManager.usdtToken();
    console.log("✅ USDT address:", usdtToken);
  } catch (error: any) {
    console.log("⚠️  Warning: Could not verify deployment -", error.message);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 RE-DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 New Contract Addresses:");
  console.log("─".repeat(70));
  console.log("NFTManager (Proxy):      ", managerAddress);
  console.log("NFTManager (Implementation):", implAddress);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "bscTestnet" : network.name;
  const explorerBase = networkName.includes("testnet") 
    ? "https://testnet.bscscan.com" 
    : "https://bscscan.com";
  console.log("Proxy:       ", `${explorerBase}/address/${managerAddress}`);
  console.log("Implementation:", `${explorerBase}/address/${implAddress}`);

  console.log("\n💾 Update your .env file:");
  console.log("─".repeat(70));
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);

  console.log("\n💡 Next Steps:");
  console.log("─".repeat(70));
  console.log("1. Update NodeNFT contract to point to new NFTManager:");
  console.log(`   npx hardhat run scripts/set-nft-manager.ts --network ${networkName}`);
  console.log("\n2. Verify the new implementation on BSCScan:");
  console.log(`   npx hardhat verify --network ${networkName} ${implAddress}`);
  console.log("\n3. Update DEPLOYMENT_RESULTS.md with the new addresses");
  console.log("\n4. Test the contract functions to ensure everything works");

  // Update DEPLOYMENT_RESULTS.md if it exists
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      
      // Update proxy address
      const proxyPattern = /(\*\*NFTManager \(Proxy\)\*\* \| ✅ Deployed \| )`0x[a-fA-F0-9]+`/;
      if (proxyPattern.test(content)) {
        content = content.replace(proxyPattern, `$1\`${managerAddress}\``);
        console.log("\n✅ Updated DEPLOYMENT_RESULTS.md with new proxy address");
      }
      
      // Update implementation address
      const implPattern = /(\*\*NFTManager \(Implementation\)\*\* \| ✅ Deployed \| )`0x[a-fA-F0-9]+`/;
      if (implPattern.test(content)) {
        content = content.replace(implPattern, `$1\`${implAddress}\``);
        console.log("✅ Updated DEPLOYMENT_RESULTS.md with new implementation address");
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
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

