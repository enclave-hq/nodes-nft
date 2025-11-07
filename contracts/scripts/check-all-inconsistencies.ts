import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Use the NodeNFT address from NFTManager (which points to the old contract with existing NFTs)
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function checkAllInconsistencies() {
  console.log("🔍 Checking consistency of all NFT ownership and Manager records...\n");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const nodeNFTABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
  const nftManagerABI = [
    "function getUserNFTs(address user) view returns (uint256[])",
    "function totalMinted() view returns (uint256)",
    "function nodeNFT() view returns (address)"
  ];
  
  const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, provider);
  
  try {
    // Get NodeNFT address from NFTManager
    const managerNodeNFTAddress = await nftManager.nodeNFT();
    console.log(`📋 NodeNFT pointed to by NFTManager: ${managerNodeNFTAddress}\n`);
    
    const nodeNFT = new ethers.Contract(managerNodeNFTAddress, nodeNFTABI, provider);
    
    const totalMinted = await nftManager.totalMinted();
    console.log(`Total of ${totalMinted} NFTs\n`);
    
    // Collect all user addresses
    const userAddresses = new Set<string>();
    const nftOwnership: Map<number, string> = new Map();
    
    // 1. Query actual owners of all NFTs
    console.log("📋 Querying actual owners of all NFTs...");
    for (let i = 1; i <= Number(totalMinted); i++) {
      try {
        const owner = await nodeNFT.ownerOf(i);
        const ownerLower = owner.toLowerCase();
        userAddresses.add(ownerLower);
        nftOwnership.set(i, ownerLower);
      } catch (error) {
        console.log(`   NFT #${i} does not exist or query failed`);
      }
    }
    
    console.log(`   Found ${userAddresses.size} different user addresses\n`);
    
    // 2. For each user, check consistency between Manager records and actual ownership
    const inconsistencies: Array<{
      nftId: number;
      actualOwner: string;
      recordedIn: string[];
    }> = [];
    
    console.log("🔍 Checking each user's records...\n");
    for (const userAddr of userAddresses) {
      const userNFTsFromManager = await nftManager.getUserNFTs(userAddr);
      
      // Check if each NFT recorded in Manager actually belongs to this user
      for (const nftIdBigInt of userNFTsFromManager) {
        const nftId = Number(nftIdBigInt);
        const actualOwner = nftOwnership.get(nftId);
        
        if (!actualOwner) {
          console.log(`⚠️  NFT #${nftId} is in Manager records but does not exist`);
          continue;
        }
        
        if (actualOwner !== userAddr) {
          inconsistencies.push({
            nftId,
            actualOwner,
            recordedIn: [userAddr]
          });
          console.log(`❌ NFT #${nftId}:`);
          console.log(`   Actual owner: ${actualOwner}`);
          console.log(`   Incorrectly recorded in: ${userAddr}`);
        }
      }
    }
    
    // 3. Check NFTs that are actually owned but not in Manager
    console.log("\n🔍 Checking NFTs that are actually owned but not in Manager...\n");
    for (let i = 1; i <= Number(totalMinted); i++) {
      const actualOwner = nftOwnership.get(i);
      if (!actualOwner) continue;
      
      const userNFTsFromManager = await nftManager.getUserNFTs(actualOwner);
      if (!userNFTsFromManager.includes(BigInt(i))) {
        console.log(`❌ NFT #${i}:`);
        console.log(`   Actual owner: ${actualOwner}`);
        console.log(`   Not in Manager list`);
      }
    }
    
    // 4. Summary
    console.log("\n📊 Summary:");
    console.log(`   - Total NFT count: ${totalMinted}`);
    console.log(`   - Inconsistent NFT count: ${inconsistencies.length}`);
    
    if (inconsistencies.length > 0) {
      console.log("\n⚠️  Data inconsistency issues found:");
      for (const inc of inconsistencies) {
        console.log(`   - NFT #${inc.nftId}: Actual owner ${inc.actualOwner}, but incorrectly recorded in ${inc.recordedIn.join(", ")}`);
      }
    }
    
  } catch (error: any) {
    console.error("❌ Query failed:", error.message);
  }
}

checkAllInconsistencies().catch(console.error);

