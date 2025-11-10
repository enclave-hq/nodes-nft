import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);
  
  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation Address:", newImplAddress);
  
  if (currentImpl.toLowerCase() === newImplAddress.toLowerCase()) {
    console.log("\n⚠️  WARNING: New implementation address is the same as current!");
    console.log("   This means the bytecode is identical.");
  } else {
    console.log("\n✅ New implementation is different, upgrading...");
    
    // Get proxy contract
    const proxy = await ethers.getContractAt("UUPSUpgradeable", PROXY_ADDRESS);
    
    // Upgrade
    const upgradeTx = await proxy.upgradeTo(newImplAddress);
    console.log("Upgrade transaction:", upgradeTx.hash);
    await upgradeTx.wait();
    
    // Verify
    const verifyImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("Verified Implementation:", verifyImpl);
    
    if (verifyImpl.toLowerCase() === newImplAddress.toLowerCase()) {
      console.log("✅ Upgrade successful!");
    } else {
      console.log("❌ Upgrade failed!");
    }
  }
}

main().catch(console.error);
