import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Re-deploying NFTManager Proxy and NodeNFT Contracts\n");
  console.log("=".repeat(70));
  console.log("⚠️  WARNING: This will deploy NEW contracts!");
  console.log("⚠️  Existing NFTs in old NodeNFT will NOT be migrated!");
  console.log("=".repeat(70));
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get required addresses from environment
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  if (!USDT_ADDRESS || USDT_ADDRESS === "") {
    throw new Error("❌ Please set USDT_ADDRESS in .env file");
  }
  console.log("Using USDT:", USDT_ADDRESS, "\n");

  // Get EnclaveToken address (or deploy new one)
  let ECLV_ADDRESS = process.env.ECLV_ADDRESS || process.env.$E_ADDRESS;
  if (!ECLV_ADDRESS || ECLV_ADDRESS === "") {
    console.log("⚠️  ECLV_ADDRESS not set, deploying new EnclaveToken...");
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    const eclvToken = await EnclaveToken.deploy(deployer.address);
    await eclvToken.waitForDeployment();
    ECLV_ADDRESS = await eclvToken.getAddress();
    console.log("✅ EnclaveToken deployed to:", ECLV_ADDRESS);
  } else {
    console.log("Using existing EnclaveToken:", ECLV_ADDRESS);
  }

  // 1. Deploy NEW NodeNFT
  console.log("\n1️⃣  Deploying NEW NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nodeNFTAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nodeNFTAddress);

  // 2. Deploy NEW NFTManager Proxy
  console.log("\n2️⃣  Deploying NEW NFTManager (Upgradeable Proxy)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [nodeNFTAddress, ECLV_ADDRESS, USDT_ADDRESS, deployer.address, deployer.address],
    { initializer: "initialize", kind: "uups" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager Proxy deployed to:", managerAddress);
  
  const implAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
  console.log("✅ NFTManager Implementation:", implAddress);

  // 3. Configure NodeNFT
  console.log("\n3️⃣  Configuring NodeNFT...");
  const tx1 = await nodeNFT.setNFTManager(managerAddress);
  await tx1.wait();
  console.log("✅ NFTManager set in NodeNFT");

  const baseURI = "https://api.enclave.com/nft/metadata/";
  const tx2 = await nodeNFT.setBaseURI(baseURI);
  await tx2.wait();
  console.log("✅ Base URI set:", baseURI);

  // 4. Transfer $E to NFTManager (optional)
  if (ECLV_ADDRESS) {
    console.log("\n4️⃣  Setting up initial $E balance...");
    try {
      const eclvToken = await ethers.getContractAt("EnclaveToken", ECLV_ADDRESS);
      const initial$E = ethers.parseEther("10000000"); // 10M $E
      const tx4 = await eclvToken.transfer(managerAddress, initial$E);
      await tx4.wait();
      console.log("✅ Transferred 10M $E to NFTManager");
    } catch (error: any) {
      console.log("⚠️  Could not transfer $E:", error.message);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 RE-DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 NEW Contract Addresses:");
  console.log("─".repeat(70));
  console.log("NodeNFT:             ", nodeNFTAddress);
  console.log("NFTManager (Proxy):  ", managerAddress);
  console.log("NFTManager (Impl):   ", implAddress);
  console.log("EnclaveToken ($E):   ", ECLV_ADDRESS);
  console.log("USDT:                ", USDT_ADDRESS);
  
  console.log("\n💾 Update contracts/.env:");
  console.log("─".repeat(70));
  console.log(`NFT_ADDRESS=${nodeNFTAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  if (!process.env.ECLV_ADDRESS) {
    console.log(`ECLV_ADDRESS=${ECLV_ADDRESS}`);
  }
  
  console.log("\n💾 Update backend/.env:");
  console.log("─".repeat(70));
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NODE_NFT_ADDRESS=${nodeNFTAddress}`);
  
  console.log("\n💾 Update frontend/.env.local:");
  console.log("─".repeat(70));
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nodeNFTAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${ECLV_ADDRESS}`);
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("NodeNFT:      https://testnet.bscscan.com/address/" + nodeNFTAddress);
  console.log("NFTManager:   https://testnet.bscscan.com/address/" + managerAddress);
  console.log("Implementation: https://testnet.bscscan.com/address/" + implAddress);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Update all .env files with new addresses");
  console.log("2. Verify contracts on BSCScan");
  console.log("3. Test the new contracts");
  console.log("4. ⚠️  Old NFTs in previous NodeNFT will NOT be accessible!");
  
  // Update DEPLOYMENT_RESULTS.md
  console.log("\n📝 Updating DEPLOYMENT_RESULTS.md...");
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      const currentDate = new Date().toISOString().split("T")[0];
      
      // Update addresses
      content = content.replace(
        /(\*\*NodeNFT\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${nodeNFTAddress}$2`
      );
      
      content = content.replace(
        /(\*\*NFTManager \(Proxy\)\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${managerAddress}$2`
      );
      
      content = content.replace(
        /(\*\*NFTManager \(Implementation\)\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${implAddress}$2`
      );
      
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g,
        `**Last Updated:** ${currentDate}`
      );
      
      fs.writeFileSync(resultsFile, content, "utf-8");
      console.log(`✅ Updated DEPLOYMENT_RESULTS.md`);
    }
  } catch (error: any) {
    console.warn("⚠️  Failed to update DEPLOYMENT_RESULTS.md:", error.message);
  }

  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Re-deployment failed:");
    console.error(error);
    process.exit(1);
  });








