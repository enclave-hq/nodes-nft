import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Check owner
  const proxy = await ethers.getContractAt("NFTManager", PROXY_ADDRESS);
  const owner = await proxy.owner();
  console.log("Proxy Owner:", owner);
  console.log("Signer:", signer.address);
  console.log("Is Owner:", owner.toLowerCase() === signer.address.toLowerCase());
  
  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  // Try to call upgradeTo with more details
  const uupsInterface = new ethers.Interface([
    "function upgradeTo(address newImplementation) external"
  ]);
  
  const proxyUUPS = new ethers.Contract(PROXY_ADDRESS, uupsInterface, signer);
  
  try {
    // Try to estimate gas first
    const gasEstimate = await proxyUUPS.upgradeTo.estimateGas(newImplAddress);
    console.log("\nGas estimate:", gasEstimate.toString());
    
    // If estimate works, try the actual call
    const upgradeTx = await proxyUUPS.upgradeTo(newImplAddress);
    console.log("Upgrade transaction:", upgradeTx.hash);
    await upgradeTx.wait();
    console.log("✅ Upgrade successful!");
  } catch (error: any) {
    console.log("\n❌ Error:", error.message);
    console.log("Error code:", error.code);
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
  }
}

main().catch(console.error);
