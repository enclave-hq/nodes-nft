import { ethers } from "hardhat";

async function main() {
  console.log("🧪 LOCAL TESTING - Production & Reward Distribution\n");

  const [deployer, alice, bob] = await ethers.getSigners();

  // Contract addresses (update from deployment)
  const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const $E_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const MANAGER_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("📝 Using addresses:");
  console.log("USDT:    ", USDT_ADDRESS);
  console.log("$E:    ", $E_ADDRESS);
  console.log("Manager: ", MANAGER_ADDRESS);
  console.log();

  // Connect to contracts
  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const eclv = await ethers.getContractAt("EnclaveToken", $E_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);

  // Check if we're the oracle
  const oracle = await manager.oracle();
  console.log("Oracle:", oracle);
  console.log("We are:", deployer.address);
  console.log("Are we oracle?", oracle === deployer.address ? "✅" : "❌");
  console.log();

  // Check global state before distribution
  console.log("📊 Global State Before Distribution:");
  console.log("─".repeat(60));
  const globalStateBefore = await manager.globalState();
  console.log("Total Weighted Shares:", globalStateBefore.totalWeightedShares.toString());
  console.log("Acc Per Weight:       ", ethers.formatUnits(globalStateBefore.accProducedPerWeight, 18));
  console.log();

  // Test 1: Distribute $E Production
  console.log("🎯 Test 1: Distributing $E Production");
  console.log("─".repeat(60));

  const produceAmount = ethers.parseEther("1000"); // 1000 $E
  console.log("Distributing:", ethers.formatEther(produceAmount), "$E");

  const manager$EBefore = await eclv.balanceOf(MANAGER_ADDRESS);
  console.log("Manager $E before:", ethers.formatEther(manager$EBefore), "$E");

  const oracle$EBefore = await eclv.balanceOf(deployer.address);
  console.log("Oracle $E before: ", ethers.formatEther(oracle$EBefore), "$E");

  // Oracle needs to have $E and approve
  if (oracle$EBefore < produceAmount) {
    console.log("Minting $E to oracle...");
    await eclv.transfer(deployer.address, produceAmount);
  }

  await eclv.approve(MANAGER_ADDRESS, produceAmount);
  console.log("✅ Oracle approved $E");

  const tx1 = await manager.distributeProduced(produceAmount);
  await tx1.wait();
  console.log("✅ $E distributed!");

  const globalStateAfter1 = await manager.globalState();
  console.log("New Acc Per Weight:", ethers.formatUnits(globalStateAfter1.accProducedPerWeight, 18));
  
  const manager$EAfter = await eclv.balanceOf(MANAGER_ADDRESS);
  console.log("Manager $E after: ", ethers.formatEther(manager$EAfter), "$E");
  console.log("Used:", ethers.formatEther(manager$EBefore - manager$EAfter), "$E");
  console.log();

  // Test 2: Distribute USDT Rewards
  console.log("🎯 Test 2: Distributing USDT Rewards");
  console.log("─".repeat(60));

  const rewardAmount = ethers.parseUnits("500", 18); // 500 USDT
  console.log("Distributing:", ethers.formatUnits(rewardAmount, 18), "USDT");

  // Oracle needs USDT
  const oracleUSDTBefore = await usdt.balanceOf(deployer.address);
  if (oracleUSDTBefore < rewardAmount) {
    console.log("Minting USDT to oracle...");
    await usdt.mint(deployer.address, rewardAmount);
  }

  console.log("Oracle USDT balance:", ethers.formatUnits(await usdt.balanceOf(deployer.address), 18));

  // Approve USDT
  await usdt.approve(MANAGER_ADDRESS, rewardAmount);
  console.log("✅ Approved USDT");

  // Distribute
  const tx2 = await manager.distributeReward(USDT_ADDRESS, rewardAmount);
  await tx2.wait();
  console.log("✅ USDT rewards distributed!");
  console.log();

  // Test 3: Check Pending Rewards for NFT #1 (Alice's Standard NFT)
  console.log("🎯 Test 3: Checking Pending Rewards for NFT #1 (Alice)");
  console.log("─".repeat(60));

  const nftId1 = 1;
  const pending$E1 = await manager.getPendingProduced(nftId1, alice.address);
  const pendingUSDT1 = await manager.getPendingReward(nftId1, alice.address, USDT_ADDRESS);

  console.log("NFT #1 (Standard, 10 shares, weight=1 each):");
  console.log("  Pending $E:", ethers.formatEther(pending$E1), "$E");
  console.log("  Pending USDT:", ethers.formatUnits(pendingUSDT1, 18), "USDT");
  console.log();

  // Check Alice's shares
  const aliceShares = await manager.getUserShareCount(nftId1, alice.address);
  console.log("Alice's shares in NFT #1:", aliceShares.toString());
  console.log();

  // Test 4: Check Pending Rewards for NFT #2 (Bob's Premium NFT)
  console.log("🎯 Test 4: Checking Pending Rewards for NFT #2 (Bob)");
  console.log("─".repeat(60));

  const nftId2 = 2;
  const pending$E2 = await manager.getPendingProduced(nftId2, bob.address);
  const pendingUSDT2 = await manager.getPendingReward(nftId2, bob.address, USDT_ADDRESS);

  console.log("NFT #2 (Premium, 10 shares, weight=6 each):");
  console.log("  Pending $E:", ethers.formatEther(pending$E2), "$E");
  console.log("  Pending USDT:", ethers.formatUnits(pendingUSDT2, 18), "USDT");
  console.log();

  // Check Bob's shares
  const bobShares = await manager.getUserShareCount(nftId2, bob.address);
  console.log("Bob's shares in NFT #2:", bobShares.toString());
  console.log();

  // Test 5: Alice Claims $E Production
  console.log("🎯 Test 5: Alice Claims $E Production");
  console.log("─".repeat(60));

  const alice$EBefore = await eclv.balanceOf(alice.address);
  console.log("Alice $E before:", ethers.formatEther(alice$EBefore), "$E");

  const tx3 = await manager.connect(alice).claimProduced(nftId1);
  await tx3.wait();
  console.log("✅ Claimed $E!");

  const alice$EAfter = await eclv.balanceOf(alice.address);
  console.log("Alice $E after: ", ethers.formatEther(alice$EAfter), "$E");
  console.log("Received:", ethers.formatEther(alice$EAfter - alice$EBefore), "$E");
  console.log();

  // Test 6: Alice Claims USDT Rewards
  console.log("🎯 Test 6: Alice Claims USDT Rewards");
  console.log("─".repeat(60));

  const aliceUSDTBefore = await usdt.balanceOf(alice.address);
  console.log("Alice USDT before:", ethers.formatUnits(aliceUSDTBefore, 18), "USDT");

  const tx4 = await manager.connect(alice).claimReward(nftId1, USDT_ADDRESS);
  await tx4.wait();
  console.log("✅ Claimed USDT!");

  const aliceUSDTAfter = await usdt.balanceOf(alice.address);
  console.log("Alice USDT after: ", ethers.formatUnits(aliceUSDTAfter, 18), "USDT");
  console.log("Received:", ethers.formatUnits(aliceUSDTAfter - aliceUSDTBefore, 18), "USDT");
  console.log();

  // Test 7: Bob Claims Both $E and USDT
  console.log("🎯 Test 7: Bob Claims Both $E and USDT");
  console.log("─".repeat(60));

  const bob$EBefore = await eclv.balanceOf(bob.address);
  const bobUSDTBefore = await usdt.balanceOf(bob.address);
  console.log("Bob $E before:", ethers.formatEther(bob$EBefore), "$E");
  console.log("Bob USDT before:", ethers.formatUnits(bobUSDTBefore, 18), "USDT");

  const tx5 = await manager.connect(bob).claimProduced(nftId2);
  await tx5.wait();
  const tx6 = await manager.connect(bob).claimReward(nftId2, USDT_ADDRESS);
  await tx6.wait();
  console.log("✅ Claimed both!");

  const bob$EAfter = await eclv.balanceOf(bob.address);
  const bobUSDTAfter = await usdt.balanceOf(bob.address);
  console.log("Bob $E after:  ", ethers.formatEther(bob$EAfter), "$E");
  console.log("Bob USDT after:  ", ethers.formatUnits(bobUSDTAfter, 18), "USDT");
  console.log("Received $E:", ethers.formatEther(bob$EAfter - bob$EBefore), "$E");
  console.log("Received USDT:", ethers.formatUnits(bobUSDTAfter - bobUSDTBefore, 18), "USDT");
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  console.log("\n💰 Rewards Distribution:");
  console.log("Total $E Produced:   ", ethers.formatEther(produceAmount), "$E");
  console.log("Total USDT Rewards:    ", ethers.formatUnits(rewardAmount, 18), "USDT");
  console.log("\nAlice Received (Standard NFT):");
  console.log("  $E:", ethers.formatEther(alice$EAfter - alice$EBefore), "$E");
  console.log("  USDT:", ethers.formatUnits(aliceUSDTAfter - aliceUSDTBefore, 18), "USDT");
  console.log("\nBob Received (Premium NFT):");
  console.log("  $E:", ethers.formatEther(bob$EAfter - bob$EBefore), "$E");
  console.log("  USDT:", ethers.formatUnits(bobUSDTAfter - bobUSDTBefore, 18), "USDT");

  console.log("\n📐 Weight Verification:");
  console.log("Standard weight: 1 × 10 shares = 10");
  console.log("Premium weight:  6 × 10 shares = 60");
  console.log("Total weight:                   70");
  console.log("\nExpected ratio: Bob should get 6x more than Alice");
  const alice$EReceived = alice$EAfter - alice$EBefore;
  const bob$EReceived = bob$EAfter - bob$EBefore;
  const actualRatio = Number(bob$EReceived) / Number(alice$EReceived);
  console.log("Actual ratio:", actualRatio.toFixed(2), "x");
  console.log("Verification:", Math.abs(actualRatio - 6) < 0.1 ? "✅ PASS" : "❌ FAIL");

  console.log("\n✅ Distribution and claiming tests complete!");
  console.log("\n💡 Next steps:");
  console.log("  npx hardhat run scripts/local-04-test-marketplace.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

