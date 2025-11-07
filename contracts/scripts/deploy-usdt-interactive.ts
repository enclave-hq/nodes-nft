import { ethers } from "hardhat";
import * as readline from "readline";

/**
 * Interactive deployment script for TestUSDT
 * Prompts user to enter private key securely (not stored in .env)
 */

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("🚀 Interactive TestUSDT Deployment\n");
  console.log("⚠️  WARNING: This will deploy to BSC Mainnet!");
  console.log("⚠️  Make sure you have sufficient BNB for gas fees.\n");

  // Get network
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  if (network.chainId !== 56n) {
    const proceed = await question("\n⚠️  Not on BSC Mainnet. Continue? (yes/no): ");
    if (proceed.toLowerCase() !== "yes") {
      console.log("Deployment cancelled.");
      rl.close();
      process.exit(0);
    }
  }

  // Get private key from user
  console.log("\n📝 Enter your private key (with or without 0x prefix):");
  console.log("⚠️  Your private key will NOT be saved to .env file");
  console.log("⚠️  It will only be used for this deployment session\n");
  
  const privateKeyInput = await question("Private Key: ");
  
  // Clean private key (remove 0x if present)
  let privateKey = privateKeyInput.trim();
  if (privateKey.startsWith("0x")) {
    privateKey = privateKey.slice(2);
  }
  
  if (!privateKey || privateKey.length < 64) {
    console.error("❌ Invalid private key! Must be 64 hex characters.");
    rl.close();
    process.exit(1);
  }

  // Create wallet from private key
  let deployer: ethers.Wallet;
  try {
    const provider = ethers.provider;
    deployer = new ethers.Wallet(`0x${privateKey}`, provider);
    console.log(`\n✅ Deployer address: ${deployer.address}`);
    console.log(`   (Derived from provided private key)`);
  } catch (error) {
    console.error("❌ Failed to create wallet from private key:", error);
    rl.close();
    process.exit(1);
  }

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BNB`);

  if (balance < ethers.parseEther("0.01")) {
    console.error("\n❌ Insufficient BNB balance! Need at least 0.01 BNB for deployment.");
    console.error("Please transfer BNB to:", deployer.address);
    rl.close();
    process.exit(1);
  }

  // Confirm deployment
  const confirm = await question("\n⚠️  Confirm deployment? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Deployment cancelled.");
    rl.close();
    process.exit(0);
  }

  // Deploy Test USDT
  console.log("\n📝 Deploying TestUSDT contract...");
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const usdt = await TestUSDT.connect(deployer).deploy();
  await usdt.waitForDeployment();

  const usdtAddress = await usdt.getAddress();
  console.log("✅ Test USDT deployed to:", usdtAddress);
  console.log("   Transaction hash:", (await usdt.deploymentTransaction())?.hash);

  // Mint 100 million USDT to deployer
  console.log("\n💰 Minting 100 million USDT to deployer...");
  const mintAmount = ethers.parseUnits("100000000", 18); // 100 million USDT
  const mintTx = await usdt.connect(deployer).mint(deployer.address, mintAmount);
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
  console.log(`   npx hardhat verify --network bscMainnet ${usdtAddress}`);
  console.log("3. Run the main deployment:");
  console.log("   npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet");

  console.log("\n🔍 View on BSCScan:");
  console.log(`https://bscscan.com/address/${usdtAddress}`);

  rl.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    rl.close();
    process.exit(1);
  });
