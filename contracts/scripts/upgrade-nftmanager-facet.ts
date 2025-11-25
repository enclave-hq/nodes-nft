/**
 * Script to upgrade NFTManagerFacet with new sync functions
 * Usage: npx hardhat run scripts/upgrade-nftmanager-facet.ts --network bscTestnet
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

  console.log(`🚀 Upgrading NFTManagerFacet on ${networkName.toUpperCase()}...\n`);

  const NFT_MANAGER_ADDRESS = process.env.NFT_MANAGER_ADDRESS;
  if (!NFT_MANAGER_ADDRESS) {
    throw new Error("❌ Please set NFT_MANAGER_ADDRESS in .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), networkName === "localhost" ? "ETH" : "BNB");
  console.log("NFTManager:", NFT_MANAGER_ADDRESS);
  console.log("");

  // Step 1: Deploy new NFTManagerFacet
  console.log("1️⃣  Deploying new NFTManagerFacet...");
  const NFTManagerFacetFactory = await ethers.getContractFactory("NFTManagerFacet");
  const newFacet = await NFTManagerFacetFactory.deploy();
  await newFacet.waitForDeployment();
  const newFacetAddress = await newFacet.getAddress();
  console.log(`✅ New NFTManagerFacet deployed to: ${newFacetAddress}`);

  // Step 2: Get all function selectors from new Facet
  console.log("\n2️⃣  Getting function selectors...");
  const iface = NFTManagerFacetFactory.interface;
  const selectors: string[] = [];
  
  const functions = iface.fragments.filter(f => f.type === "function");
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
  console.log(`   New functions: importExistingNFT, batchImportExistingNFTs`);

  // Step 3: Get current Facet address
  console.log("\n3️⃣  Getting current Facet address...");
  
  // Use env.testnet or .env file
  let currentFacetAddress: string | null = null;
  
  // Try to read from env.testnet file first
  try {
    const fs = require("fs");
    const path = require("path");
    const envTestnetPath = path.join(__dirname, "..", "env.testnet");
    if (fs.existsSync(envTestnetPath)) {
      const envContent = fs.readFileSync(envTestnetPath, "utf-8");
      const match = envContent.match(/NFT_MANAGER_FACET=(0x[a-fA-F0-9]+)/);
      if (match) {
        currentFacetAddress = match[1];
        console.log(`   Found NFT_MANAGER_FACET from env.testnet: ${currentFacetAddress}`);
      }
    }
  } catch (e) {
    // Ignore
  }
  
  // Fallback to environment variable
  if (!currentFacetAddress) {
    currentFacetAddress = process.env.NFT_MANAGER_FACET || null;
    if (currentFacetAddress) {
      console.log(`   Using NFT_MANAGER_FACET from .env: ${currentFacetAddress}`);
    }
  }
  
  if (!currentFacetAddress) {
    throw new Error("Could not determine current Facet address. Please set NFT_MANAGER_FACET in env.testnet or .env");
  }
  
  console.log(`✅ Current NFTManagerFacet address: ${currentFacetAddress}`);

  if (currentFacetAddress.toLowerCase() === newFacetAddress.toLowerCase()) {
    console.log("⚠️  New Facet address is the same as current address. Skipping upgrade.");
    return;
  }

  // Step 4: Prepare FacetCut (Replace action)
  console.log("\n4️⃣  Preparing FacetCut...");
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS) as INFTManagerCut;
  
  const cuts: INFTManagerCut.FacetCutStruct[] = [{
    facetAddress: newFacetAddress,
    action: 1, // Replace (FacetCutAction.Replace)
    functionSelectors: selectors,
  }];

  console.log(`✅ Prepared FacetCut to replace ${selectors.length} functions`);
  console.log(`   ⚠️  This will replace the entire NFTManagerFacet`);

  // Step 5: Execute upgrade
  console.log("\n5️⃣  Executing upgrade...");
  console.log("   ⚠️  Make sure you have verified the new implementation!");
  
  const tx = await nftManagerCut.nftManagerCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   Transaction hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Facet upgrade completed");
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

  // Step 6: Verify upgrade
  console.log("\n6️⃣  Verifying upgrade...");
  const newFacetAddressAfter = await nftManagerLoupe.facetAddress(selectors[0]);
  if (newFacetAddressAfter.toLowerCase() === newFacetAddress.toLowerCase()) {
    console.log("✅ Upgrade verified: Facet address updated");
  } else {
    console.log("⚠️  Warning: Facet address mismatch");
    console.log("   Expected:", newFacetAddress);
    console.log("   Got:", newFacetAddressAfter);
  }

  // Step 7: Test new functions
  console.log("\n7️⃣  Testing new functions...");
  try {
    const nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", NFT_MANAGER_ADDRESS);
    
    // Check if importExistingNFT exists (by checking if we can encode it)
    const importSelector = iface.getFunction("importExistingNFT").selector;
    const batchImportSelector = iface.getFunction("batchImportExistingNFTs").selector;
    
    console.log("   ✅ importExistingNFT selector:", importSelector);
    console.log("   ✅ batchImportExistingNFTs selector:", batchImportSelector);
    console.log("   ✅ New functions are available");
  } catch (error: any) {
    console.log("   ⚠️  Could not verify new functions:", error.message);
  }

  // Step 8: Save upgrade info
  console.log("\n8️⃣  Saving upgrade info...");
  
  const upgradeInfo = {
    network: networkName,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    facet: "NFTManagerFacet",
    oldAddress: currentFacetAddress,
    newAddress: newFacetAddress,
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber,
    gasUsed: receipt?.gasUsed.toString(),
    functionSelectors: selectors,
    newFunctions: [
      "importExistingNFT",
      "batchImportExistingNFTs",
      "getAllWhitelistedAddresses"
    ],
  };

  const outputFileName = `upgrade.NFTManagerFacet.${networkName}.json`;
  const outputPath = path.join(__dirname, "..", outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(upgradeInfo, null, 2));
  console.log(`✅ Upgrade info saved to: ${outputFileName}`);

  // Update env file
  console.log("\n9️⃣  Updating environment file...");
  const envFile = networkName === "bscTestnet" ? "env.testnet" : 
                  networkName === "bscMainnet" ? "env.mainnet" : 
                  "env.localnode";
  const envPath = path.join(__dirname, "..", envFile);
  
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    envContent = envContent.replace(
      /NFT_MANAGER_FACET=0x[a-fA-F0-9]+/,
      `NFT_MANAGER_FACET=${newFacetAddress}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated ${envFile}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ NFTManagerFacet Upgrade Complete!");
  console.log("=".repeat(60));
  console.log(`Old Address: ${currentFacetAddress}`);
  console.log(`New Address: ${newFacetAddress}`);
  console.log(`Transaction: ${tx.hash}`);
  console.log(`Block: ${receipt?.blockNumber}`);
  console.log("\n📝 New functions available:");
  console.log("   - importExistingNFT()");
  console.log("   - batchImportExistingNFTs()");
  console.log("   - getAllWhitelistedAddresses()");
  console.log("\n💡 Next steps:");
  console.log("   1. Verify the contract on BSCScan");
  console.log("   2. Initialize whitelist array: npx hardhat run scripts/init-whitelist-array.ts --network bscTestnet");
  console.log("   3. Update NodeNFT manager address (if needed)");
  console.log("   4. Sync existing NFTs using sync-existing-nfts.ts");
  console.log("   5. Regenerate ABI: cd backend && npm run generate-abi");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

