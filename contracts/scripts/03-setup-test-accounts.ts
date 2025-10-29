import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🧪 Setting up test accounts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Contract addresses from .env
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  
  if (!USDT_ADDRESS) {
    throw new Error("❌ Please set USDT_ADDRESS in .env");
  }

  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);

  // Test accounts (replace with actual addresses you want to fund)
  console.log("📝 Enter test account addresses:");
  console.log("   (You can edit this script to add your test wallet addresses)\n");

  const testAccounts = [
    // Add your test wallet addresses here
    // "0x1234567890123456789012345678901234567890", // Alice
    // "0x2345678901234567890123456789012345678901", // Bob
  ];

  if (testAccounts.length === 0) {
    console.log("⚠️  No test accounts configured.");
    console.log("Edit scripts/03-setup-test-accounts.ts to add wallet addresses.");
    return;
  }

  console.log("💰 Distributing test tokens...\n");
  
  for (let i = 0; i < testAccounts.length; i++) {
    const account = testAccounts[i];
    console.log(`Account ${i + 1}: ${account}`);
    
    try {
      // Give 100,000 USDT to each account
      const amount = ethers.parseUnits("100000", 18);
      const tx = await usdt.mint(account, amount);
      await tx.wait();
      
      const balance = await usdt.balanceOf(account);
      console.log(`✅ Minted ${ethers.formatUnits(balance, 18)} USDT\n`);
    } catch (error) {
      console.log(`❌ Failed to mint for ${account}`);
      console.error(error);
    }
  }

  console.log("=".repeat(60));
  console.log("✅ Test accounts setup complete!");
  console.log("=".repeat(60));
  console.log("\n💡 You can now use these accounts to test the dApp:");
  console.log("1. Import the accounts into MetaMask");
  console.log("2. Connect to BSC Testnet");
  console.log("3. Start testing minting, claiming, and marketplace features");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




