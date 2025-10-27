import { ethers } from "hardhat";
import { upgrades } from "hardhat";

async function main() {
  console.log("🏠 LOCAL TESTING - Deploying All Contracts\n");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Deploy Test USDT
  console.log("1️⃣  Deploying TestUSDT...");
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const usdt = await TestUSDT.deploy();
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✅ TestUSDT:", usdtAddress);

  // 2. Deploy EnclaveToken
  console.log("\n2️⃣  Deploying EnclaveToken...");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const eclv = await EnclaveToken.deploy();
  await eclv.waitForDeployment();
  const eclvAddress = await eclv.getAddress();
  console.log("✅ EnclaveToken:", eclvAddress);

  // 3. Deploy NodeNFT
  console.log("\n3️⃣  Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nft = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ NodeNFT:", nftAddress);

  // 4. Deploy NFTManager
  console.log("\n4️⃣  Deploying NFTManager (Upgradeable)...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = await upgrades.deployProxy(
    NFTManager,
    [nftAddress, eclvAddress, usdtAddress, deployer.address, deployer.address], // oracle and treasury = deployer
    { initializer: "initialize", kind: "uups" }
  );
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("✅ NFTManager:", managerAddress);

  // 5. Configure
  console.log("\n5️⃣  Configuring contracts...");
  await nft.setNFTManager(managerAddress);
  console.log("✅ Set NFTManager in NodeNFT");

  await nft.setBaseURI("https://api.enclave.com/nft/metadata/");
  console.log("✅ Set Base URI");
  console.log("✅ USDT already added as reward token (in initialize)");

  // 6. Initialize balances
  console.log("\n6️⃣  Initializing balances...");
  const initial$E = ethers.parseEther("10000000"); // 10M $E
  await eclv.transfer(managerAddress, initial$E);
  console.log("✅ Transferred 10M $E to NFTManager");

  // 7. Setup test accounts with USDT
  console.log("\n7️⃣  Setting up test accounts...");
  const signers = await ethers.getSigners();
  const testAccounts = signers.slice(1, 4); // Alice, Bob, Charlie

  for (let i = 0; i < testAccounts.length; i++) {
    const account = testAccounts[i];
    const amount = ethers.parseUnits("100000", 18); // 100k USDT each
    await usdt.mint(account.address, amount);
    console.log(`✅ Minted 100k USDT to Account #${i + 1}: ${account.address}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL CONTRACTS DEPLOYED!");
  console.log("=".repeat(60));

  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(60));
  console.log("TestUSDT:     ", usdtAddress);
  console.log("EnclaveToken: ", eclvAddress);
  console.log("NodeNFT:      ", nftAddress);
  console.log("NFTManager:   ", managerAddress);

  console.log("\n👥 Test Accounts:");
  console.log("─".repeat(60));
  console.log("Deployer (Oracle): ", deployer.address);
  console.log("Alice (Account #1):", testAccounts[0].address);
  console.log("Bob   (Account #2):", testAccounts[1].address);
  console.log("Charlie (Acc #3):  ", testAccounts[2].address);

  console.log("\n💰 Balances:");
  console.log("─".repeat(60));
  console.log("NFTManager $E:", ethers.formatEther(await eclv.balanceOf(managerAddress)), "$E");
  for (let i = 0; i < testAccounts.length; i++) {
    const balance = await usdt.balanceOf(testAccounts[i].address);
    console.log(`Account #${i + 1} USDT: ${ethers.formatUnits(balance, 18)} USDT`);
  }

  console.log("\n✅ Ready for testing!");
  console.log("\n💡 Next steps:");
  console.log("  npx hardhat run scripts/local-02-test-mint.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

