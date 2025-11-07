import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🔍 Debugging onNFTTransfer call issues\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  
  const NODE_NFT = '0x92301C0acA7586d9F0B1968af2502616009Abf69';
  const NFT_MANAGER = '0xF87F9296955439C323ac79769959bEe087f6D06E';

  const NodeNFTABI = [
    "function nftManager() view returns (address)",
    "function ownerOf(uint256) view returns (address)"
  ];
  
  const NFTManagerABI = [
    "function nodeNFT() view returns (address)",
    "function transfersEnabled() view returns (bool)",
    "function onNFTTransfer(address, address, uint256) external"
  ];

  const nodeNFT = new ethers.Contract(NODE_NFT, NodeNFTABI, deployer);
  const nftManager = new ethers.Contract(NFT_MANAGER, NFTManagerABI, deployer);

  try {
    // 1. Check bidirectional connection
    console.log("1. Checking bidirectional connection:");
    const nodeNFTManager = await nodeNFT.nftManager();
    const managerNodeNFT = await nftManager.nodeNFT();
    
    console.log("   NodeNFT.nftManager:", nodeNFTManager);
    console.log("   NFTManager.nodeNFT:", managerNodeNFT);
    console.log("   Match:", nodeNFTManager.toLowerCase() === NFT_MANAGER.toLowerCase() ? "✅" : "❌");
    console.log("");

    // 2. Check transfersEnabled
    console.log("2. Checking transfersEnabled:");
    const transfersEnabled = await nftManager.transfersEnabled();
    console.log("   transfersEnabled:", transfersEnabled);
    console.log("");

    // 3. Check nodeNFT type in NFTManager
    console.log("3. Checking nodeNFT type in NFTManager:");
    console.log("   managerNodeNFT type:", typeof managerNodeNFT);
    console.log("   managerNodeNFT value:", managerNodeNFT);
    console.log("   NODE_NFT value:", NODE_NFT);
    console.log("   Address match:", managerNodeNFT.toLowerCase() === NODE_NFT.toLowerCase() ? "✅" : "❌");
    console.log("");

    // 4. Try to directly call onNFTTransfer (simulate NodeNFT call)
    console.log("4. Trying to directly call onNFTTransfer (using NodeNFT contract address as sender):");
    try {
      // Create a contract instance using NodeNFT address as sender
      const nodeNFTContract = new ethers.Contract(NODE_NFT, [], deployer);
      
      // Use callStatic to test the call (won't actually execute)
      const testCall = await nftManager.onNFTTransfer.staticCall(
        deployer.address, // from
        deployer.address, // to (same address for test)
        1n // nftId
      );
      console.log("   ✅ Call successful (static call)");
    } catch (error: any) {
      console.log("   ❌ Call failed:", error.message);
      if (error.reason) {
        console.log("   Reason:", error.reason);
      }
    }
    console.log("");

    // 5. Check root cause
    console.log("5. Problem analysis:");
    console.log("   When NodeNFT._update uses call() to call onNFTTransfer:");
    console.log("   - msg.sender should be:", NODE_NFT);
    console.log("   - NFTManager.nodeNFT should be:", managerNodeNFT);
    console.log("   - If addresses don't match, require will fail");
    console.log("");

    if (managerNodeNFT.toLowerCase() !== NODE_NFT.toLowerCase()) {
      console.log("❌ Issue found: NFTManager.nodeNFT address mismatch!");
      console.log("   Need to update NFTManager.nodeNFT to:", NODE_NFT);
    } else {
      console.log("✅ Addresses match, issue might be elsewhere");
      console.log("   Possible reasons:");
      console.log("   1. Insufficient gas");
      console.log("   2. onNFTTransfer internal logic error");
      console.log("   3. _removeFromUserList or userNFTList operation failed");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

