import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY_ADDRESS = "0x8c8C0DDE64EBe24978219Ab23489AE2bB41f0AAf";
  
  // Get proxy contract with full ABI
  const proxy = await ethers.getContractAt("NFTManager", PROXY_ADDRESS);
  
  // Check if upgradeTo exists in the interface
  const hasUpgradeTo = proxy.interface.hasFunction("upgradeTo");
  console.log("Has upgradeTo function:", hasUpgradeTo);
  
  // List all functions
  const functions = proxy.interface.fragments.filter(f => f.type === "function");
  const upgradeFunctions = functions.filter(f => f.name.includes("upgrade") || f.name.includes("Upgrade"));
  console.log("\nUpgrade-related functions:");
  upgradeFunctions.forEach(f => console.log("  -", f.name));
  
  // Try to get the function signature
  try {
    const upgradeToFragment = proxy.interface.getFunction("upgradeTo");
    console.log("\nupgradeTo signature:", upgradeToFragment.format());
  } catch (e) {
    console.log("\nupgradeTo not found in interface");
  }
}

main().catch(console.error);
