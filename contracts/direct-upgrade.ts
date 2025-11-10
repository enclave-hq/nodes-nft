import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  console.log("Signer:", signer.address);
  
  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  // Get current implementation from storage slot
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const currentImplStorage = await ethers.provider.getStorage(PROXY_ADDRESS, implSlot);
  const currentImpl = ethers.getAddress("0x" + currentImplStorage.slice(-40));
  console.log("Current Implementation (from storage):", currentImpl);
  
  // Call upgradeTo directly on the proxy
  const proxyABI = ["function upgradeTo(address newImplementation) external"];
  const proxy = new ethers.Contract(PROXY_ADDRESS, proxyABI, signer);
  
  console.log("\nCalling upgradeTo...");
  const tx = await proxy.upgradeTo(newImplAddress, { gasLimit: 5000000 });
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Upgrade transaction confirmed! Gas used:", receipt.gasUsed.toString());
  
  // Verify
  const newImplStorage = await ethers.provider.getStorage(PROXY_ADDRESS, implSlot);
  const verifiedImpl = ethers.getAddress("0x" + newImplStorage.slice(-40));
  console.log("\nVerified Implementation:", verifiedImpl);
  
  if (verifiedImpl.toLowerCase() === newImplAddress.toLowerCase()) {
    console.log("✅ Upgrade successful! Implementation changed.");
  } else {
    console.log("❌ Upgrade failed! Implementation did not change.");
  }
}

main().catch(console.error);
