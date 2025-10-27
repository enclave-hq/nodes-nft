import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🧪 Test: Minting NFTs\n");

  const [deployer] = await ethers.getSigners();
  console.log("Test account:", deployer.address);

  // Contract addresses
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "";
  const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS || "";
  const NFT_ADDRESS = process.env.NFT_ADDRESS || "";

  if (!USDT_ADDRESS || !MANAGER_ADDRESS || !NFT_ADDRESS) {
    throw new Error("❌ Please set contract addresses in .env");
  }

  // Connect to contracts
  const usdt = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const manager = await ethers.getContractAt("NFTManager", MANAGER_ADDRESS);
  const nft = await ethers.getContractAt("NodeNFT", NFT_ADDRESS);

  console.log("Connected to contracts:");
  console.log("USDT:       ", USDT_ADDRESS);
  console.log("NFTManager: ", MANAGER_ADDRESS);
  console.log("NodeNFT:    ", NFT_ADDRESS);
  console.log();

  // Check USDT balance
  const usdtBalance = await usdt.balanceOf(deployer.address);
  console.log("💰 Your USDT balance:", ethers.formatUnits(usdtBalance, 18), "USDT\n");

  // Get NFT configs
  const standardConfig = await manager.nftConfigs(0); // Standard
  const premiumConfig = await manager.nftConfigs(1);  // Premium

  console.log("📋 NFT Configurations:");
  console.log("─".repeat(60));
  console.log("Standard NFT:");
  console.log("  Mint Price:    ", ethers.formatUnits(standardConfig.mintPrice, 18), "USDT");
  console.log("  $E Quota:    ", ethers.formatUnits(standardConfig.eclvQuota, 18), "$E");
  console.log("  Total Shares:  ", standardConfig.totalShares.toString());
  console.log("  Weight/Share:  ", standardConfig.weightPerShare.toString());
  console.log("\nPremium NFT:");
  console.log("  Mint Price:    ", ethers.formatUnits(premiumConfig.mintPrice, 18), "USDT");
  console.log("  $E Quota:    ", ethers.formatUnits(premiumConfig.eclvQuota, 18), "$E");
  console.log("  Total Shares:  ", premiumConfig.totalShares.toString());
  console.log("  Weight/Share:  ", premiumConfig.weightPerShare.toString());
  console.log();

  // Test 1: Mint Standard NFT
  console.log("🎯 Test 1: Minting Standard NFT...");
  try {
    // Approve USDT
    const standardPrice = standardConfig.mintPrice;
    console.log("Approving", ethers.formatUnits(standardPrice, 18), "USDT...");
    const approveTx = await usdt.approve(MANAGER_ADDRESS, standardPrice);
    await approveTx.wait();
    console.log("✅ Approved");

    // Mint NFT
    console.log("Minting...");
    const mintTx = await manager.mintNFT(0); // 0 = Standard
    const receipt = await mintTx.wait();
    
    // Find the minted NFT ID from events
    const mintEvent = receipt?.logs
      .map((log: any) => {
        try {
          return manager.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event?.name === "NFTMinted");

    const nftId = mintEvent?.args?.nftId;
    console.log("✅ Standard NFT minted! NFT ID:", nftId?.toString());

    // Check NFT owner
    const owner = await nft.ownerOf(nftId);
    console.log("   Owner:", owner);

    // Check NFT pool
    const pool = await manager.nftPools(nftId);
    console.log("   Pool Info:");
    console.log("     NFT Type:             ", pool.nftType.toString());
    console.log("     State:                ", pool.state === 0 ? "Live" : "Dissolved");
    console.log("     Total Weighted Shares:", pool.totalWeightedShares.toString());
    console.log("     Remaining $E Quota: ", ethers.formatUnits(pool.remaining$EQuota, 18));
    console.log();
  } catch (error: any) {
    console.error("❌ Failed to mint Standard NFT:");
    console.error(error.message || error);
    console.log();
  }

  // Test 2: Mint Premium NFT
  console.log("🎯 Test 2: Minting Premium NFT...");
  try {
    // Approve USDT
    const premiumPrice = premiumConfig.mintPrice;
    console.log("Approving", ethers.formatUnits(premiumPrice, 18), "USDT...");
    const approveTx = await usdt.approve(MANAGER_ADDRESS, premiumPrice);
    await approveTx.wait();
    console.log("✅ Approved");

    // Mint NFT
    console.log("Minting...");
    const mintTx = await manager.mintNFT(1); // 1 = Premium
    const receipt = await mintTx.wait();
    
    // Find the minted NFT ID from events
    const mintEvent = receipt?.logs
      .map((log: any) => {
        try {
          return manager.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event?.name === "NFTMinted");

    const nftId = mintEvent?.args?.nftId;
    console.log("✅ Premium NFT minted! NFT ID:", nftId?.toString());

    // Check NFT owner
    const owner = await nft.ownerOf(nftId);
    console.log("   Owner:", owner);

    // Check NFT pool
    const pool = await manager.nftPools(nftId);
    console.log("   Pool Info:");
    console.log("     NFT Type:             ", pool.nftType.toString());
    console.log("     State:                ", pool.state === 0 ? "Live" : "Dissolved");
    console.log("     Total Weighted Shares:", pool.totalWeightedShares.toString());
    console.log("     Remaining $E Quota: ", ethers.formatUnits(pool.remaining$EQuota, 18));
    console.log();
  } catch (error: any) {
    console.error("❌ Failed to mint Premium NFT:");
    console.error(error.message || error);
    console.log();
  }

  // Check total NFTs
  const totalSupply = await nft.totalSupply();
  console.log("=".repeat(60));
  console.log("📊 Total NFTs minted:", totalSupply.toString());
  console.log("=".repeat(60));

  // Check updated USDT balance
  const finalBalance = await usdt.balanceOf(deployer.address);
  console.log("\n💰 Final USDT balance:", ethers.formatUnits(finalBalance, 18), "USDT");
  console.log("   Spent:", ethers.formatUnits(usdtBalance - finalBalance, 18), "USDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


