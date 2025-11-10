import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImpl);
  
  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation:", newImplAddress);
  
  if (currentImpl.toLowerCase() !== newImplAddress.toLowerCase()) {
    console.log("\n✅ New implementation is different, upgrading...");
    
    // Use the UUPS interface directly
    const uupsInterface = new ethers.Interface([
      "function upgradeTo(address newImplementation) external"
    ]);
    
    const proxy = new ethers.Contract(PROXY_ADDRESS, uupsInterface, signer);
    const upgradeTx = await proxy.upgradeTo(newImplAddress);
    console.log("Upgrade transaction:", upgradeTx.hash);
    const receipt = await upgradeTx.wait();
    console.log("Gas used:", receipt.gasUsed.toString());
    
    const verifyImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("\nVerified Implementation:", verifyImpl);
    
    if (verifyImpl.toLowerCase() === newImplAddress.toLowerCase()) {
      console.log("✅ Upgrade successful!");
    } else {
      console.log("❌ Upgrade failed!");
    }
  } else {
    console.log("\n⚠️  Implementation addresses are the same!");
  }
}

main().catch(console.error);
