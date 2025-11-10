const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  
  const abi = [
    "function totalMinted() view returns (uint256)",
    "function getMinter(uint256 nftId) view returns (address)",
    "function setMinter(uint256 nftId, address minterAddress) external"
  ];
  
  const contract = new ethers.Contract("0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf", abi, signer);
  
  const totalMinted = await contract.totalMinted();
  console.log("totalMinted:", totalMinted.toString());
  
  // Try to get minter for NFT 1
  try {
    const minter = await contract.getMinter(1);
    console.log("NFT #1 minter:", minter);
  } catch (error) {
    console.log("NFT #1 getMinter error:", error.message);
  }
  
  // Try to estimate gas for setMinter
  try {
    const gas = await contract.setMinter.estimateGas(1, "0x8202044baBe9070395121350e2DABc2581a4E04E");
    console.log("setMinter gas estimate:", gas.toString());
  } catch (error) {
    console.log("setMinter estimateGas error:", error.message);
    console.log("Error code:", error.code);
    console.log("Error reason:", error.reason);
  }
}

main().catch(console.error);
