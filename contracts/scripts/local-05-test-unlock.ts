import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  console.log("🧪 LOCAL TESTING - Unlock Mechanism\n");

  const [deployer, alice, bob] = await ethers.getSigners();

  // Contract addresses
  const $E_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const MANAGER_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("📝 Using addresses:");
  console.log("$E:    ", $E_ADDRESS);
  console.log("Manager: ", MANAGER_ADDRESS);
  console.log();

  // Connect to contracts
  const eclv = await ethers.getContractAt("EnclaveToken", $E_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);

  const nftId1 = 1; // Alice's Standard NFT
  const nftId2 = 2; // Bob's Premium NFT

  // Test 1: Check Initial State
  console.log("🎯 Test 1: Initial State (Just Minted)");
  console.log("─".repeat(60));

  const pool1Before = await manager.nftPools(nftId1);
  const pool2Before = await manager.nftPools(nftId2);

  const currentTime = await time.latest();
  console.log("Current block time:", new Date(currentTime * 1000).toISOString());
  console.log("\nNFT #1 (Standard):");
  console.log("  Mint time:      ", new Date(Number(pool1Before.createdAt) * 1000).toISOString());
  console.log("  Remaining quota:", ethers.formatEther(pool1Before.remainingMintQuota), "$E");
  console.log("\nNFT #2 (Premium):");
  console.log("  Mint time:      ", new Date(Number(pool2Before.createdAt) * 1000).toISOString());
  console.log("  Remaining quota:", ethers.formatEther(pool2Before.remainingMintQuota), "$E");
  console.log();

  // Test 2: Check Unlock Status (Should be 0%)
  console.log("🎯 Test 2: Unlock Status (Day 0)");
  console.log("─".repeat(60));

  const pool1_0 = await manager.nftPools(nftId1);
  const pool2_0 = await manager.nftPools(nftId2);

  console.log("NFT #1 remaining quota:", ethers.formatEther(pool1_0.remainingMintQuota), "$E");
  console.log("NFT #2 remaining quota:", ethers.formatEther(pool2_0.remainingMintQuota), "$E");
  console.log("Verification:", 
    pool1_0.remainingMintQuota === ethers.parseEther("20000") && 
    pool2_0.remainingMintQuota === ethers.parseEther("100000") 
    ? "✅ PASS (Nothing unlocked yet)" : "❌ FAIL"
  );
  console.log();

  // Test 3: Fast Forward 1 Year
  console.log("🎯 Test 3: Fast Forward 1 Year");
  console.log("─".repeat(60));

  const oneYear = 365 * 24 * 60 * 60;
  console.log("⏰ Fast forwarding time by 1 year...");
  await time.increase(oneYear);
  
  const newTime = await time.latest();
  console.log("New block time:", new Date(newTime * 1000).toISOString());
  console.log("✅ Time travel complete!");
  console.log();

  // Test 4: Check Unlock After 1 Year (Should still be 0%, unlock starts after 1 year)
  console.log("🎯 Test 4: Unlock Status (After 1 Year)");
  console.log("─".repeat(60));

  const unlocked1_1y = await manager.calculateUnlockedAmount(nftId1);
  const unlocked2_1y = await manager.calculateUnlockedAmount(nftId2);

  console.log("NFT #1 unlocked:", ethers.formatEther(unlocked1_1y), "$E");
  console.log("NFT #2 unlocked:", ethers.formatEther(unlocked2_1y), "$E");
  
  const standardQuota = ethers.parseEther("20000");
  const premiumQuota = ethers.parseEther("100000");
  
  console.log("\nExpected: 0% (unlock starts AFTER 1 year)");
  console.log();

  // Test 5: Fast Forward 1 More Month (4% should unlock)
  console.log("🎯 Test 5: Fast Forward 1 Month (1 year + 1 month)");
  console.log("─".repeat(60));

  const oneMonth = 30 * 24 * 60 * 60;
  console.log("⏰ Fast forwarding time by 1 month...");
  await time.increase(oneMonth);
  
  const timeAfterMonth = await time.latest();
  console.log("New block time:", new Date(timeAfterMonth * 1000).toISOString());
  console.log("✅ Time travel complete!");
  console.log();

  const unlocked1_1y1m = await manager.calculateUnlockedAmount(nftId1);
  const unlocked2_1y1m = await manager.calculateUnlockedAmount(nftId2);

  console.log("NFT #1 unlocked:", ethers.formatEther(unlocked1_1y1m), "$E");
  console.log("NFT #2 unlocked:", ethers.formatEther(unlocked2_1y1m), "$E");
  
  const expected1Month = standardQuota * 4n / 100n; // 4% of 20,000 = 800
  const expected2Month = premiumQuota * 4n / 100n; // 4% of 100,000 = 4,000
  
  console.log("\nExpected:");
  console.log("  NFT #1:", ethers.formatEther(expected1Month), "$E (4% of 20,000)");
  console.log("  NFT #2:", ethers.formatEther(expected2Month), "$E (4% of 100,000)");
  console.log();

  // Test 6: Fast Forward to End (25 months after 1 year = 100% unlocked)
  console.log("🎯 Test 6: Fast Forward to Full Unlock (26 months total)");
  console.log("─".repeat(60));

  const twentyFourMonths = 24 * 30 * 24 * 60 * 60;
  console.log("⏰ Fast forwarding time by 24 more months...");
  await time.increase(twentyFourMonths);
  
  const timeFinal = await time.latest();
  console.log("New block time:", new Date(timeFinal * 1000).toISOString());
  console.log("✅ Time travel complete!");
  console.log();

  const unlocked1_final = await manager.calculateUnlockedAmount(nftId1);
  const unlocked2_final = await manager.calculateUnlockedAmount(nftId2);

  console.log("NFT #1 unlocked:", ethers.formatEther(unlocked1_final), "$E");
  console.log("NFT #2 unlocked:", ethers.formatEther(unlocked2_final), "$E");
  
  console.log("\nExpected (100%):");
  console.log("  NFT #1:", ethers.formatEther(standardQuota), "$E");
  console.log("  NFT #2:", ethers.formatEther(premiumQuota), "$E");
  
  console.log("\nVerification:");
  console.log("  NFT #1:", unlocked1_final === standardQuota ? "✅ PASS" : "❌ FAIL");
  console.log("  NFT #2:", unlocked2_final === premiumQuota ? "✅ PASS" : "❌ FAIL");
  console.log();

  // Test 7: Try to Withdraw Unlocked $E (in Live state - should fail)
  console.log("🎯 Test 7: Attempt to Withdraw in Live State");
  console.log("─".repeat(60));

  console.log("Attempting to withdraw unlocked $E while NFT is in Live state...");
  try {
    await manager.connect(alice).withdrawUnlocked$E(nftId1, ethers.parseEther("100"));
    console.log("❌ FAIL - Should not allow withdrawal in Live state!");
  } catch (error: any) {
    if (error.message.includes("revert") || error.message.includes("Cannot withdraw")) {
      console.log("✅ PASS - Correctly prevented withdrawal in Live state");
    } else {
      console.log("❌ Unexpected error:", error.message);
    }
  }
  console.log();

  // Test 8: Dissolve NFT #1
  console.log("🎯 Test 8: Dissolving NFT to Enable Withdrawal");
  console.log("─".repeat(60));

  // Get all share holders
  const aliceShares = await manager.userShares(nftId1, alice.address);
  console.log("Alice owns", aliceShares.shareCount.toString(), "shares in NFT #1");
  
  // If there are multiple shareholders, they all need to approve
  // For this test, Alice owns all shares after previous tests
  console.log("\nProposing dissolution...");
  const tx1 = await manager.connect(alice).proposeDissolve(nftId1);
  await tx1.wait();
  console.log("✅ Dissolution proposed");

  // Check NFT state
  const pool1After = await manager.nftPools(nftId1);
  console.log("NFT state:", pool1After.state === 0n ? "Live" : "Dissolved ✅");
  console.log();

  // Test 9: Withdraw Unlocked $E After Dissolution
  console.log("🎯 Test 9: Withdrawing Unlocked $E After Dissolution");
  console.log("─".repeat(60));

  const alice$EBefore = await eclv.balanceOf(alice.address);
  console.log("Alice $E before:", ethers.formatEther(alice$EBefore), "$E");

  const withdrawAmount = ethers.parseEther("5000"); // Withdraw 5000 $E
  console.log("Withdrawing:", ethers.formatEther(withdrawAmount), "$E");

  const tx2 = await manager.connect(alice).withdrawUnlocked$E(nftId1, withdrawAmount);
  await tx2.wait();
  console.log("✅ Withdrawal successful!");

  const alice$EAfter = await eclv.balanceOf(alice.address);
  console.log("Alice $E after: ", ethers.formatEther(alice$EAfter), "$E");
  console.log("Received:", ethers.formatEther(alice$EAfter - alice$EBefore), "$E");
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Unlock Mechanism Summary");
  console.log("=".repeat(60));

  console.log("\n📅 Timeline:");
  console.log("  Day 0:            0% unlocked");
  console.log("  After 1 year:     0% unlocked (unlock starts)");
  console.log("  After 1y+1m:      4% unlocked");
  console.log("  After 1y+25m:     100% unlocked");

  console.log("\n🔐 State Transitions:");
  console.log("  Live state:       ✅ Can earn rewards, ❌ Cannot withdraw principal");
  console.log("  Dissolved state:  ❌ No new rewards, ✅ Can withdraw unlocked");

  console.log("\n✅ Unlock mechanism tests complete!");
  console.log("\n💡 All local tests finished! Ready for testnet deployment.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

