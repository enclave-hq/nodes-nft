import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  console.log("Signer:", signer.address);
  console.log("Proxy:", PROXY_ADDRESS);
  
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);
  
  // Deploy new implementation manually
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  // Use upgrades.upgradeProxy but force it to use our new implementation
  console.log("\nUpgrading proxy...");
  try {
    // First, register the proxy
    await upgrades.forceImport(PROXY_ADDRESS, NFTManager, { kind: "uups" });
    
    // Now upgrade with the specific implementation
    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, NFTManager, {
      kind: "uups",
      unsafeAllow: ["constructor", "state-variable-immutable"],
      unsafeSkipStorageCheck: true,
      // Force use our new implementation
      implementation: newImplAddress,
    });
    
    await upgraded.waitForDeployment();
    
    const verifyImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("\n✅ Upgrade complete!");
    console.log("New Implementation:", verifyImpl);
  } catch (error: any) {
    console.log("\n❌ Upgrade failed:", error.message);
    console.log("Error:", error);
  }
}

main().catch(console.error);
