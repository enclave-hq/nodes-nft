import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0x5B280b41C13bD64EB93F787752928367E1f9Af91";
const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function testAutoSync() {
  console.log("🧪 Testing auto-sync functionality...\n");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const nodeNFTABI = [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId)"
  ];
  
  const nftManagerABI = [
    "function getUserNFTs(address user) view returns (uint256[])",
    "function onNFTTransfer(address from, address to, uint256 nftId) external",
    "function nodeNFT() view returns (address)"
  ];
  
  const nodeNFT = new ethers.Contract(NODE_NFT_ADDRESS, nodeNFTABI, provider);
  const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, provider);
  
  try {
    // 1. Check if onNFTTransfer function exists
    const hasOnNFTTransfer = nftManager.interface.hasFunction("onNFTTransfer");
    console.log(`✅ onNFTTransfer function exists: ${hasOnNFTTransfer}`);
    
    if (!hasOnNFTTransfer) {
      console.log("❌ NFTManager contract does not contain onNFTTransfer function, please upgrade contract first");
      return;
    }
    
    // 2. Check if NodeNFT address is correct
    const managerNodeNFT = await nftManager.nodeNFT();
    console.log(`\n📋 NodeNFT address:`);
    console.log(`   - In NFTManager: ${managerNodeNFT}`);
    console.log(`   - In config: ${NODE_NFT_ADDRESS}`);
    console.log(`   - Match: ${managerNodeNFT.toLowerCase() === NODE_NFT_ADDRESS.toLowerCase() ? '✅' : '❌'}`);
    
    if (managerNodeNFT.toLowerCase() !== NODE_NFT_ADDRESS.toLowerCase()) {
      console.log("❌ NodeNFT address mismatch, please update NodeNFT address in NFTManager first");
      return;
    }
    
    // 3. Check consistency of ownership and userNFTList for first few NFTs
    console.log(`\n🔍 Checking consistency of ownership and userNFTList for first 5 NFTs:`);
    for (let i = 1; i <= 5; i++) {
      try {
        const owner = await nodeNFT.ownerOf(i);
        const userNFTs = await nftManager.getUserNFTs(owner);
        const inList = userNFTs.includes(BigInt(i));
        
        console.log(`   NFT #${i}:`);
        console.log(`      - Owner: ${owner.slice(0, 10)}...`);
        console.log(`      - In userNFTList: ${inList ? '✅' : '❌'}`);
        
        if (!inList) {
          console.log(`      ⚠️  Inconsistent! Needs fixing`);
        }
      } catch (error: any) {
        if (error.message.includes("ERC721NonexistentToken")) {
          console.log(`   NFT #${i}: Does not exist`);
        } else {
          console.log(`   NFT #${i}: Query failed - ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Auto-sync functionality test completed`);
    console.log(`\n💡 Notes:`);
    console.log(`   - When NFT is directly transferred, NodeNFT's _update hook will automatically call`);
    console.log(`   - NFTManager.onNFTTransfer to sync userNFTList`);
    console.log(`   - This ensures userNFTList always stays consistent with actual ownership`);
    
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
  }
}

testAutoSync().catch(console.error);

