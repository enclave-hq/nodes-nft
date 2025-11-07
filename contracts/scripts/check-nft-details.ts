import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function checkNFTDetails() {
  console.log("🔍 Querying detailed information for NFT #1...\n");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // NodeNFT ABI
  const nodeNFTABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function totalMinted() view returns (uint256)"
  ];
  
  // NFTManager ABI
  const nftManagerABI = [
    "function getUserNFTs(address user) view returns (uint256[])",
    "function getNFTPool(uint256 nftId) view returns (uint8 status, uint256 createdAt, uint256 terminationInitiatedAt, uint256 totalEclvLocked, uint256 remainingMintQuota, uint256 unlockedAmount, uint256 unlockedWithdrawn, uint256 unlockedPeriods, uint256 producedWithdrawn)",
    "function totalMinted() view returns (uint256)"
  ];
  
  const nodeNFT = new ethers.Contract(NODE_NFT_ADDRESS, nodeNFTABI, provider);
  const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, provider);
  
  try {
    // 1. Query NFT owner
    const owner = await nodeNFT.ownerOf(1);
    console.log(`✅ NFT #1 owner (NodeNFT.ownerOf): ${owner}`);
    
    // 2. Query NFT list for this user in Manager
    const userNFTs = await nftManager.getUserNFTs(owner);
    console.log(`\n📋 NFTs owned by this user recorded in Manager (getUserNFTs): [${userNFTs.map((id: bigint) => id.toString()).join(", ")}]`);
    
    if (userNFTs.includes(1n)) {
      console.log("✅ NFT #1 is in Manager's userNFTList");
    } else {
      console.log("❌ NFT #1 is not in Manager's userNFTList (inconsistent!)");
    }
    
    // 3. Query NFT Pool information
    try {
      const pool = await nftManager.getNFTPool(1);
      console.log(`\n📊 NFT Pool information:`);
      console.log(`   - Status: ${pool[0]}`);
      console.log(`   - Created At: ${new Date(Number(pool[1]) * 1000).toISOString()}`);
      console.log(`   - NFT exists in Pool: ✅`);
    } catch (error: any) {
      console.log(`\n❌ NFT Pool query failed: ${error.message}`);
      console.log(`   - NFT may not exist in Pool`);
    }
    
    // 4. Query total minted count
    const totalMintedNodeNFT = await nodeNFT.totalMinted();
    const totalMintedManager = await nftManager.totalMinted();
    console.log(`\n📈 Total minted count:`);
    console.log(`   - NodeNFT.totalMinted(): ${totalMintedNodeNFT}`);
    console.log(`   - NFTManager.totalMinted(): ${totalMintedManager}`);
    
    // 5. Check all minted NFTs to see which are in userNFTList
    console.log(`\n🔍 Checking ownership and Manager records for first 10 NFTs:`);
    for (let i = 1; i <= Math.min(10, Number(totalMintedNodeNFT)); i++) {
      try {
        const nftOwner = await nodeNFT.ownerOf(i);
        const ownerNFTs = await nftManager.getUserNFTs(nftOwner);
        const inList = ownerNFTs.includes(BigInt(i));
        console.log(`   NFT #${i}: Owner=${nftOwner.slice(0, 10)}..., In userNFTList=${inList ? '✅' : '❌'}`);
      } catch (error) {
        // Skip if NFT doesn't exist
      }
    }
    
  } catch (error: any) {
    console.error("❌ Query failed:", error.message);
  }
}

checkNFTDetails().catch(console.error);

