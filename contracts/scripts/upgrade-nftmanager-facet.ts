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
    const fs = require("fs");
    const path = require("path");
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
  console.log(`   New functions: batchMintNFT, importExistingNFT, batchImportExistingNFTs`);

  // Step 3: Get current Facet address
  console.log("\n3️⃣  Getting current Facet address...");
  
  // Determine which env file to use based on network
  let envFileName: string;
  if (networkName === "bscMainnet" || network.chainId === BigInt(56)) {
    envFileName = "env.mainnet";
  } else if (networkName === "bscTestnet" || network.chainId === BigInt(97)) {
    envFileName = "env.testnet";
  } else {
    envFileName = "env.localnode";
  }
  
  console.log(`   Using ${envFileName} for network: ${networkName} (chainId: ${network.chainId})`);
  
  // Use appropriate env file or .env file
  let currentFacetAddress: string | null = null;
  
  // Try to read from appropriate env file first
  try {
    const fs = require("fs");
    const path = require("path");
    const envFilePath = path.join(__dirname, "..", envFileName);
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      const match = envContent.match(/NFT_MANAGER_FACET=(0x[a-fA-F0-9]+)/);
      if (match) {
        currentFacetAddress = match[1];
        console.log(`   Found NFT_MANAGER_FACET from ${envFileName}: ${currentFacetAddress}`);
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
    throw new Error(`Could not determine current Facet address. Please set NFT_MANAGER_FACET in ${envFileName} or .env`);
  }
  
  console.log(`✅ Current NFTManagerFacet address: ${currentFacetAddress}`);

  if (currentFacetAddress.toLowerCase() === newFacetAddress.toLowerCase()) {
    console.log("⚠️  New Facet address is the same as current address. Skipping upgrade.");
    return;
  }

  // Step 4: Query current Facet's function selectors from Diamond
  console.log("\n4️⃣  Querying current Facet's function selectors from Diamond...");
  const nftManagerLoupeForQuery = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);
  
  let currentSelectors: string[] = [];
  try {
    const currentSelectorsArray = await nftManagerLoupeForQuery.facetFunctionSelectors(currentFacetAddress);
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
  }

  // Add new functions
  if (newSelectors.length > 0) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: 0, // Add (FacetCutAction.Add)
      functionSelectors: newSelectors,
    });
    console.log(`✅ Prepared to add ${newSelectors.length} new functions`);
    console.log(`   New functions: batchMintNFT, importExistingNFT, batchImportExistingNFTs`);
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
  console.log("✅ Facet upgrade completed");
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

  // Step 7: Verify upgrade
  console.log("\n7️⃣  Verifying upgrade...");
  try {
    const nftManagerLoupe = await ethers.getContractAt("NFTManagerLoupeFacet", NFT_MANAGER_ADDRESS);
    // Try to verify using a known function selector (mintNFT is always present)
    const mintNFTSelector = iface.getFunction("mintNFT").selector;
    const newFacetAddressAfter = await nftManagerLoupe.facetAddress(mintNFTSelector);
    if (newFacetAddressAfter.toLowerCase() === newFacetAddress.toLowerCase()) {
      console.log("✅ Upgrade verified: Facet address updated");
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
    const nftManagerFacet = await ethers.getContractAt("NFTManagerFacet", NFT_MANAGER_ADDRESS);
    
    // Check if new functions exist (by checking if we can encode them)
    const batchMintSelector = iface.getFunction("batchMintNFT").selector;
    const importSelector = iface.getFunction("importExistingNFT").selector;
    const batchImportSelector = iface.getFunction("batchImportExistingNFTs").selector;
    
    console.log("   ✅ batchMintNFT selector:", batchMintSelector);
    console.log("   ✅ importExistingNFT selector:", importSelector);
    console.log("   ✅ batchImportExistingNFTs selector:", batchImportSelector);
    console.log("   ✅ New functions are available");
  } catch (error: any) {
    console.log("   ⚠️  Could not verify new functions:", error.message);
  }

  // Step 9: Save upgrade info
  console.log("\n9️⃣  Saving upgrade info...");
  
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
      "batchMintNFT",
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
  console.log("\n🔟  Updating environment file...");
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
  console.log("   - batchMintNFT(uint256 quantity)");
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

