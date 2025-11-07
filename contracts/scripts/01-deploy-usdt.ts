import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Test USDT...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Check if we have enough balance
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low balance! You may need more BNB for deployment.");
    console.warn("Get testnet BNB from: https://testnet.binance.org/faucet-smart\n");
  }

  // Deploy Test USDT (ERC20)
  console.log("📝 Deploying TestUSDT contract...");
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const usdt = await TestUSDT.deploy();
  await usdt.waitForDeployment();

  const usdtAddress = await usdt.getAddress();
  console.log("✅ Test USDT deployed to:", usdtAddress);

  // Mint 100 million USDT to deployer
  console.log("\n💰 Minting 100 million USDT to deployer...");
  const mintAmount = ethers.parseUnits("100000000", 18); // 100 million USDT
  const mintTx = await usdt.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("✅ Minted 100,000,000 USDT to:", deployer.address);
  console.log("   Transaction hash:", mintTx.hash);

  // Get total supply
  const totalSupply = await usdt.totalSupply();
  console.log("\n📊 Total supply:", ethers.formatUnits(totalSupply, 18), "USDT");
  
  // Get deployer balance
  const deployerBalance = await usdt.balanceOf(deployer.address);
  console.log("📊 Deployer balance:", ethers.formatUnits(deployerBalance, 18), "USDT");

  console.log("\n" + "=".repeat(60));
  console.log("✨ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📝 Save this address:");
  console.log("USDT_ADDRESS=" + usdtAddress);
  
  console.log("\n💡 Next steps:");
  console.log("1. Add USDT_ADDRESS to your .env file");
  console.log("2. Verify the contract on BSCScan:");
  console.log(`   npx hardhat verify --network bscTestnet ${usdtAddress}`);
  console.log("3. Run the main deployment:");
  console.log("   npx hardhat run scripts/02-deploy-main.ts --network bscTestnet");
  
  console.log("\n🔍 View on BSCScan:");
  console.log(`https://testnet.bscscan.com/address/${usdtAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


