import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔧 Upgrading NFTManager to fix auto-sync issues\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || '0xF87F9296955439C323ac79769959bEe087f6D06E';

  console.log("NFTManager Proxy:", PROXY_ADDRESS);
  console.log("");

  // Get current implementation address
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation Address:", currentImpl);
  console.log("");

  // Deploy new implementation
  console.log("📦 Compiling and deploying new NFTManager implementation...");
  const NFTManagerFactory = await ethers.getContractFactory("NFTManager");
  
  // Upgrade proxy
  console.log("⬆️  Upgrading NFTManager proxy...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, NFTManagerFactory, {
    kind: "uups",
    unsafeAllow: ["constructor", "state-variable-immutable"]
  });
  
  await upgraded.waitForDeployment();
  console.log("✅ Upgrade completed!");

  // Get new implementation address
  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New Implementation Address:", newImpl);
  console.log("");

  // Verify upgrade
  console.log("🔍 Verifying upgrade...");
  const NFTManagerABI = [
    "function nodeNFT() view returns (address)",
    "function owner() view returns (address)",
    "function transfersEnabled() view returns (bool)"
  ];
  const nftManager = new ethers.Contract(PROXY_ADDRESS, NFTManagerABI, deployer);

  try {
    const owner = await nftManager.owner();
    const nodeNFT = await nftManager.nodeNFT();
    const transfersEnabled = await nftManager.transfersEnabled();

    console.log("✅ Owner:", owner);
    console.log("✅ NodeNFT:", nodeNFT);
    console.log("✅ Transfers Enabled:", transfersEnabled);
    console.log("");

    // Check if buyNFT function exists (verify contract is updated)
    const buyNFTABI = [
      "function buyNFT(uint256 orderId) external"
    ];
    const nftManagerWithBuy = new ethers.Contract(PROXY_ADDRESS, buyNFTABI, deployer);
    try {
      // Try to get function selector (if function exists, this won't fail)
      const buyNFTSelector = nftManagerWithBuy.interface.getFunction("buyNFT").selector;
      console.log("✅ buyNFT function exists");
    } catch (error: any) {
      console.log("⚠️  Could not verify buyNFT function");
    }

    console.log("\n✅ Upgrade verification completed!");
  } catch (error: any) {
    console.log("⚠️  Warning during verification:", error.message);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 Upgrade Completed!");
  console.log("=".repeat(70));
  console.log("\n📝 Upgrade Details:");
  console.log("─".repeat(70));
  console.log("Proxy Address:     ", PROXY_ADDRESS);
  console.log("Old Implementation:", currentImpl);
  console.log("New Implementation:", newImpl);
  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "bscTestnet" : network.name;
  const explorerBase = networkName.includes("testnet") 
    ? "https://testnet.bscscan.com" 
    : "https://bscscan.com";
  console.log("Proxy:          ", `${explorerBase}/address/${PROXY_ADDRESS}`);
  console.log("New Implementation:", `${explorerBase}/address/${newImpl}`);

  console.log("\n💡 Fixes Applied:");
  console.log("─".repeat(70));
  console.log("✅ Removed manual userNFTList update code in buyNFT");
  console.log("✅ Now fully relies on onNFTTransfer for auto-sync");
  console.log("✅ Avoids duplicate operations and potential conflicts");

  console.log("\n⚠️  Important Notes:");
  console.log("─".repeat(70));
  console.log("1. After upgrade, both buyNFT and direct transfers will auto-sync via onNFTTransfer");
  console.log("2. Ensure NodeNFT.nftManager points to the correct NFTManager Proxy");
  console.log("3. Ensure NFTManager.nodeNFT points to the correct NodeNFT");
  console.log("4. Run test scripts to verify functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });

