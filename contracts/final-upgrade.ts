import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Deploy new implementation
  console.log("Deploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  // Use UUPS interface
  const uupsABI = ["function upgradeTo(address newImplementation) external"];
  const proxy = new ethers.Contract(PROXY_ADDRESS, uupsABI, signer);
  
  console.log("\nCalling upgradeTo...");
  const tx = await proxy.upgradeTo(newImplAddress);
  console.log("Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Upgrade successful! Gas used:", receipt.gasUsed.toString());
  
  // Verify
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implStorage = await ethers.provider.getStorage(PROXY_ADDRESS, implSlot);
  const verifiedImpl = ethers.getAddress("0x" + implStorage.slice(-40));
  console.log("Verified Implementation:", verifiedImpl);
}

main().catch(console.error);
