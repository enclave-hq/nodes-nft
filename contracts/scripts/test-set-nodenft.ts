import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const NFT_MANAGER_ADDRESS = "0x43BBBe60Cdea702fa81fDCCDAeC7E6052e5C7D68";
  const NODE_NFT_ADDRESS = "0xdF819A8153500eABCB0157ec2aE031b7f150D83a";
  
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const manager = NFTManager.attach(NFT_MANAGER_ADDRESS);
  
  // Check if function exists
  const hasFunction = manager.interface.hasFunction("setNodeNFT");
  console.log("Has setNodeNFT function:", hasFunction);
  
  // Check current NodeNFT
  const current = await manager.nodeNFT();
  console.log("Current NodeNFT:", current);
  
  // Check owner
  const owner = await manager.owner();
  console.log("Owner:", owner);
  console.log("Is deployer owner:", owner.toLowerCase() === deployer.address.toLowerCase());
  
  if (hasFunction && owner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("\nAttempting to call setNodeNFT...");
    try {
      const tx = await manager.setNodeNFT(NODE_NFT_ADDRESS, { gasLimit: 500000 });
      console.log("Tx hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("Success! Block:", receipt.blockNumber);
      
      // Verify
      const newAddress = await manager.nodeNFT();
      console.log("New NodeNFT address:", newAddress);
    } catch (error: any) {
      console.log("Error:", error.message);
      if (error.reason) {
        console.log("Reason:", error.reason);
      }
      if (error.data) {
        console.log("Data:", error.data);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

