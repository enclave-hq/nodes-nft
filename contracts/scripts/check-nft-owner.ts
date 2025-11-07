import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const NODE_NFT_ADDRESS = process.env.NODE_NFT_ADDRESS || "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

async function checkNFTOwner() {
  console.log("🔍 Querying owner of NFT #1...\n");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // NodeNFT ABI (only need ownerOf function)
  const nodeNFTABI = [
    "function ownerOf(uint256 tokenId) view returns (address)"
  ];
  
  const nodeNFT = new ethers.Contract(NODE_NFT_ADDRESS, nodeNFTABI, provider);
  
  try {
    const owner = await nodeNFT.ownerOf(1);
    console.log(`✅ Owner of NFT #1: ${owner}`);
    
    // Also query getUserNFTs to check Manager records
    const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
    const nftManagerABI = [
      "function getUserNFTs(address user) view returns (uint256[])"
    ];
    
    const nftManager = new ethers.Contract(NFT_MANAGER_ADDRESS, nftManagerABI, provider);
    const userNFTs = await nftManager.getUserNFTs(owner);
    
    console.log(`\n📋 NFTs owned by this user recorded in Manager: [${userNFTs.map((id: bigint) => id.toString()).join(", ")}]`);
    
    if (userNFTs.includes(1n)) {
      console.log("✅ NFT #1 is in Manager's userNFTList");
    } else {
      console.log("❌ NFT #1 is not in Manager's userNFTList (inconsistent!)");
    }
    
  } catch (error: any) {
    console.error("❌ Query failed:", error.message);
    if (error.message.includes("ERC721NonexistentToken")) {
      console.log("ℹ️  NFT #1 does not exist (may not have been minted yet)");
    }
  }
}

checkNFTOwner().catch(console.error);

