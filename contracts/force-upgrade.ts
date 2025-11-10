import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Deploy new implementation directly
  console.log("Deploying new implementation...");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const newImpl = await NFTManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New Implementation Address:", newImplAddress);
  
  // Upgrade proxy to new implementation
  console.log("Upgrading proxy...");
  const proxy = await ethers.getContractAt("NFTManager", PROXY_ADDRESS);
  const upgradeTx = await proxy.upgradeTo(newImplAddress);
  await upgradeTx.wait();
  console.log("Upgrade transaction:", upgradeTx.hash);
  
  console.log("✅ Upgrade complete!");
  console.log("New Implementation:", newImplAddress);
}

main().catch(console.error);
