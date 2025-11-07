import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.NFT_MANAGER_ADDRESS || "0x2252c4fC3D79120f001de5C33E5E82F1E56097c5";
  
  console.log("🔍 Debugging Contract Storage\n");
  console.log("=".repeat(70));
  
  const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545");
  
  // Read storage slots directly
  // Based on OpenZeppelin upgradeable pattern:
  // Slot 0: _owner (OwnableUpgradeable)
  // Slot 1: _status (ReentrancyGuardUpgradeable) 
  // Slot 2: _initialized (Initializable)
  // Slot 3: _initializing (Initializable)
  // Slot 4-10: NFTManager state variables...
  
  // Expected slots based on storage layout:
  // whitelistCount: slot 11
  // transfersEnabled: slot 12  
  // currentBatchId: slot 14
  // totalMinted: slot 15
  
  const slots = [
    { name: "Slot 0 (_owner)", slot: 0 },
    { name: "Slot 11 (whitelistCount)", slot: 11 },
    { name: "Slot 12 (transfersEnabled)", slot: 12 },
    { name: "Slot 14 (currentBatchId)", slot: 14 },
    { name: "Slot 15 (totalMinted)", slot: 15 },
  ];
  
  for (const { name, slot } of slots) {
    try {
      const value = await provider.getStorage(PROXY_ADDRESS, slot);
      console.log(`${name}: ${value}`);
      if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        // Try to decode as uint256
        const numValue = BigInt(value);
        console.log(`   Decoded: ${numValue.toString()}`);
      }
    } catch (error: any) {
      console.log(`${name}: Error - ${error.message}`);
    }
  }
  
  console.log("\n" + "=".repeat(70));
  
  // Try calling owner() to verify contract is accessible
  const [deployer] = await ethers.getSigners();
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(PROXY_ADDRESS);
  
  try {
    const owner = await manager.owner();
    console.log(`✅ Contract owner: ${owner}`);
  } catch (error: any) {
    console.log(`❌ Failed to get owner: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Debug failed:");
    console.error(error);
    process.exit(1);
  });

