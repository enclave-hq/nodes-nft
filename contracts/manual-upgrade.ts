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
  
  // Get proxy contract - use the actual proxy interface
  // The proxy is a UUPS proxy, so we need to call upgradeTo on the proxy itself
  // But the proxy delegates to the implementation, so we need to call it through the proxy
  
  // Create a contract instance that will call upgradeTo
  // The proxy contract itself has upgradeTo function from UUPSUpgradeable
  const proxyABI = [
    "function upgradeTo(address newImplementation) external",
    "function owner() external view returns (address)"
  ];
  
  const proxy = new ethers.Contract(PROXY_ADDRESS, proxyABI, signer);
  
  // Verify owner
  const owner = await proxy.owner();
  console.log("\nProxy Owner:", owner);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ Signer is not the owner!");
    return;
  }
  
  // Call upgradeTo
  console.log("\nCalling upgradeTo...");
  try {
    const tx = await proxy.upgradeTo(newImplAddress, { gasLimit: 5000000 });
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Upgrade successful! Gas used:", receipt.gasUsed.toString());
    
    // Verify
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implAddress = await ethers.provider.getStorage(PROXY_ADDRESS, implSlot);
    const decodedImpl = ethers.getAddress("0x" + implAddress.slice(-40));
    console.log("Verified Implementation:", decodedImpl);
  } catch (error: any) {
    console.log("❌ Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
  }
}

main().catch(console.error);
