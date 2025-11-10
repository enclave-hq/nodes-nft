import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  console.log("Current Implementation:", await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS));
  
  // Force upgrade by deploying new implementation first
  console.log("\nDeploying new implementation and upgrading...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  
  // Deploy implementation manually first
  const impl = await NFTManager.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("New Implementation:", implAddress);
  
  // Now upgrade proxy to this implementation
  const proxy = await ethers.getContractAt("@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol:UUPSUpgradeable", PROXY_ADDRESS);
  const upgradeTx = await proxy.upgradeTo(implAddress);
  console.log("Upgrade transaction:", upgradeTx.hash);
  await upgradeTx.wait();
  
  console.log("\n✅ Upgrade complete!");
  console.log("New Implementation:", await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS));
}

main().catch(console.error);
