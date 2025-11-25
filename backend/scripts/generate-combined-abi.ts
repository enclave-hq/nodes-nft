import * as fs from "fs";
import * as path from "path";

/**
 * Generate combined ABI for NFTManager (Diamond Pattern)
 * This script combines all Facet ABIs into a single ABI file for backend use
 */
async function main() {
  const contractsPath = path.join(__dirname, "..", "..", "contracts");
  const artifactsPath = path.join(contractsPath, "artifacts", "contracts");
  
  // Facets to combine
  const facets = [
    "NFTManagerFacet",
    "MarketplaceFacet",
    "RewardFacet",
    "AdminFacet",
    "NFTManagerCutFacet",
    "NFTManagerLoupeFacet",
  ];

  const combinedABI: any[] = [];
  const seenSelectors = new Set<string>();

  console.log("🔍 Collecting ABIs from Facets...\n");

  for (const facetName of facets) {
    const facetPath = path.join(
      artifactsPath,
      "diamond",
      "facets",
      `${facetName}.sol`,
      `${facetName}.json`
    );

    try {
      const facetArtifact = JSON.parse(fs.readFileSync(facetPath, "utf-8"));
      const facetABI = facetArtifact.abi || [];

      console.log(`✅ ${facetName}: ${facetABI.length} items`);

      // Add functions and events, avoiding duplicates
      for (const item of facetABI) {
        if (item.type === "function" || item.type === "event" || item.type === "error") {
          // Create a unique key for this item
          const key = item.type === "function" 
            ? `${item.name}(${item.inputs?.map((i: any) => i.type).join(",") || ""})`
            : item.type === "event"
            ? `${item.name}(${item.inputs?.map((i: any) => i.type).join(",") || ""})`
            : `${item.name}(${item.inputs?.map((i: any) => i.type).join(",") || ""})`;

          if (!seenSelectors.has(key)) {
            seenSelectors.add(key);
            combinedABI.push(item);
          }
        } else if (item.type === "constructor" || item.type === "receive" || item.type === "fallback") {
          // Skip these as they're not needed for Diamond Pattern
          continue;
        } else {
          // Add other items (like structs, etc.)
          combinedABI.push(item);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not load ${facetName}: ${error.message}`);
    }
  }

  // Also add NFTManager contract ABI (for fallback function, etc.)
  const nftManagerPath = path.join(
    artifactsPath,
    "diamond",
    "NFTManager.sol",
    "NFTManager.json"
  );

  try {
    const nftManagerArtifact = JSON.parse(fs.readFileSync(nftManagerPath, "utf-8"));
    const nftManagerABI = nftManagerArtifact.abi || [];

    console.log(`✅ NFTManager: ${nftManagerABI.length} items`);

    // Add fallback function and other necessary items
    for (const item of nftManagerABI) {
      if (item.type === "fallback" || item.type === "receive") {
        const key = `${item.type}`;
        if (!seenSelectors.has(key)) {
          seenSelectors.add(key);
          combinedABI.push(item);
        }
      }
    }
  } catch (error: any) {
    console.warn(`⚠️  Could not load NFTManager: ${error.message}`);
  }

  // Sort ABI items by type and name for better readability
  combinedABI.sort((a, b) => {
    const typeOrder = { function: 0, event: 1, error: 2, fallback: 3, receive: 4 };
    const aType = typeOrder[a.type as keyof typeof typeOrder] ?? 99;
    const bType = typeOrder[b.type as keyof typeof typeOrder] ?? 99;
    
    if (aType !== bType) return aType - bType;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Create output
  const output = {
    abi: combinedABI,
    metadata: {
      generated: new Date().toISOString(),
      facets: facets,
      totalItems: combinedABI.length,
      note: "Combined ABI for NFTManager (Diamond Pattern). All Facet functions are available on the NFTManager address.",
    },
  };

  // Save to backend/abis directory
  const outputPath = path.join(__dirname, "..", "abis", "NFTManager.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Combined ABI generated: ${outputPath}`);
  console.log(`   Total items: ${combinedABI.length}`);
  console.log(`   Functions: ${combinedABI.filter((i) => i.type === "function").length}`);
  console.log(`   Events: ${combinedABI.filter((i) => i.type === "event").length}`);
  console.log(`   Errors: ${combinedABI.filter((i) => i.type === "error").length}`);
  console.log("\n💡 This ABI can be used with the NFTManager address to call any Facet function.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

