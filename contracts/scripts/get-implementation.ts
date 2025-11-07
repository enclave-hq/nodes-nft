import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Get NFTManager Implementation Address
 * 
 * Usage:
 *   npx hardhat run scripts/get-implementation.ts --network bscTestnet
 */
async function main() {
  console.log("🔍 Getting NFTManager Implementation Address...\n");

  const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS;
  if (!MANAGER_ADDRESS) {
    throw new Error("❌ Please set MANAGER_ADDRESS in .env file");
  }

  console.log("Proxy Address:", MANAGER_ADDRESS);

  try {
    const implAddress = await upgrades.erc1967.getImplementationAddress(MANAGER_ADDRESS);
    console.log("\n✅ Implementation Address:", implAddress);
    
    console.log("\n📝 Add this to DEPLOYMENT_RESULTS.md:");
    console.log(`MANAGER_IMPL_ADDRESS=${implAddress}`);
    
    console.log("\n🔍 View on BSCScan:");
    const network = await ethers.provider.getNetwork();
    if (network.chainId === 97n) {
      console.log(`https://testnet.bscscan.com/address/${implAddress}`);
    } else if (network.chainId === 56n) {
      console.log(`https://bscscan.com/address/${implAddress}`);
    }
  } catch (error: any) {
    console.error("❌ Failed to get implementation address:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

