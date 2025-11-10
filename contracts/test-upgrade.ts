import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Get proxy contract
  const proxy = await ethers.getContractAt("NFTManager", PROXY_ADDRESS);
  
  // Check owner
  const owner = await proxy.owner();
  console.log("Owner:", owner);
  console.log("Signer:", signer.address);
  
  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  // Try to call upgradeTo through the proxy
  // The proxy will delegatecall to the implementation's upgradeTo function
  console.log("\nCalling upgradeTo through proxy...");
  try {
    // Estimate gas first
    const gasEstimate = await proxy.upgradeTo.estimateGas(newImplAddress);
    console.log("Gas estimate:", gasEstimate.toString());
    
    // Call upgradeTo
    const tx = await proxy.upgradeTo(newImplAddress);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Upgrade successful! Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.log("❌ Error:", error.message);
    if (error.reason) {
      console.log("Reason:", error.reason);
    }
    if (error.data) {
      console.log("Data:", error.data);
    }
  }
}

main().catch(console.error);
