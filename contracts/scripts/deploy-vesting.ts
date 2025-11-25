import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * @notice Deploy TokenVesting contract and set up vesting schedules (Interactive)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-vesting.ts --network <network>
 */
async function main() {
  console.log("🚀 Deploying TokenVesting Contract (Interactive Mode)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH/BNB\n");

  // Get NFTManager address (config source) from environment
  let configSource = process.env.NFT_MANAGER_ADDRESS || process.env.MANAGER_ADDRESS || "";
  if (!configSource || configSource === "") {
    configSource = await askQuestion("Enter NFTManager Address (config source): ");
    if (!configSource || configSource === "") {
      throw new Error("❌ NFTManager address is required");
    }
  }
  console.log("✅ Config Source (NFTManager):", configSource);

  // Get multisig address for owner (interactive or from env)
  let MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;
  if (!MULTISIG_ADDRESS || MULTISIG_ADDRESS === "") {
    const input = await askQuestion(`Enter Owner/Multisig Address (press Enter to use deployer ${deployer.address}): `);
    MULTISIG_ADDRESS = input || deployer.address;
  }
  console.log("✅ Owner (Multisig):", MULTISIG_ADDRESS, "\n");

  // Deploy TokenVesting
  console.log("1️⃣  Deploying TokenVesting...");
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  // TokenVesting now takes configSource (NFTManager) and owner
  const vesting = await TokenVesting.deploy(configSource, MULTISIG_ADDRESS);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log("✅ TokenVesting deployed to:", vestingAddress);
  
  // Verify that TokenVesting read the correct token address from NFTManager
  const tokenAddress = await vesting.token();
  console.log("✅ Token address (from NFTManager):", tokenAddress);

  // Get TGE time from EnclaveToken (via NFTManager)
  console.log("\n2️⃣  Reading TGE time from EnclaveToken (via NFTManager)...");
  const tgeTime = await vesting.tgeTime();
  if (tgeTime > 0) {
    console.log("✅ TGE Time (from EnclaveToken):", tgeTime.toString(), "(" + new Date(Number(tgeTime) * 1000).toISOString() + ")");
  } else {
    console.log("⚠️  TGE Time not set in EnclaveToken yet");
    console.log("   Please set TGE time in EnclaveToken first using: EnclaveToken.setTGETime()");
    const continueInput = await askQuestion("Continue anyway? (y/n): ");
    if (continueInput.toLowerCase() !== "y") {
      throw new Error("Deployment cancelled - TGE time must be set first");
    }
  }

  // TGE time is now managed by EnclaveToken, no need to set it here
  // Verify TGE time is set
  const currentTgeTime = await vesting.tgeTime();
  if (currentTgeTime == 0) {
    console.log("⚠️  Warning: TGE time is not set in EnclaveToken");
    console.log("   Vesting schedules cannot be created until TGE time is set");
  }

  // Vesting schedule configuration
  // Based on TOKEN_DISTRIBUTION.md:
  // - Team: 1 year lock, 32 months release (10,000,000 $E)
  // - SAFT1: 1 year lock, 32 months release (6,000,000 $E)
  // - SAFT2: 6 months lock, 32 months release (4,000,000 $E)

  const ONE_MONTH = 30 * 24 * 60 * 60; // 30 days in seconds
  const ONE_YEAR = 365 * 24 * 60 * 60; // 365 days in seconds
  const SIX_MONTHS = 180 * 24 * 60 * 60; // 180 days in seconds

  const vestingSchedules = [
    {
      name: "Team",
      beneficiary: process.env.TEAM_BENEFICIARY || deployer.address,
      totalAmount: ethers.parseEther("10000000"), // 10,000,000 $E
      lockPeriod: ONE_YEAR,
      releaseDuration: 32 * ONE_MONTH, // 32 months
    },
    {
      name: "SAFT1",
      beneficiary: process.env.SAFT1_BENEFICIARY || deployer.address,
      totalAmount: ethers.parseEther("6000000"), // 6,000,000 $E
      lockPeriod: ONE_YEAR,
      releaseDuration: 32 * ONE_MONTH, // 32 months
    },
    {
      name: "SAFT2",
      beneficiary: process.env.SAFT2_BENEFICIARY || deployer.address,
      totalAmount: ethers.parseEther("4000000"), // 4,000,000 $E
      lockPeriod: SIX_MONTHS,
      releaseDuration: 32 * ONE_MONTH, // 32 months
    },
  ];

  // Check TGE time before creating schedules
  const currentTgeTime = await vesting.tgeTime();
  if (currentTgeTime == 0) {
    throw new Error("❌ TGE time must be set in EnclaveToken before creating vesting schedules");
  }

  console.log("\n3️⃣  Creating vesting schedules...");
  for (const schedule of vestingSchedules) {
    console.log(`   Creating schedule for ${schedule.name}:`);
    console.log(`     Beneficiary: ${schedule.beneficiary}`);
    console.log(`     Amount: ${ethers.formatEther(schedule.totalAmount)} $E`);
    console.log(`     Lock Period: ${schedule.lockPeriod / (24 * 60 * 60)} days`);
    console.log(`     Release Duration: ${schedule.releaseDuration / (24 * 60 * 60)} days`);

    const tx = await vesting.createVestingSchedule(
      schedule.beneficiary,
      schedule.totalAmount,
      schedule.lockPeriod,
      schedule.releaseDuration
    );
    await tx.wait();
    console.log(`   ✅ ${schedule.name} vesting schedule created\n`);
  }

  // Transfer tokens to vesting contract (if needed)
  if (process.env.TRANSFER_TOKENS === "true") {
    console.log("4️⃣  Transferring tokens to vesting contract...");
    const tokenAddress = await vesting.token();
    const token = await ethers.getContractAt("EnclaveToken", tokenAddress);
    const totalAmount = vestingSchedules.reduce(
      (sum, s) => sum + s.totalAmount,
      BigInt(0)
    );
    
    const balance = await token.balanceOf(deployer.address);
    if (balance < totalAmount) {
      throw new Error(`❌ Insufficient balance. Need ${ethers.formatEther(totalAmount)} $E, have ${ethers.formatEther(balance)} $E`);
    }

    const transferTx = await token.transfer(vestingAddress, totalAmount);
    await transferTx.wait();
    console.log(`✅ Transferred ${ethers.formatEther(totalAmount)} $E to vesting contract`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 Deployment Summary");
  console.log("=".repeat(60));
  console.log("TokenVesting Address:", vestingAddress);
  console.log("Config Source (NFTManager):", configSource);
  const tokenAddress = await vesting.token();
  console.log("Token Address (from NFTManager):", tokenAddress);
  console.log("Owner (Multisig):", MULTISIG_ADDRESS);
  const finalTgeTime = await vesting.tgeTime();
  if (finalTgeTime > 0) {
    console.log("TGE Time (from EnclaveToken):", finalTgeTime.toString(), "(" + new Date(Number(finalTgeTime) * 1000).toISOString() + ")");
  } else {
    console.log("TGE Time: Not set (must be set in EnclaveToken)");
  }
  console.log("\nVesting Schedules:");
  for (const schedule of vestingSchedules) {
    const startTime = Number(tgeTime) + Number(schedule.lockPeriod);
    const endTime = startTime + Number(schedule.releaseDuration);
    console.log(`  ${schedule.name}:`);
    console.log(`    Beneficiary: ${schedule.beneficiary}`);
    console.log(`    Amount: ${ethers.formatEther(schedule.totalAmount)} $E`);
    console.log(`    Start: ${new Date(startTime * 1000).toISOString()}`);
    console.log(`    End: ${new Date(endTime * 1000).toISOString()}`);
  }
  console.log("=".repeat(60));

  // Verify contract (if on testnet/mainnet)
  if (process.env.VERIFY_CONTRACT === "true") {
    console.log("\n5️⃣  Verifying contract on Etherscan...");
    try {
      const tokenAddress = await vesting.token();
      await hre.run("verify:verify", {
        address: vestingAddress,
        constructorArguments: [configSource, MULTISIG_ADDRESS],
      });
      console.log("✅ Contract verified");
    } catch (error) {
      console.log("⚠️  Verification failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



