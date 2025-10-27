import { ethers } from "hardhat";

async function main() {
  console.log("🧪 LOCAL TESTING - NFT Minting\n");

  const [deployer, alice, bob] = await ethers.getSigners();

  // Contract addresses (from local-01-deploy-all.ts output)
  // Update these after each deployment
  const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const MANAGER_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const NFT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  console.log("📝 Using addresses:");
  console.log("USDT:    ", USDT_ADDRESS);
  console.log("Manager: ", MANAGER_ADDRESS);
  console.log("NFT:     ", NFT_ADDRESS);
  console.log();

  // Connect to contracts
  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);
  const nft = await ethers.getContractAt("NodeNFT", NFT_ADDRESS);

  // Get NFT configs
  const standardConfig = await manager.nftConfigs(0);
  const premiumConfig = await manager.nftConfigs(1);

  console.log("📋 NFT Configurations:");
  console.log("─".repeat(60));
  console.log("Standard: ", ethers.formatUnits(standardConfig.mintPrice, 18), "USDT");
  console.log("Premium:  ", ethers.formatUnits(premiumConfig.mintPrice, 18), "USDT");
  console.log();

  // Test 1: Alice mints Standard NFT
  console.log("🎯 Test 1: Alice mints Standard NFT");
  console.log("─".repeat(60));
  
  const aliceUsdtBefore = await usdt.balanceOf(alice.address);
  console.log("Alice USDT before:", ethers.formatUnits(aliceUsdtBefore, 18));

  const standardPrice = standardConfig.mintPrice;
  await usdt.connect(alice).approve(MANAGER_ADDRESS, standardPrice);
  console.log("✅ Approved USDT");

  const mintTx1 = await manager.connect(alice).mintNFT(0);
  const receipt1 = await mintTx1.wait();
  
  // Get NFT ID from event
  const mintEvent1 = receipt1?.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event?.name === "NFTMinted");

  const nftId1 = mintEvent1?.args?.nftId;
  console.log("✅ Minted NFT #" + nftId1?.toString());

  const owner1 = await nft.ownerOf(nftId1);
  console.log("   Owner:", owner1);
  console.log("   Verified:", owner1 === alice.address ? "✅" : "❌");

  const aliceUsdtAfter = await usdt.balanceOf(alice.address);
  console.log("Alice USDT after: ", ethers.formatUnits(aliceUsdtAfter, 18));
  console.log("   Spent:", ethers.formatUnits(aliceUsdtBefore - aliceUsdtAfter, 18), "USDT");
  console.log();

  // Test 2: Bob mints Premium NFT
  console.log("🎯 Test 2: Bob mints Premium NFT");
  console.log("─".repeat(60));

  const bobUsdtBefore = await usdt.balanceOf(bob.address);
  console.log("Bob USDT before:", ethers.formatUnits(bobUsdtBefore, 18));

  const premiumPrice = premiumConfig.mintPrice;
  await usdt.connect(bob).approve(MANAGER_ADDRESS, premiumPrice);
  console.log("✅ Approved USDT");

  const mintTx2 = await manager.connect(bob).mintNFT(1);
  const receipt2 = await mintTx2.wait();

  const mintEvent2 = receipt2?.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event?.name === "NFTMinted");

  const nftId2 = mintEvent2?.args?.nftId;
  console.log("✅ Minted NFT #" + nftId2?.toString());

  const owner2 = await nft.ownerOf(nftId2);
  console.log("   Owner:", owner2);
  console.log("   Verified:", owner2 === bob.address ? "✅" : "❌");

  const bobUsdtAfter = await usdt.balanceOf(bob.address);
  console.log("Bob USDT after:   ", ethers.formatUnits(bobUsdtAfter, 18));
  console.log("   Spent:", ethers.formatUnits(bobUsdtBefore - bobUsdtAfter, 18), "USDT");
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  // Note: ERC721 doesn't have totalSupply by default
  console.log("Total NFTs minted: 2 (NFT #1 and #2)");

  // Check NFT pools
  const pool1 = await manager.nftPools(nftId1);
  const pool2 = await manager.nftPools(nftId2);

  console.log("\nNFT #" + nftId1?.toString() + " Pool:");
  console.log("  Type:              ", pool1.nftType?.toString() || "N/A", "(Standard)");
  console.log("  State:             ", pool1.state === 0n ? "Live" : "Dissolved");
  console.log("  Weighted Shares:   ", pool1.totalWeightedShares?.toString() || "N/A");
  console.log("  Remaining Quota:   ", pool1.remaining$EQuota ? ethers.formatEther(pool1.remaining$EQuota) : "N/A", "$E");

  console.log("\nNFT #" + nftId2?.toString() + " Pool:");
  console.log("  Type:              ", pool2.nftType?.toString() || "N/A", "(Premium)");
  console.log("  State:             ", pool2.state === 0n ? "Live" : "Dissolved");
  console.log("  Weighted Shares:   ", pool2.totalWeightedShares?.toString() || "N/A");
  console.log("  Remaining Quota:   ", pool2.remaining$EQuota ? ethers.formatEther(pool2.remaining$EQuota) : "N/A", "$E");

  // Check global state
  const globalState = await manager.globalState();
  console.log("\n🌐 Global State:");
  console.log("  Total Weighted Shares:", globalState.totalWeightedShares.toString());
  console.log("  Acc Per Weight:       ", ethers.formatUnits(globalState.accProducedPerWeight, 18));

  console.log("\n✅ Minting tests complete!");
  console.log("\n💡 Next steps:");
  console.log("  npx hardhat run scripts/local-03-test-distribution.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

