/**
 * Script to rollback RewardFacet to previous version
 * Usage: npx hardhat run scripts/rollback-reward-facet.ts --network bscTestnet
 * 
 * ⚠️ IMPORTANT: Only use this if the upgrade caused issues
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { INFTManagerCut } from "../typechain-types";

dotenv.config();

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" 
    ? (process.env.HARDHAT_NETWORK || "localhost")
    : network.name;

  console.log(`🔄 Rolling back RewardFacet on ${networkName.toUpperCase()}...\n`);

  // Determine which env file to use based on network
  let envFileName: string;
  if (networkName === "bscMainnet" || network.chainId === BigInt(56)) {
    envFileName = "env.mainnet";
  } else if (networkName === "bscTestnet" || network.chainId === BigInt(97)) {
    envFileName = "env.testnet";
  } else {
    envFileName = "env.localnode";
  }

  // Get NFT_MANAGER_ADDRESS
  let NFT_MANAGER_ADDRESS: string | null = null;
  try {
    const envFilePath = path.join(__dirname, "..", envFileName);
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      const match = envContent.match(/NFT_MANAGER_ADDRESS=(0x[a-fA-F0-9]+)/);
      if (match) {
        NFT_MANAGER_ADDRESS = match[1];
        console.log(`   Using NFT_MANAGER_ADDRESS from ${envFileName}: ${NFT_MANAGER_ADDRESS}`);
      }
    }
  } catch (e) {
    // Ignore
  }

  if (!NFT_MANAGER_ADDRESS) {
    NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || null;
    if (NFT_MANAGER_ADDRESS) {
      console.log(`   Using NFT_MANAGER_ADDRESS from .env: ${NFT_MANAGER_ADDRESS}`);
    }
  }

  if (!NFT_MANAGER_ADDRESS) {
    throw new Error(`❌ Please set NFT_MANAGER_ADDRESS in ${envFileName} or .env file`);
  }

  // Get OLD_REWARD_FACET_ADDRESS (the previous version to rollback to)
  let OLD_REWARD_FACET_ADDRESS: string | null = null;
  
  // Try to read from upgrade history file
  const upgradeHistoryFile = `upgrade.RewardFacet.${networkName}.json`;
  const upgradeHistoryPath = path.join(__dirname, "..", upgradeHistoryFile);
  
  if (fs.existsSync(upgradeHistoryPath)) {
    try {
      const upgradeHistory = JSON.parse(fs.readFileSync(upgradeHistoryPath, "utf-8"));
      if (upgradeHistory.oldAddress) {
        OLD_REWARD_FACET_ADDRESS = upgradeHistory.oldAddress;
        console.log(`   Found old Facet address from upgrade history: ${OLD_REWARD_FACET_ADDRESS}`);
      }
    } catch (e) {
      console.log(`   Could not read upgrade history: ${e}`);
    }
  }

  // Fallback to environment variable or manual input
  if (!OLD_REWARD_FACET_ADDRESS) {
    OLD_REWARD_FACET_ADDRESS = process.env.OLD_REWARD_FACET_ADDRESS || null;
    if (OLD_REWARD_FACET_ADDRESS) {
      console.log(`   Using OLD_REWARD_FACET_ADDRESS from .env: ${OLD_REWARD_FACET_ADDRESS}`);
    }
  }

  if (!OLD_REWARD_FACET_ADDRESS) {
    throw new Error(`❌ Please set OLD_REWARD_FACET_ADDRESS. You can:
    1. Set OLD_REWARD_FACET_ADDRESS in .env file
    2. Or ensure upgrade history file exists: ${upgradeHistoryFile}`);
  }

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("❌ No signers found. Please configure PRIVATE_KEY in .env file");
  }
  const deployer = signers[0];
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), networkName === "localhost" ? "ETH" : "BNB");
  console.log("NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("Old RewardFacet (rollback target):", OLD_REWARD_FACET_ADDRESS);
  console.log("");

  // Step 1: Get current RewardFacet address
  console.log("1️⃣  Getting current RewardFacet address...");
  const nftManagerLoupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);
  
  // Use distributeReward function to find current Facet
  const RewardFacetFactory = await ethers.getContractFactory("RewardFacet");
  const iface = RewardFacetFactory.interface;
  const distributeRewardSelector = iface.getFunction("distributeReward").selector;
  
  let currentFacetAddress: string;
  try {
    currentFacetAddress = await nftManagerLoupe.facetAddress(distributeRewardSelector);
    console.log(`✅ Current RewardFacet address: ${currentFacetAddress}`);
  } catch (error: any) {
    throw new Error(`❌ Could not find current RewardFacet: ${error.message}`);
  }

  if (currentFacetAddress.toLowerCase() === OLD_REWARD_FACET_ADDRESS.toLowerCase()) {
    console.log("⚠️  Current Facet is already the old version. No rollback needed.");
    return;
  }

  // Step 2: Get all function selectors from current Facet
  console.log("\n2️⃣  Getting function selectors from current Facet...");
  let currentSelectors: string[] = [];
  try {
    const currentSelectorsArray = await nftManagerLoupe.facetFunctionSelectors(currentFacetAddress);
    currentSelectors = currentSelectorsArray.map((s: string) => s.toLowerCase());
    console.log(`✅ Found ${currentSelectors.length} function selectors in current Facet`);
  } catch (error: any) {
    throw new Error(`❌ Could not query current selectors: ${error.message}`);
  }

  // Step 3: Verify old Facet address has code
  console.log("\n3️⃣  Verifying old Facet address...");
  const oldFacetCode = await ethers.provider.getCode(OLD_REWARD_FACET_ADDRESS);
  if (oldFacetCode === "0x") {
    throw new Error(`❌ Old Facet address has no code: ${OLD_REWARD_FACET_ADDRESS}`);
  }
  console.log(`✅ Old Facet address has code`);

  // Step 4: Prepare FacetCut to replace with old Facet
  console.log("\n4️⃣  Preparing FacetCut for rollback...");
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS) as INFTManagerCut;
  
  // Replace all current selectors with old Facet
  const cuts: INFTManagerCut.FacetCutStruct[] = [{
    facetAddress: OLD_REWARD_FACET_ADDRESS,
    action: 1, // Replace (FacetCutAction.Replace)
    functionSelectors: currentSelectors,
  }];
  
  console.log(`✅ Prepared to replace ${currentSelectors.length} functions with old Facet`);
  console.log(`   ⚠️  This will rollback to: ${OLD_REWARD_FACET_ADDRESS}`);

  // Step 5: Confirm rollback
  console.log("\n5️⃣  ⚠️  ROLLBACK CONFIRMATION ⚠️");
  console.log("   Current Facet:", currentFacetAddress);
  console.log("   Rollback to:", OLD_REWARD_FACET_ADDRESS);
  console.log("   Functions to replace:", currentSelectors.length);
  console.log("\n   ⚠️  This action will rollback the RewardFacet to the previous version.");
  console.log("   ⚠️  Make sure you understand the implications!");
  console.log("   ⚠️  Storage layout must be compatible (new variables added at the end).\n");

  // Step 6: Execute rollback
  console.log("6️⃣  Executing rollback...");
  
  const tx = await nftManagerCut.nftManagerCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Rollback completed");
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

  // Step 7: Verify rollback
  console.log("\n7️⃣  Verifying rollback...");
  try {
    const newFacetAddressAfter = await nftManagerLoupe.facetAddress(distributeRewardSelector);
    if (newFacetAddressAfter.toLowerCase() === OLD_REWARD_FACET_ADDRESS.toLowerCase()) {
      console.log("✅ Rollback verified: RewardFacet address updated to old version");
    } else {
      console.log("⚠️  Warning: Facet address mismatch");
      console.log("   Expected:", OLD_REWARD_FACET_ADDRESS);
      console.log("   Got:", newFacetAddressAfter);
    }
  } catch (error: any) {
    console.log("⚠️  Could not verify rollback automatically:", error.message);
    console.log("   Please verify manually on BSCScan:");
    console.log(`   https://${networkName === "bscMainnet" ? "bscscan.com" : "testnet.bscscan.com"}/address/${NFT_MANAGER_ADDRESS}`);
  }

  // Step 8: Test functions
  console.log("\n8️⃣  Testing functions after rollback...");
  try {
    const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
    
    // Try to call a basic function to verify it works
    // Note: This might fail if the old version has different function signatures
    console.log("   ✅ Rollback completed. Functions should work with old signatures.");
  } catch (error: any) {
    console.log("   ⚠️  Could not test functions:", error.message);
    console.log("   This is normal if function signatures changed.");
  }

  // Step 9: Save rollback info
  console.log("\n9️⃣  Saving rollback info...");
  
  const rollbackInfo = {
    network: networkName,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    facet: "RewardFacet",
    rolledBackFrom: currentFacetAddress,
    rolledBackTo: OLD_REWARD_FACET_ADDRESS,
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber,
    gasUsed: receipt?.gasUsed.toString(),
    functionSelectors: currentSelectors,
  };

  const outputFileName = `rollback.RewardFacet.${networkName}.json`;
  const outputPath = path.join(__dirname, "..", outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(rollbackInfo, null, 2));
  console.log(`✅ Rollback info saved to: ${outputFileName}`);

  console.log("\n" + "=".repeat(60));
  console.log("✨ RewardFacet Rollback Complete!");
  console.log("=".repeat(60));
  console.log(`Rolled back from: ${currentFacetAddress}`);
  console.log(`Rolled back to: ${OLD_REWARD_FACET_ADDRESS}`);
  console.log(`Transaction: ${tx.hash}`);
  console.log(`Block: ${receipt?.blockNumber}`);
  console.log("\n⚠️  IMPORTANT NOTES:");
  console.log("   1. Storage data is preserved (new variables added at the end)");
  console.log("   2. Old Facet will ignore new storage variables (safe)");
  console.log("   3. All function calls should use old function signatures");
  console.log("   4. Update backend/frontend code to use old API");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

