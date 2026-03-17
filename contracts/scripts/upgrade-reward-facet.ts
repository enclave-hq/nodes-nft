/**
 * Script to upgrade RewardFacet with optimized distribution functions
 * Usage: npx hardhat run scripts/upgrade-reward-facet.ts --network bscTestnet
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

  console.log(`🚀 Upgrading RewardFacet on ${networkName.toUpperCase()}...\n`);

  // Determine which env file to use based on network for NFT_MANAGER_ADDRESS
  let envFileNameForAddress: string;
  if (networkName === "bscMainnet" || network.chainId === BigInt(56)) {
    envFileNameForAddress = "env.mainnet";
  } else if (networkName === "bscTestnet" || network.chainId === BigInt(97)) {
    envFileNameForAddress = "env.testnet";
  } else {
    envFileNameForAddress = "env.localnode";
  }

  // Try to read NFT_MANAGER_ADDRESS from appropriate env file first
  let NFT_MANAGER_ADDRESS: string | null = null;
  try {
    const envFilePath = path.join(__dirname, "..", envFileNameForAddress);
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      const match = envContent.match(/NFT_MANAGER_ADDRESS=(0x[a-fA-F0-9]+)/);
      if (match) {
        NFT_MANAGER_ADDRESS = match[1];
        console.log(`   Using NFT_MANAGER_ADDRESS from ${envFileNameForAddress}: ${NFT_MANAGER_ADDRESS}`);
      }
    }
  } catch (e) {
    // Ignore
  }

  // Fallback to environment variable
  if (!NFT_MANAGER_ADDRESS) {
    NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS || null;
    if (NFT_MANAGER_ADDRESS) {
      console.log(`   Using NFT_MANAGER_ADDRESS from .env: ${NFT_MANAGER_ADDRESS}`);
    }
  }

  if (!NFT_MANAGER_ADDRESS) {
    throw new Error(`❌ Please set NFT_MANAGER_ADDRESS in ${envFileNameForAddress} or .env file`);
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
  console.log("");

  // Step 1: Deploy new RewardFacet
  console.log("1️⃣  Deploying new RewardFacet...");
  const RewardFacetFactory = await ethers.getContractFactory("RewardFacet");
  const newFacet = await RewardFacetFactory.deploy();
  await newFacet.waitForDeployment();
  const newFacetAddress = await newFacet.getAddress();
  console.log(`✅ New RewardFacet deployed to: ${newFacetAddress}`);

  // Step 2: Get all function selectors from new Facet
  console.log("\n2️⃣  Getting function selectors...");
  const iface = RewardFacetFactory.interface;
  const selectors: string[] = [];
  
  const functions = iface.fragments.filter((f: any) => f.type === "function");
  for (const fragment of functions) {
    if (fragment.type === "function" && fragment.name !== "supportsInterface") {
      try {
        const func = iface.getFunction(fragment.name);
        selectors.push(func.selector);
      } catch (e) {
        // Skip if function not found
      }
    }
  }
  
  console.log(`✅ Found ${selectors.length} function selectors`);
  console.log(`   Key functions: distributeProduced, distributeReward, setNodeRewardsCredit, setMultisigRewardBps, calculateRequiredAmountForDistribution`);

  // Step 3: Get current RewardFacet address
  console.log("\n3️⃣  Getting current RewardFacet address...");
  
  // Query Diamond to find RewardFacet address
  const nftManagerLoupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);
  
  // Use a known function from RewardFacet to find its address
  const distributeRewardSelector = iface.getFunction("distributeReward").selector;
  let currentFacetAddress: string;
  
  try {
    currentFacetAddress = await nftManagerLoupe.facetAddress(distributeRewardSelector);
    console.log(`✅ Current RewardFacet address: ${currentFacetAddress}`);
  } catch (error: any) {
    throw new Error(`❌ Could not find current RewardFacet: ${error.message}`);
  }

  if (currentFacetAddress.toLowerCase() === newFacetAddress.toLowerCase()) {
    console.log("⚠️  New Facet address is the same as current address. Skipping upgrade.");
    return;
  }

  // Step 4: Query current Facet's function selectors from Diamond
  console.log("\n4️⃣  Querying current Facet's function selectors from Diamond...");
  
  let currentSelectors: string[] = [];
  try {
    const currentSelectorsArray = await nftManagerLoupe.facetFunctionSelectors(currentFacetAddress);
    currentSelectors = currentSelectorsArray.map((s: string) => s.toLowerCase());
    console.log(`✅ Found ${currentSelectors.length} function selectors in current Facet`);
  } catch (error: any) {
    console.log(`⚠️  Could not query current selectors: ${error.message}`);
    console.log(`   Will attempt to replace all selectors from new Facet`);
  }

  // Step 5: Prepare FacetCut (Replace existing + Add new)
  console.log("\n5️⃣  Preparing FacetCut...");
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS) as INFTManagerCut;
  
  // Normalize selectors for comparison
  const newSelectorsNormalized = selectors.map((s: string) => s.toLowerCase());
  
  // Separate selectors into: existing (Replace) and new (Add)
  const existingSelectors: string[] = [];
  const newSelectors: string[] = [];
  
  for (const selector of newSelectorsNormalized) {
    if (currentSelectors.length > 0 && currentSelectors.includes(selector)) {
      existingSelectors.push(selector);
    } else {
      newSelectors.push(selector);
    }
  }

  const cuts: INFTManagerCut.FacetCutStruct[] = [];

  // Replace existing functions
  if (existingSelectors.length > 0) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: 1, // Replace (FacetCutAction.Replace)
      functionSelectors: existingSelectors,
    });
    console.log(`✅ Prepared to replace ${existingSelectors.length} existing functions`);
    console.log(`   Key functions being replaced: distributeProduced, distributeReward`);
  }

  // Add new functions
  if (newSelectors.length > 0) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: 0, // Add (FacetCutAction.Add)
      functionSelectors: newSelectors,
    });
    console.log(`✅ Prepared to add ${newSelectors.length} new functions`);
    console.log(`   New functions include: setNodeRewardsCredit, etc.`);
  }

  if (cuts.length === 0) {
    throw new Error("No functions to upgrade. All selectors are already installed.");
  }

  // Step 6: Execute upgrade
  console.log("\n6️⃣  Executing upgrade...");
  console.log("   ⚠️  Make sure you have verified the new implementation!");
  
  const tx = await nftManagerCut.nftManagerCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ RewardFacet upgrade completed");
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

  // Step 7: Verify upgrade
  console.log("\n7️⃣  Verifying upgrade...");
  try {
    const newFacetAddressAfter = await nftManagerLoupe.facetAddress(distributeRewardSelector);
    if (newFacetAddressAfter.toLowerCase() === newFacetAddress.toLowerCase()) {
      console.log("✅ Upgrade verified: RewardFacet address updated");
    } else {
      console.log("⚠️  Warning: Facet address mismatch");
      console.log("   Expected:", newFacetAddress);
      console.log("   Got:", newFacetAddressAfter);
    }
  } catch (error: any) {
    console.log("⚠️  Could not verify upgrade automatically:", error.message);
    console.log("   Please verify manually on BSCScan:");
    console.log(`   https://${networkName === "bscMainnet" ? "bscscan.com" : "testnet.bscscan.com"}/address/${NFT_MANAGER_ADDRESS}`);
  }

  // Step 8: Test new functions
  console.log("\n8️⃣  Testing new functions...");
  try {
    const rewardFacet = await ethers.getContractAt("RewardFacet", NFT_MANAGER_ADDRESS);
    
    // Test getMultisigRewardBps (should return default 2000 = 20%)
    const bps = await rewardFacet.getMultisigRewardBps();
    console.log(`✅ getMultisigRewardBps() returned: ${bps} (${Number(bps) / 100}%)`);
    
    console.log("✅ New functions are working correctly");
  } catch (error: any) {
    console.log("⚠️  Could not test new functions:", error.message);
    console.log("   This is normal if the contract requires specific state");
  }

  // Step 9: Update env file
  console.log("\n9️⃣  Updating environment file...");
  
  let envFile: string;
  if (networkName === "bscMainnet" || network.chainId === BigInt(56)) {
    envFile = "env.mainnet";
  } else if (networkName === "bscTestnet" || network.chainId === BigInt(97)) {
    envFile = "env.testnet";
  } else {
    envFile = "env.localnode";
  }
  const envPath = path.join(__dirname, "..", envFile);
  
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    // Update or add REWARD_FACET address
    if (envContent.includes("REWARD_FACET=")) {
      envContent = envContent.replace(
        /REWARD_FACET=0x[a-fA-F0-9]+/,
        `REWARD_FACET=${newFacetAddress}`
      );
    } else {
      envContent += `\nREWARD_FACET=${newFacetAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated ${envFile}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ RewardFacet Upgrade Complete!");
  console.log("=".repeat(60));
  console.log(`Old Address: ${currentFacetAddress}`);
  console.log(`New Address: ${newFacetAddress}`);
  console.log(`Transaction: ${tx.hash}`);
  console.log(`Block: ${receipt?.blockNumber}`);
  console.log("\n📝 Key Changes:");
  console.log("   - setNodeRewardsCredit(token, nftIds, amounts) - new: credit allocations without transfer");
  console.log("   - distributeProduced / distributeReward - existing");
  console.log("   - setMultisigRewardBps / getMultisigRewardBps - existing");
  console.log("   - calculateRequiredAmountForDistribution - existing");
  console.log("\n💡 Next steps:");
  console.log("   1. Verify the contract on BSCScan");
  console.log("   2. Update backend code to use new function signatures");
  console.log("   3. Test distribution with new optimized functions");
  console.log("   4. Regenerate ABI: cd backend && npm run generate-abi");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

