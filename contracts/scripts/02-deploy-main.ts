import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  console.log("🚀 Deploying Main Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Get USDT address from environment
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  if (!USDT_ADDRESS || USDT_ADDRESS === "") {
    throw new Error("❌ Please set USDT_ADDRESS in .env file");
  }
  console.log("Using USDT:", USDT_ADDRESS, "\n");

  // 1. Deploy EnclaveToken
  console.log("1️⃣  Deploying EnclaveToken...");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  // EnclaveToken constructor requires treasury address
  const eclvToken = await EnclaveToken.deploy(deployer.address); // Use deployer as treasury
  await eclvToken.waitForDeployment();
  const eclvAddress = await eclvToken.getAddress();
  console.log("✅ EnclaveToken deployed to:", eclvAddress);
  
  const totalSupply = await eclvToken.totalSupply();
  console.log("   Total supply:", ethers.formatEther(totalSupply), "$E");

  // 2. Deploy NodeNFT
  console.log("\n2️⃣  Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nftAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nftAddress);

  // 3. Deploy NFTManager (Upgradeable)
  console.log("\n3️⃣  Deploying NFTManager (Upgradeable)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [nftAddress, eclvAddress, USDT_ADDRESS, deployer.address, deployer.address], // Add oracle and treasury parameters
    { initializer: "initialize", kind: "uups" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager deployed to:", managerAddress);
  
  // Get implementation address
  const implAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
  console.log("✅ NFTManager Implementation:", implAddress);

  // 4. Set NFTManager in NodeNFT
  console.log("\n4️⃣  Configuring NodeNFT...");
  const tx1 = await nodeNFT.setNFTManager(managerAddress);
  await tx1.wait();
  console.log("✅ NFTManager set in NodeNFT");

  // 5. Set Base URI (optional, using placeholder)
  const baseURI = "https://api.enclave.com/nft/metadata/";
  const tx2 = await nodeNFT.setBaseURI(baseURI);
  await tx2.wait();
  console.log("✅ Base URI set:", baseURI);

  // 6. Reward tokens (USDT is already added in initialize, so skip)
  console.log("\n5️⃣  Reward tokens...");
  console.log("✅ USDT is automatically added as reward token during initialization");

  // 7. Transfer some $E to NFTManager for production distribution
  console.log("\n6️⃣  Setting up initial $E balance...");
  const initial$E = ethers.parseEther("10000000"); // 10M $E
  const tx4 = await eclvToken.transfer(managerAddress, initial$E);
  await tx4.wait();
  console.log("✅ Transferred 10M $E to NFTManager");

  // 8. Set Oracle (using deployer for testing)
  console.log("\n7️⃣  Setting Oracle...");
  const tx5 = await nftManager.setOracle(deployer.address);
  await tx5.wait();
  console.log("✅ Oracle set to:", deployer.address);

  // Print final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(70));
  console.log("EnclaveToken ($E): ", eclvAddress);
  console.log("NodeNFT:             ", nftAddress);
  console.log("NFTManager (Proxy):  ", managerAddress);
  console.log("NFTManager (Impl):   ", implAddress);
  console.log("TestUSDT:            ", USDT_ADDRESS);
  
  console.log("\n💾 Add these to contracts/.env:");
  console.log("─".repeat(70));
  console.log(`$E_ADDRESS=${eclvAddress}`);
  console.log(`NFT_ADDRESS=${nftAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);

  console.log("\n💾 Add these to frontend/.env.local:");
  console.log("─".repeat(70));
  console.log(`NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${eclvAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=97`);
  console.log(`NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545`);
  console.log(`NEXT_PUBLIC_ENABLE_TESTNET=true`);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("EnclaveToken: https://testnet.bscscan.com/address/" + eclvAddress);
  console.log("NodeNFT:      https://testnet.bscscan.com/address/" + nftAddress);
  console.log("NFTManager:   https://testnet.bscscan.com/address/" + managerAddress);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network bscTestnet ${eclvAddress}`);
  console.log(`   npx hardhat verify --network bscTestnet ${nftAddress} "Enclave Node NFT" "ENFT"`);
  console.log(`   npx hardhat verify --network bscTestnet ${implAddress}`);
  console.log("\n2. Update DEPLOYMENT_RESULTS.md with new addresses");
  console.log("\n3. Update frontend .env.local and backend .env with new addresses");
  console.log("\n4. Run test scripts to verify functionality");
  
  // Update DEPLOYMENT_RESULTS.md with new addresses
  console.log("\n📝 Updating DEPLOYMENT_RESULTS.md...");
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      const currentDate = new Date().toISOString().split("T")[0];
      
      // Update EnclaveToken address
      content = content.replace(
        /(\*\*EnclaveToken \(\$E\)\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${eclvAddress}$2`
      );
      
      // Update NodeNFT address
      content = content.replace(
        /(\*\*NodeNFT\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${nftAddress}$2`
      );
      
      // Update NFTManager Proxy address
      content = content.replace(
        /(\*\*NFTManager \(Proxy\)\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${managerAddress}$2`
      );
      
      // Update NFTManager Implementation address
      content = content.replace(
        /(\*\*NFTManager \(Implementation\)\*\* \| ✅ Deployed \| `)0x[a-fA-F0-9]+(` \|)/i,
        `$1${implAddress}$2`
      );
      
      // Update detailed contract addresses
      content = content.replace(
        /(\*\*Address:\*\* `)0x[a-fA-F0-9]+(`\s+\*\*Network:\*\* BSC Testnet\s+\*\*Type:\*\* ERC20 Token\s+\*\*Symbol:\*\* \$E)/,
        `$1${eclvAddress}$2`
      );
      
      content = content.replace(
        /(\*\*Address:\*\* `)0x[a-fA-F0-9]+(`\s+\*\*Network:\*\* BSC Testnet\s+\*\*Type:\*\* ERC721 NFT)/,
        `$1${nftAddress}$2`
      );
      
      content = content.replace(
        /(\*\*Address:\*\* `)0x[a-fA-F0-9]+(`\s+\*\*Network:\*\* BSC Testnet\s+\*\*Type:\*\* UUPS Upgradeable Proxy)/,
        `$1${managerAddress}$2`
      );
      
      content = content.replace(
        /(\*\*Implementation Address:\*\* `)0x[a-fA-F0-9]+(`)/,
        `$1${implAddress}$2`
      );
      
      // Update BSCScan links
      content = content.replace(
        /(https:\/\/testnet\.bscscan\.com\/address\/)0x[a-fA-F0-9]+(\s+\*\*BSCScan:\*\*)/g,
        (match, prefix, suffix) => {
          if (match.includes('EnclaveToken')) {
            return `${prefix}${eclvAddress}${suffix}`;
          } else if (match.includes('NodeNFT')) {
            return `${prefix}${nftAddress}${suffix}`;
          } else if (match.includes('NFTManager') && !match.includes('Implementation')) {
            return `${prefix}${managerAddress}${suffix}`;
          }
          return match;
        }
      );
      
      // Update implementation BSCScan link
      content = content.replace(
        /(\*\*BSCScan:\*\* https:\/\/testnet\.bscscan\.com\/address\/)0x[a-fA-F0-9]+(\s+---)/,
        `$1${implAddress}$2`
      );
      
      // Update environment variable examples
      content = content.replace(
        /(ECLV_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${eclvAddress}`
      );
      
      content = content.replace(
        /(NFT_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${nftAddress}`
      );
      
      content = content.replace(
        /(MANAGER_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${managerAddress}`
      );
      
      content = content.replace(
        /(NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${eclvAddress}`
      );
      
      content = content.replace(
        /(NEXT_PUBLIC_NODE_NFT_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${nftAddress}`
      );
      
      content = content.replace(
        /(NEXT_PUBLIC_NFT_MANAGER_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${managerAddress}`
      );
      
      // Update NFT_MANAGER_ADDRESS in backend section
      content = content.replace(
        /(NFT_MANAGER_ADDRESS=)0x[a-fA-F0-9]+/,
        `$1${managerAddress}`
      );
      
      // Update date
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g,
        `**Last Updated:** ${currentDate}`
      );
      
      fs.writeFileSync(resultsFile, content, "utf-8");
      console.log(`✅ Updated DEPLOYMENT_RESULTS.md with new addresses and date ${currentDate}`);
    }
  } catch (error: any) {
    console.warn("⚠️  Failed to update DEPLOYMENT_RESULTS.md:", error.message);
  }

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




