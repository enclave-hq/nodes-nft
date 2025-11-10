const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // NodeNFT contract
  const nodeNFTABI = [
    "function totalSupply() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function balanceOf(address owner) view returns (uint256)"
  ];
  const nodeNFTAddress = "0x92301C0acA7586d9F0B1968af2502616009Abf69";
  const nodeNFT = new ethers.Contract(nodeNFTAddress, nodeNFTABI, provider);
  
  // NFTManager contract
  const nftManagerABI = [
    "function totalMinted() view returns (uint256)",
    "function nodeNFT() view returns (address)"
  ];
  const nftManagerAddress = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  const nftManager = new ethers.Contract(nftManagerAddress, nftManagerABI, provider);
  
  // Check totalMinted from NFTManager
  const totalMinted = await nftManager.totalMinted();
  console.log("NFTManager totalMinted:", totalMinted.toString());
  
  // Check NodeNFT totalSupply
  try {
    const totalSupply = await nodeNFT.totalSupply();
    console.log("NodeNFT totalSupply:", totalSupply.toString());
  } catch (error) {
    console.log("NodeNFT totalSupply not available, checking manually...");
  }
  
  // Check NFTs manually by trying ownerOf
  console.log("\nChecking NFTs manually...");
  let foundNFTs = 0;
  for (let i = 1; i <= 30; i++) {
    try {
      const owner = await nodeNFT.ownerOf(i);
      if (owner && owner !== "0x0000000000000000000000000000000000000000") {
        foundNFTs++;
        if (foundNFTs <= 5) {
          console.log(`  NFT #${i}: owner = ${owner}`);
        }
      }
    } catch (error) {
      // NFT doesn't exist
    }
  }
  console.log(`\nFound ${foundNFTs} NFTs in NodeNFT contract`);
}

main().catch(console.error);
