import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔍 Querying Contract Status on BSC Testnet...\n");

  // Contract addresses from .env
  const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0x215a35f6585923CB07Ead883b380D07Dbd7dC6d0";
  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x1c713b99C3e3822711De8f71503a63EE908fe2Fc";
  const ECLV_ADDRESS = process.env.ECLV_ADDRESS || "0xCd0Ff5Fd00BD622563011A23091af30De24E7262";

  console.log("📋 Contract Addresses:");
  console.log("   NodeNFT:", NODE_NFT_ADDRESS);
  console.log("   NFTManager (Diamond):", NFT_MANAGER_ADDRESS);
  console.log("   ECLV Token:", ECLV_ADDRESS);
  console.log("");

  // 1. Check NodeNFT
  console.log("1️⃣  NodeNFT Contract:");
  try {
    const nodeNFT = await ethers.getContractAt("NodeNFT", NODE_NFT_ADDRESS);
    const name = await nodeNFT.name();
    const symbol = await nodeNFT.symbol();
    // NodeNFT doesn't have totalSupply, but we can query balanceOf for all addresses
    // For simplicity, we'll just show the contract info
    const nftManager = await nodeNFT.nftManager();
    console.log("   ✅ Name:", name);
    console.log("   ✅ Symbol:", symbol);
    console.log("   ✅ NFTManager:", nftManager);
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
    console.log("");
  }

  // 2. Check ECLV Token
  console.log("2️⃣  ECLV Token Contract:");
  try {
    const eclvToken = await ethers.getContractAt("EnclaveToken", ECLV_ADDRESS);
    const name = await eclvToken.name();
    const symbol = await eclvToken.symbol();
    const totalSupply = await eclvToken.totalSupply();
    const decimals = await eclvToken.decimals();
    console.log("   ✅ Name:", name);
    console.log("   ✅ Symbol:", symbol);
    console.log("   ✅ Total Supply:", ethers.formatEther(totalSupply), symbol);
    console.log("   ✅ Decimals:", decimals.toString());
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
    console.log("");
  }

  // 3. Check NFTManager (Diamond)
  console.log("3️⃣  NFTManager (Diamond) Contract:");
  try {
    // Use AdminFacet interface to query state
    const adminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
    
    // Get basic info
    const maxSupply = await adminFacet.MAX_SUPPLY();
    const totalMinted = await adminFacet.totalMinted();
    const totalActiveNFTs = await adminFacet.getTotalActiveNFTs();
    
    console.log("   ✅ MAX_SUPPLY:", maxSupply.toString());
    console.log("   ✅ Total Minted:", totalMinted.toString());
    console.log("   ✅ Total Active NFTs:", totalActiveNFTs.toString());
    
    // Get contract references
    try {
      const nodeNFT = await adminFacet.nodeNFT();
      const eclvToken = await adminFacet.eclvToken();
      const treasury = await adminFacet.treasury();
      const oracle = await adminFacet.oracle();
      console.log("   ✅ NodeNFT:", nodeNFT);
      console.log("   ✅ ECLV Token:", eclvToken);
      console.log("   ✅ Treasury:", treasury);
      console.log("   ✅ Oracle:", oracle);
    } catch (e: any) {
      console.log("   ⚠️  Could not fetch all contract references:", e.message);
    }
    
    // Try to get current batch ID from NFTManagerFacet
    try {
      const nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", NFT_MANAGER_ADDRESS);
      const currentBatchId = await nftManagerFacet.getCurrentBatchId();
      console.log("   ✅ Current Batch ID:", currentBatchId.toString());
    } catch (e) {
      // Ignore if function doesn't exist
    }
    console.log("");
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
    console.log("");
  }

  // 4. Check TokenVesting (if deployed)
  console.log("4️⃣  TokenVesting Contract:");
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || process.env.TOKEN_VESTING_ADDRESS;
  if (VESTING_ADDRESS) {
    try {
      const vesting = await ethers.getContractAt("TokenVesting", VESTING_ADDRESS);
      const token = await vesting.token();
      const owner = await vesting.owner();
      const tgeTime = await vesting.tgeTime();
      const totalVested = await vesting.totalVested();
      console.log("   ✅ Address:", VESTING_ADDRESS);
      console.log("   ✅ Token:", token);
      console.log("   ✅ Owner:", owner);
      console.log("   ✅ TGE Time:", tgeTime.toString(), tgeTime.toString() !== "0" ? `(${new Date(Number(tgeTime) * 1000).toISOString()})` : "(not set)");
      console.log("   ✅ Total Vested:", ethers.formatEther(totalVested), "$E");
    } catch (error: any) {
      console.log("   ❌ Error:", error.message);
    }
  } else {
    console.log("   ⚠️  Not deployed (no VESTING_ADDRESS in .env)");
  }
  console.log("");

  // Summary
  console.log("============================================================");
  console.log("📊 Summary:");
  console.log("============================================================");
  console.log("Network: BSC Testnet (Chain ID: 97)");
  console.log("NodeNFT:", NODE_NFT_ADDRESS);
  console.log("NFTManager (Diamond):", NFT_MANAGER_ADDRESS);
  console.log("ECLV Token:", ECLV_ADDRESS);
  console.log("TokenVesting:", VESTING_ADDRESS || "Not deployed");
  console.log("============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

