import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

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
  const eclvToken = await EnclaveToken.deploy();
  await eclvToken.waitForDeployment();
  const eclvAddress = await eclvToken.getAddress();
  console.log("✅ EnclaveToken deployed to:", eclvAddress);
  
  const totalSupply = await eclvToken.totalSupply();
  console.log("   Total supply:", ethers.formatEther(totalSupply), "$E");

  // 2. Deploy NodeNFT
  console.log("\n2️⃣  Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy();
  await nodeNFT.waitForDeployment();
  const nftAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT deployed to:", nftAddress);

  // 3. Deploy NFTManager (Upgradeable)
  console.log("\n3️⃣  Deploying NFTManager (Upgradeable)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await upgrades.deployProxy(
    NFTManager,
    [nftAddress, eclvAddress, USDT_ADDRESS],
    { initializer: "initialize", kind: "uups" }
  );
  await nftManager.waitForDeployment();
  const managerAddress = await nftManager.getAddress();
  console.log("✅ NFTManager deployed to:", managerAddress);

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

  // 6. Add reward tokens
  console.log("\n5️⃣  Adding reward tokens...");
  const tx3 = await nftManager.addRewardToken(USDT_ADDRESS);
  await tx3.wait();
  console.log("✅ USDT added as reward token");

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
  console.log("NFTManager:          ", managerAddress);
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
  console.log(`   npx hardhat verify --network bscTestnet ${nftAddress}`);
  console.log(`   npx hardhat verify --network bscTestnet ${managerAddress}`);
  console.log("\n2. Run test scripts to verify functionality");
  console.log("\n3. Update frontend .env.local and start testing");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });


