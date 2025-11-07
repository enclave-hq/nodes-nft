import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

const USER_ADDRESS = "0x8202044babe9070395121350e2dabc2581a4e04e";

async function checkUserNFTs() {
  console.log(`🔍 Querying NFTs for user ${USER_ADDRESS}...\n`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // NodeNFT ABI
  const nodeNFTABI = [
    "function ownerOf(uint256 tokenId) view returns (address)"
  ];
  
  // NFTManager ABI
  const nftManagerABI = [
    "function getUserNFTs(address user) view returns (uint256[])",
    "function totalMinted() view returns (uint256)"
  ];
  
  const nodeNFT = new ethers.Contract(NODE_NFT_ADDRESS, nodeNFTABI, provider);
  const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, provider);
  
  try {
    // 1. Query NFT list recorded in Manager for this user
    const userNFTsFromManager = await nftManager.getUserNFTs(USER_ADDRESS);
    console.log(`📋 Manager.getUserNFTs(${USER_ADDRESS}):`);
    console.log(`   [${userNFTsFromManager.map((id: bigint) => id.toString()).join(", ")}]`);
    
    // 2. Query actually owned NFTs through ownerOf
    const totalMinted = await nftManager.totalMinted();
    console.log(`\n🔍 Querying actually owned NFTs through ownerOf (total ${totalMinted}):`);
    
    const actuallyOwned: bigint[] = [];
    for (let i = 1; i <= Number(totalMinted); i++) {
      try {
        const owner = await nodeNFT.ownerOf(i);
        if (owner.toLowerCase() === USER_ADDRESS.toLowerCase()) {
          actuallyOwned.push(BigInt(i));
        }
      } catch (error) {
        // Skip if NFT doesn't exist
      }
    }
    
    console.log(`   [${actuallyOwned.map((id: bigint) => id.toString()).join(", ")}]`);
    
    // 3. Compare differences
    console.log(`\n📊 Comparison analysis:`);
    console.log(`   - Manager records: ${userNFTsFromManager.length} NFTs`);
    console.log(`   - Actually owned: ${actuallyOwned.length} NFTs`);
    
    // Find NFTs in Manager but not actually owned
    const inManagerButNotOwned = userNFTsFromManager.filter((id: bigint) => 
      !actuallyOwned.includes(id)
    );
    if (inManagerButNotOwned.length > 0) {
      console.log(`\n❌ NFTs in Manager but not actually owned:`);
      for (const id of inManagerButNotOwned) {
        const actualOwner = await nodeNFT.ownerOf(id);
        console.log(`   - NFT #${id}: Actual owner = ${actualOwner}`);
      }
    }
    
    // Find NFTs actually owned but not in Manager
    const ownedButNotInManager = actuallyOwned.filter((id: bigint) => 
      !userNFTsFromManager.includes(id)
    );
    if (ownedButNotInManager.length > 0) {
      console.log(`\n❌ NFTs actually owned but not in Manager:`);
      for (const id of ownedButNotInManager) {
        console.log(`   - NFT #${id}`);
      }
    }
    
    // 4. Special check for NFT #1
    console.log(`\n🎯 Special check for NFT #1:`);
    try {
      const nft1Owner = await nodeNFT.ownerOf(1);
      const nft1InList = userNFTsFromManager.includes(1n);
      console.log(`   - Actual owner (ownerOf): ${nft1Owner}`);
      console.log(`   - In Manager list: ${nft1InList ? '✅' : '❌'}`);
      console.log(`   - Match: ${nft1Owner.toLowerCase() === USER_ADDRESS.toLowerCase() ? '✅ Yes' : '❌ No'}`);
      
      if (nft1InList && nft1Owner.toLowerCase() !== USER_ADDRESS.toLowerCase()) {
        console.log(`\n⚠️  Warning: NFT #1 is in Manager list, but actual owner is not this user!`);
        console.log(`   This is a data inconsistency issue.`);
      }
    } catch (error: any) {
      console.log(`   - NFT #1 does not exist or query failed: ${error.message}`);
    }
    
  } catch (error: any) {
    console.error("❌ Query failed:", error.message);
  }
}

checkUserNFTs().catch(console.error);

