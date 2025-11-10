const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545");
  const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = await NFTManager.attach("0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf");
  
  console.log("Testing setMinter for NFT #1...");
  try {
    const tx = await manager.setMinter(1, "0x8202044baBe9070395121350e2DABc2581a4E04E");
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Success! Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
