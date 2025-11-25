import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

/**
 * Verify backend connection to NFTManager (Diamond Pattern)
 * This script tests if the backend can successfully interact with the Diamond contract
 */
async function main() {
  dotenv.config();

  const rpcUrl = process.env.RPC_URL;
  const nftManagerAddress = process.env.NFT_MANAGER_ADDRESS;

  if (!rpcUrl || !nftManagerAddress) {
    console.error("❌ Missing RPC_URL or NFT_MANAGER_ADDRESS in .env");
    process.exit(1);
  }

  console.log("🔍 Verifying Diamond Pattern Connection...\n");
  console.log("RPC URL:", rpcUrl);
  console.log("NFTManager Address:", nftManagerAddress);
  console.log("");

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Load ABI
  const abiPath = path.join(__dirname, "..", "abis", "NFTManager.json");
  let abi: any[];
  
  try {
    const abiData = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    abi = abiData.abi || abiData;
    console.log(`✅ Loaded ABI from: ${abiPath}`);
    console.log(`   Total items: ${abi.length}\n`);
  } catch (error: any) {
    console.error(`❌ Failed to load ABI: ${error.message}`);
    console.error("   Please run: npx ts-node scripts/generate-combined-abi.ts");
    process.exit(1);
  }

  // Create contract instance
  const nftManager = new ethers.Contract(nftManagerAddress, abi, provider);

  // Test 1: Check if contract exists
  console.log("1️⃣  Checking contract existence...");
  try {
    const code = await provider.getCode(nftManagerAddress);
    if (code === "0x") {
      console.error("❌ Contract does not exist at this address");
      process.exit(1);
    }
    console.log("✅ Contract exists");
  } catch (error: any) {
    console.error(`❌ Error checking contract: ${error.message}`);
    process.exit(1);
  }

  // Test 2: Check Facets (using NFTManagerLoupeFacet)
  console.log("\n2️⃣  Checking installed Facets...");
  try {
    const loupeABI = [
      "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)"
    ];
    const loupeContract = new ethers.Contract(nftManagerAddress, loupeABI, provider);
    const facets = await loupeContract.facets();
    console.log(`✅ Found ${facets.length} Facets:`);
    facets.forEach((facet: any, index: number) => {
      console.log(`   ${index + 1}. ${facet.facetAddress} (${facet.functionSelectors.length} functions)`);
    });
  } catch (error: any) {
    console.warn(`⚠️  Could not check Facets: ${error.message}`);
  }

  // Test 3: Test basic read functions
  console.log("\n3️⃣  Testing basic read functions...");
  
  const testFunctions = [
    { name: "totalMinted", args: [] },
    { name: "MAX_SUPPLY", args: [] },
    { name: "ECLV_PER_NFT", args: [] },
    { name: "nodeNFT", args: [] },
    { name: "eclvToken", args: [] },
    { name: "usdtToken", args: [] },
  ];

  for (const func of testFunctions) {
    try {
      const result = await nftManager[func.name](...func.args);
      console.log(`✅ ${func.name}(): ${result.toString()}`);
    } catch (error: any) {
      console.warn(`⚠️  ${func.name}(): ${error.message}`);
    }
  }

  // Test 4: Test Facet-specific functions
  console.log("\n4️⃣  Testing Facet-specific functions...");
  
  const facetTests = [
    { name: "getCurrentBatchId", facet: "NFTManagerFacet" },
    { name: "getWhitelistCount", facet: "NFTManagerFacet" },
    { name: "getActiveOrderCount", facet: "MarketplaceFacet" },
    { name: "getRewardTokenCount", facet: "RewardFacet" },
  ];

  for (const test of facetTests) {
    try {
      const result = await nftManager[test.name]();
      console.log(`✅ ${test.name}() [${test.facet}]: ${result.toString()}`);
    } catch (error: any) {
      console.warn(`⚠️  ${test.name}() [${test.facet}]: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification Complete!");
  console.log("=".repeat(60));
  console.log("\n💡 If all tests passed, your backend is ready to use Diamond Pattern.");
  console.log("💡 If some tests failed, check:");
  console.log("   1. NFT_MANAGER_ADDRESS is correct");
  console.log("   2. ABI file is up to date");
  console.log("   3. Facets are properly installed");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

