import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * @notice Deploy TokenVesting contract and set up vesting schedules
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-vesting.ts --network <network>
 */
async function main() {
  console.log("🚀 Deploying TokenVesting Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH/BNB\n");

  // Get token address from environment or use default
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || process.env.ENCLAVE_TOKEN_ADDRESS;
  if (!TOKEN_ADDRESS || TOKEN_ADDRESS === "") {
    throw new Error("❌ Please set TOKEN_ADDRESS or ENCLAVE_TOKEN_ADDRESS in .env file");
  }
  console.log("Token Address:", TOKEN_ADDRESS);

  // Get multisig address for owner (or use deployer for testing)
  const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS || deployer.address;
  console.log("Owner (Multisig):", MULTISIG_ADDRESS, "\n");

  // Deploy TokenVesting
  console.log("1️⃣  Deploying TokenVesting...");
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const vesting = await TokenVesting.deploy(TOKEN_ADDRESS, MULTISIG_ADDRESS);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log("✅ TokenVesting deployed to:", vestingAddress);

  // Get TGE time (from environment or use current time)
  let tgeTime: bigint;
  if (process.env.TGE_TIME) {
    tgeTime = BigInt(process.env.TGE_TIME);
  } else {
    // Use current block timestamp as TGE (for testing)
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    tgeTime = BigInt(block?.timestamp || Math.floor(Date.now() / 1000));
    console.log("⚠️  Using current block timestamp as TGE (for testing only)");
  }
  console.log("TGE Time:", tgeTime.toString(), "(" + new Date(Number(tgeTime) * 1000).toISOString() + ")");

  // Set TGE time
  console.log("\n2️⃣  Setting TGE time...");
  const setTGETx = await vesting.setTGETime(tgeTime);
  await setTGETx.wait();
  console.log("✅ TGE time set");

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
    const token = await ethers.getContractAt("EnclaveToken", TOKEN_ADDRESS);
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
  console.log("Token Address:", TOKEN_ADDRESS);
  console.log("Owner (Multisig):", MULTISIG_ADDRESS);
  console.log("TGE Time:", tgeTime.toString(), "(" + new Date(Number(tgeTime) * 1000).toISOString() + ")");
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
      await hre.run("verify:verify", {
        address: vestingAddress,
        constructorArguments: [TOKEN_ADDRESS, MULTISIG_ADDRESS],
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



