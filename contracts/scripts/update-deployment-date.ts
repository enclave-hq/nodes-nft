import * as fs from "fs";
import * as path from "path";

/**
 * Update deployment date in DEPLOYMENT_RESULTS.md
 * This script automatically updates the "Last Updated" date to the current date
 */
async function main() {
  const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
  
  if (!fs.existsSync(resultsFile)) {
    console.error("❌ DEPLOYMENT_RESULTS.md not found!");
    process.exit(1);
  }

  // Get current date in YYYY-MM-DD format
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Read file
  let content = fs.readFileSync(resultsFile, "utf-8");
  
  // Update "Last Updated" date (both at the top and bottom)
  // Replace all occurrences of "**Last Updated:** YYYY-MM-DD"
  const datePattern = /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g;
  content = content.replace(datePattern, `**Last Updated:** ${currentDate}`);
  
  // Write back
  fs.writeFileSync(resultsFile, content, "utf-8");
  
  console.log("✅ Updated DEPLOYMENT_RESULTS.md");
  console.log(`   Date: ${currentDate}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to update date:", error);
    process.exit(1);
  });

