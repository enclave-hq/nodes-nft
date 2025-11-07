import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const OLD_NODE_NFT_ADDRESS = "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY;

async function fixInconsistencies() {
  console.log("🔧 Fixing existing userNFTList inconsistencies...\n");
  
  if (!PRIVATE_KEY) {
    console.error("❌ ADMIN_PRIVATE_KEY or PRIVATE_KEY must be set");
    return;
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  const nodeNFTABI = ["function ownerOf(uint256 tokenId) view returns (address)"];
  const nftManagerABI = [
    "function getUserNFTs(address user) view returns (uint256[])",
    "function fixUserNFTList(uint256 nftId, address wrongUser) external",
    "function totalMinted() view returns (uint256)"
  ];
  
  const oldNodeNFT = new ethers.Contract(OLD_NODE_NFT_ADDRESS, nodeNFTABI, provider);
  const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, wallet);
  
  try {
    // Check if fixUserNFTList function exists
    const hasFixFunction = nftManager.interface.hasFunction("fixUserNFTList");
    if (!hasFixFunction) {
      console.log("❌ NFTManager contract does not contain fixUserNFTList function, please upgrade contract first");
      return;
    }
    
    // Get total minted count
    const totalMinted = await nftManager.totalMinted();
    console.log(`📊 Total NFT count: ${totalMinted}\n`);
    
    // Check inconsistencies for each NFT
    const inconsistencies: Array<{nftId: number, actualOwner: string, wrongUser: string}> = [];
    
    for (let i = 1; i <= Number(totalMinted); i++) {
      try {
        const actualOwner = await oldNodeNFT.ownerOf(i);
        const userNFTs = await nftManager.getUserNFTs(actualOwner);
        const inList = userNFTs.includes(BigInt(i));
        
        if (!inList) {
          // Find which user's list this NFT is in
          // Simplified: check all known users (here we only check actual owner)
          // Actually need to iterate through all possible users, but for simplicity, we assume NFT is in wrong list
          console.log(`⚠️  NFT #${i} is missing from owner ${actualOwner.slice(0, 10)}...'s list`);
          
          // Try to find from other users' lists
          // We need a smarter method here, but for demonstration, we assume it needs fixing
          inconsistencies.push({
            nftId: i,
            actualOwner,
            wrongUser: "" // Need to manually specify or find through other means
          });
        }
      } catch (error: any) {
        if (!error.message.includes("ERC721NonexistentToken")) {
          console.log(`⚠️  NFT #${i}: ${error.message}`);
        }
      }
    }
    
    // Fix known inconsistencies (NFT #1 and #6)
    console.log(`\n🔧 Fixing known inconsistencies...`);
    const knownFixes = [
      { nftId: 1, wrongUser: "0x8202044babe9070395121350e2dabc2581a4e04e" },
      { nftId: 6, wrongUser: "0x8202044babe9070395121350e2dabc2581a4e04e" }
    ];
    
    for (const fix of knownFixes) {
      try {
        const actualOwner = await oldNodeNFT.ownerOf(fix.nftId);
        console.log(`\n📝 Fixing NFT #${fix.nftId}:`);
        console.log(`   - Actual owner: ${actualOwner}`);
        console.log(`   - Incorrectly recorded in: ${fix.wrongUser}`);
        
        const fixTx = await nftManager.fixUserNFTList(fix.nftId, fix.wrongUser);
        await fixTx.wait();
        console.log(`   ✅ Fix successful (Tx: ${fixTx.hash})`);
        
        // Verify fix
        const oldOwnerNFTs = await nftManager.getUserNFTs(fix.wrongUser);
        const newOwnerNFTs = await nftManager.getUserNFTs(actualOwner);
        const isInOldList = oldOwnerNFTs.includes(BigInt(fix.nftId));
        const isInNewList = newOwnerNFTs.includes(BigInt(fix.nftId));
        
        if (!isInOldList && isInNewList) {
          console.log(`   ✅ Verification passed: Removed from old list, added to new list`);
        } else {
          console.log(`   ⚠️  Verification failed: In old list=${isInOldList}, In new list=${isInNewList}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Fix failed: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Fix completed`);
    
  } catch (error: any) {
    console.error("❌ Fix failed:", error.message);
  }
}

fixInconsistencies().catch(console.error);
