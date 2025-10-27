import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🧪 Test: Distribution and Claiming\n");

  const [deployer] = await ethers.getSigners();
  console.log("Oracle/Test account:", deployer.address);

  // Contract addresses
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  const ECLV_ADDRESS = process.env.ECLV_ADDRESS || "";
  const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS || "";

  if (!USDT_ADDRESS || !ECLV_ADDRESS || !MANAGER_ADDRESS) {
    throw new Error("❌ Please set contract addresses in .env");
  }

  // Connect to contracts
  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const eclv = await ethers.getContractAt("EnclaveToken", ECLV_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);

  console.log("Connected to contracts:");
  console.log("ECLV:       ", ECLV_ADDRESS);
  console.log("USDT:       ", USDT_ADDRESS);
  console.log("NFTManager: ", MANAGER_ADDRESS);
  console.log();

  // Check oracle
  const oracle = await manager.oracle();
  console.log("Oracle address:", oracle);
  if (oracle !== deployer.address) {
    console.log("⚠️  You are not the oracle. Setting oracle to your address...");
    const tx = await manager.setOracle(deployer.address);
    await tx.wait();
    console.log("✅ Oracle set");
  }
  console.log();

  // Check global state before distribution
  console.log("📊 Global State Before Distribution:");
  console.log("─".repeat(60));
  const globalStateBefore = await manager.globalState();
  console.log("Total Weighted Shares:      ", globalStateBefore.totalWeightedShares.toString());
  console.log("Accumulated Per Weight:     ", ethers.formatUnits(globalStateBefore.accProducedPerWeight, 18));
  console.log("Last Distribution Timestamp:", new Date(Number(globalStateBefore.lastDistributionTimestamp) * 1000).toLocaleString());
  console.log();

  // Get total weighted shares
  const totalWeightedShares = globalStateBefore.totalWeightedShares;
  if (totalWeightedShares === BigInt(0)) {
    console.log("⚠️  No NFTs minted yet. Please run 04-test-mint.ts first.");
    return;
  }

  // Test 1: Distribute ECLV Production
  console.log("🎯 Test 1: Distributing ECLV Production...");
  try {
    // Distribute 1000 ECLV
    const produceAmount = ethers.parseEther("1000");
    console.log("Distributing", ethers.formatEther(produceAmount), "ECLV...");
    
    const tx1 = await manager.distributeProduced(produceAmount);
    await tx1.wait();
    console.log("✅ ECLV distributed!");

    // Check updated global state
    const globalStateAfter1 = await manager.globalState();
    console.log("   New Accumulated Per Weight:", ethers.formatUnits(globalStateAfter1.accProducedPerWeight, 18));
    console.log();
  } catch (error: any) {
    console.error("❌ Failed to distribute ECLV:");
    console.error(error.message || error);
    console.log();
  }

  // Test 2: Distribute USDT Rewards
  console.log("🎯 Test 2: Distributing USDT Rewards...");
  try {
    // First, oracle needs USDT
    const rewardAmount = ethers.parseUnits("500", 18); // 500 USDT
    
    // Check oracle's USDT balance
    let oracleBalance = await usdt.balanceOf(deployer.address);
    if (oracleBalance < rewardAmount) {
      console.log("Minting USDT to oracle...");
      await usdt.mint(deployer.address, rewardAmount);
      oracleBalance = await usdt.balanceOf(deployer.address);
    }
    console.log("Oracle USDT balance:", ethers.formatUnits(oracleBalance, 18));

    // Approve USDT
    console.log("Approving USDT...");
    const approveTx = await usdt.approve(MANAGER_ADDRESS, rewardAmount);
    await approveTx.wait();
    console.log("✅ Approved");

    // Distribute rewards
    console.log("Distributing", ethers.formatUnits(rewardAmount, 18), "USDT rewards...");
    const tx2 = await manager.distributeReward(USDT_ADDRESS, rewardAmount);
    await tx2.wait();
    console.log("✅ USDT rewards distributed!");

    // Check reward state
    const rewardState = await manager.rewardStates(USDT_ADDRESS);
    console.log("   Total Distributed:", ethers.formatUnits(rewardState.totalDistributed, 18), "USDT");
    console.log("   Acc Per Weight:   ", ethers.formatUnits(rewardState.accRewardPerWeight, 18));
    console.log();
  } catch (error: any) {
    console.error("❌ Failed to distribute USDT rewards:");
    console.error(error.message || error);
    console.log();
  }

  // Test 3: Check Pending Rewards for NFT #1
  console.log("🎯 Test 3: Checking Pending Rewards for NFT #1...");
  try {
    const nftId = 1;
    
    // Check pending ECLV
    const pendingECLV = await manager.pendingProduced(nftId);
    console.log("Pending ECLV:", ethers.formatEther(pendingECLV), "ECLV");

    // Check pending USDT
    const pendingUSDT = await manager.pendingReward(nftId, USDT_ADDRESS);
    console.log("Pending USDT:", ethers.formatUnits(pendingUSDT, 18), "USDT");
    console.log();
  } catch (error: any) {
    console.error("❌ Failed to check pending rewards:");
    console.error(error.message || error);
    console.log();
  }

  // Test 4: Claim Rewards for NFT #1
  console.log("🎯 Test 4: Claiming Rewards for NFT #1...");
  try {
    const nftId = 1;
    
    // Check user's share balance
    const userShares = await manager.userShares(nftId, deployer.address);
    console.log("Your shares in NFT #1:", userShares.shareCount.toString());

    if (userShares.shareCount === BigInt(0)) {
      console.log("⚠️  You don't own shares in NFT #1");
      console.log();
    } else {
      // Claim produced ECLV
      console.log("Claiming ECLV production...");
      const balanceBefore = await eclv.balanceOf(deployer.address);
      const tx3 = await manager.claimProduced(nftId);
      await tx3.wait();
      const balanceAfter = await eclv.balanceOf(deployer.address);
      console.log("✅ Claimed", ethers.formatEther(balanceAfter - balanceBefore), "ECLV");

      // Claim USDT rewards
      console.log("Claiming USDT rewards...");
      const usdtBalanceBefore = await usdt.balanceOf(deployer.address);
      const tx4 = await manager.claimReward(nftId, USDT_ADDRESS);
      await tx4.wait();
      const usdtBalanceAfter = await usdt.balanceOf(deployer.address);
      console.log("✅ Claimed", ethers.formatUnits(usdtBalanceAfter - usdtBalanceBefore, 18), "USDT");
      console.log();
    }
  } catch (error: any) {
    console.error("❌ Failed to claim rewards:");
    console.error(error.message || error);
    console.log();
  }

  // Test 5: Batch Claim
  console.log("🎯 Test 5: Testing Batch Claim...");
  try {
    const nftIds = [1]; // Add more NFT IDs if you have them
    const rewardTokens = [USDT_ADDRESS];

    console.log("Batch claiming for NFTs:", nftIds.map(id => id.toString()).join(", "));
    const tx5 = await manager.batchClaim(nftIds, rewardTokens);
    await tx5.wait();
    console.log("✅ Batch claim successful!");
    console.log();
  } catch (error: any) {
    console.error("❌ Failed batch claim:");
    console.error(error.message || error);
    console.log();
  }

  console.log("=".repeat(60));
  console.log("✅ Distribution and claiming tests complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

