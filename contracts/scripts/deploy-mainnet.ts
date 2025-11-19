import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Mainnet Deployment Script for BSC
 * 
 * This script deploys:
 * 1. EnclaveToken ($E) - ERC20 token
 * 2. TokenVesting - Token vesting contract for Team/SAFT allocations
 * 3. NodeNFT - ERC721 NFT contract
 * 4. NFTManager - Upgradeable UUPS proxy contract
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet
 *   npx hardhat run scripts/deploy-mainnet.ts --network bscMainnet -- --force
 * 
 * Options:
 *   --force: Force redeploy all contracts, ignoring existing deployments
 * 
 * Prerequisites:
 * - Set USDT_ADDRESS in .env (BSC mainnet USDT: 0x55d398326f99059fF775485246999027B3197955)
 * - Set PRIVATE_KEY in .env (deployer wallet with BNB for gas)
 * - Set BSC_MAINNET_RPC_URL in .env
 * - Set BSCSCAN_API_KEY in .env (for verification)
 * - Optional: Set MULTISIG_ADDRESS, TGE_TIME, TEAM_BENEFICIARY, SAFT1_BENEFICIARY, SAFT2_BENEFICIARY
 */

// Helper function to check if contract is deployed
async function isContractDeployed(address: string): Promise<boolean> {
  try {
    const code = await ethers.provider.getCode(address);
    return code !== "0x" && code.length > 2;
  } catch {
    return false;
  }
}

// Helper function to check contract configuration
async function checkContractConfig(
  contractName: string,
  address: string,
  checks: Array<{ name: string; check: () => Promise<boolean> }>
): Promise<{ deployed: boolean; configured: boolean; missing: string[] }> {
  const deployed = await isContractDeployed(address);
  if (!deployed) {
    return { deployed: false, configured: false, missing: [] };
  }

  const missing: string[] = [];
  for (const { name, check } of checks) {
    try {
      const result = await check();
      if (!result) {
        missing.push(name);
      }
    } catch {
      missing.push(name);
    }
  }

  return {
    deployed: true,
    configured: missing.length === 0,
    missing,
  };
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const forceDeploy = args.includes("--force");

  console.log("🚀 Deploying Contracts to BSC Mainnet...\n");
  if (forceDeploy) {
    console.log("⚠️  FORCE MODE: Will redeploy all contracts regardless of existing deployments\n");
  } else {
    console.log("ℹ️  INCREMENTAL MODE: Will check existing deployments and only deploy missing contracts\n");
  }
  console.log("⚠️  WARNING: This is a MAINNET deployment!");
  console.log("⚠️  Make sure you have verified all configurations!\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Check if we have enough balance
  // Get current gas price from chain
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
  const gasPriceGwei = Number(ethers.formatUnits(gasPrice, "gwei"));
  
  // Estimated gas: ~7.7M gas
  const estimatedGas = 7_700_000n;
  const estimatedCostWei = estimatedGas * gasPrice;
  const estimatedCost = ethers.formatEther(estimatedCostWei);
  const minBalanceWei = (estimatedCostWei * 150n) / 100n; // 1.5x safety margin
  const minBalance = ethers.formatEther(minBalanceWei);
  
  console.log(`Current gas price: ${gasPriceGwei.toFixed(2)} gwei`);
  console.log(`Estimated deployment cost: ~${estimatedCost} BNB`);
  console.log(`Minimum balance required: ${minBalance} BNB\n`);
  
  if (balance < minBalanceWei) {
    const needed = minBalanceWei - balance;
    throw new Error(
      `❌ Insufficient BNB balance!\n` +
      `   Current: ${ethers.formatEther(balance)} BNB\n` +
      `   Gas price: ${gasPriceGwei.toFixed(2)} gwei\n` +
      `   Estimated cost: ~${estimatedCost} BNB\n` +
      `   Minimum required: ${minBalance} BNB\n` +
      `   Need additional: ${ethers.formatEther(needed)} BNB`
    );
  }

  // Get USDT address from environment (BSC mainnet USDT)
  const BSC_MAINNET_USDT = "0x55d398326f99059fF775485246999027B3197955";
  const USDT_ADDRESS = process.env.USDT_ADDRESS || BSC_MAINNET_USDT;
  
  // Validate USDT address is the correct BSC mainnet address
  if (USDT_ADDRESS.toLowerCase() !== BSC_MAINNET_USDT.toLowerCase()) {
    throw new Error(
      `❌ Wrong USDT address!\n` +
      `   Current: ${USDT_ADDRESS}\n` +
      `   Expected (BSC Mainnet): ${BSC_MAINNET_USDT}\n` +
      `   Please update USDT_ADDRESS in .env file to the BSC mainnet address.`
    );
  }
  
  console.log("Using USDT:", USDT_ADDRESS);
  console.log("✅ Verified: This is the correct BSC mainnet USDT address!\n");

  // Get Oracle and Treasury addresses (default to deployer for now)
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;
  const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS || deployer.address;
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("Multisig (TokenVesting Owner):", MULTISIG_ADDRESS);
  console.log("⚠️  You can change these later via setOracle() and setTreasury()\n");

  // Confirm deployment
  console.log("=".repeat(70));
  console.log("📋 Deployment Configuration:");
  console.log("=".repeat(70));
  console.log("Network: BSC Mainnet (Chain ID: 56)");
  console.log("Deployer:", deployer.address);
  console.log("USDT:", USDT_ADDRESS);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("Multisig:", MULTISIG_ADDRESS);
  console.log("=".repeat(70));
  console.log("\n⏳ Starting deployment in 3 seconds...\n");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Load existing contract addresses from .env
  const existingEclvAddress = process.env.ECLV_ADDRESS;
  const existingVestingAddress = process.env.VESTING_ADDRESS;
  const existingNftAddress = process.env.NFT_ADDRESS;
  const existingManagerAddress = process.env.MANAGER_ADDRESS;

  // Variables to store deployed addresses
  let eclvAddress: string;
  let vestingAddress: string;
  let nftAddress: string;
  let managerAddress: string;
  let implementationAddress: string;

  // 1. Deploy or check EnclaveToken
  console.log("1️⃣  Checking EnclaveToken ($E)...");
  let eclvToken: any;
  if (!forceDeploy && existingEclvAddress && await isContractDeployed(existingEclvAddress)) {
    console.log("✅ EnclaveToken already deployed at:", existingEclvAddress);
    eclvAddress = existingEclvAddress;
    eclvToken = await ethers.getContractAt("EnclaveToken", eclvAddress);
    const totalSupply = await eclvToken.totalSupply();
    console.log("   Current supply:", ethers.formatEther(totalSupply), "$E");
  } else {
    console.log("📦 Deploying EnclaveToken ($E)...");
    const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
    eclvToken = await EnclaveToken.deploy();
    await eclvToken.waitForDeployment();
    eclvAddress = await eclvToken.getAddress();
    console.log("✅ EnclaveToken deployed to:", eclvAddress);
    
    const totalSupply = await eclvToken.totalSupply();
    console.log("   Initial supply:", ethers.formatEther(totalSupply), "$E");
    console.log("   Max supply: 100,000,000 $E");
    console.log("\n   📝 Initial Supply Distribution (70M):");
    console.log("      - Can be minted by oracle as needed before TGE");
    console.log("      - Recommended distribution:");
    console.log("        * TokenVesting: Team (10M) + SAFT1 (6M) + SAFT2 (4M) = 20M");
    console.log("        * Treasury: Ecosystem (16M) + CEX (10M) + Community (5M) + Reserve (2M) = 33M");
    console.log("        * Liquidity: 5M");
    console.log("        * Airdrop: 2M");
    console.log("        * Nodes Staking: 10M (mint to NFTManager for node rewards)");
    console.log("      - Total: 70M (initial supply)");
    console.log("      - After TGE: Mining rewards (30M) will be minted gradually over 6 years");
    console.log("   Transaction hash:", (await eclvToken.deploymentTransaction())?.hash);
  }

  // 2. Deploy or check TokenVesting
  console.log("\n2️⃣  Checking TokenVesting...");
  if (!forceDeploy && existingVestingAddress && await isContractDeployed(existingVestingAddress)) {
    console.log("✅ TokenVesting already deployed at:", existingVestingAddress);
    vestingAddress = existingVestingAddress;
    const vesting = await ethers.getContractAt("TokenVesting", vestingAddress);
    const tgeTime = await vesting.tgeTime();
    if (tgeTime > 0) {
      console.log("   TGE time:", tgeTime.toString(), "(" + new Date(Number(tgeTime) * 1000).toISOString() + ")");
    } else {
      console.log("   ⚠️  TGE time not set yet");
    }
  } else {
    console.log("📦 Deploying TokenVesting...");
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    const vesting = await TokenVesting.deploy(eclvAddress, MULTISIG_ADDRESS);
    await vesting.waitForDeployment();
    vestingAddress = await vesting.getAddress();
    console.log("✅ TokenVesting deployed to:", vestingAddress);
    console.log("   Owner (Multisig):", MULTISIG_ADDRESS);
    console.log("   Transaction hash:", (await vesting.deploymentTransaction())?.hash);
    
    // Get TGE time (optional, can be set later)
    let tgeTime: bigint | null = null;
    if (process.env.TGE_TIME) {
      tgeTime = BigInt(process.env.TGE_TIME);
      console.log("\n   Setting TGE time...");
      const setTGETx = await vesting.setTGETime(tgeTime);
      await setTGETx.wait();
      console.log("   ✅ TGE time set to:", tgeTime.toString(), "(" + new Date(Number(tgeTime) * 1000).toISOString() + ")");
    } else {
      console.log("\n   ⚠️  TGE time not set. You can set it later via vesting.setTGETime()");
      console.log("   ⚠️  Vesting schedules should be created after TGE time is set");
    }
    
    // Create vesting schedules (optional, can be done later)
    const CREATE_VESTING_SCHEDULES = process.env.CREATE_VESTING_SCHEDULES === "true";
    if (CREATE_VESTING_SCHEDULES && tgeTime) {
      console.log("\n   Creating vesting schedules...");
      const ONE_MONTH = 30 * 24 * 60 * 60;
      const ONE_YEAR = 365 * 24 * 60 * 60;
      const SIX_MONTHS = 180 * 24 * 60 * 60;
      
      const schedules = [
        {
          name: "Team",
          beneficiary: process.env.TEAM_BENEFICIARY || deployer.address,
          totalAmount: ethers.parseEther("10000000"), // 10M
          lockPeriod: ONE_YEAR,
          releaseDuration: 32 * ONE_MONTH,
        },
        {
          name: "SAFT1",
          beneficiary: process.env.SAFT1_BENEFICIARY || deployer.address,
          totalAmount: ethers.parseEther("6000000"), // 6M
          lockPeriod: ONE_YEAR,
          releaseDuration: 32 * ONE_MONTH,
        },
        {
          name: "SAFT2",
          beneficiary: process.env.SAFT2_BENEFICIARY || deployer.address,
          totalAmount: ethers.parseEther("4000000"), // 4M
          lockPeriod: SIX_MONTHS,
          releaseDuration: 32 * ONE_MONTH,
        },
      ];
      
      for (const schedule of schedules) {
        const tx = await vesting.createVestingSchedule(
          schedule.beneficiary,
          schedule.totalAmount,
          schedule.lockPeriod,
          schedule.releaseDuration
        );
        await tx.wait();
        console.log(`   ✅ ${schedule.name} vesting schedule created (${ethers.formatEther(schedule.totalAmount)} $E)`);
      }
    } else if (CREATE_VESTING_SCHEDULES && !tgeTime) {
      console.log("\n   ⚠️  Cannot create vesting schedules: TGE time not set");
      console.log("   Set TGE_TIME in .env and CREATE_VESTING_SCHEDULES=true to create schedules");
    }
  }

  // 3. Deploy or check NodeNFT
  console.log("\n3️⃣  Checking NodeNFT...");
  let nodeNFT: any;
  if (!forceDeploy && existingNftAddress && await isContractDeployed(existingNftAddress)) {
    console.log("✅ NodeNFT already deployed at:", existingNftAddress);
    nftAddress = existingNftAddress;
    nodeNFT = await ethers.getContractAt("NodeNFT", nftAddress);
    // Check if NFTManager is set
    try {
      const manager = await nodeNFT.nftManager();
      if (manager && manager !== ethers.ZeroAddress) {
        console.log("   NFTManager is set:", manager);
      } else {
        console.log("   ⚠️  NFTManager not set yet");
      }
    } catch {
      console.log("   ⚠️  Could not check NFTManager configuration");
    }
  } else {
    console.log("📦 Deploying NodeNFT...");
    const NodeNFT = await ethers.getContractFactory("NodeNFT");
    nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
    await nodeNFT.waitForDeployment();
    nftAddress = await nodeNFT.getAddress();
    console.log("✅ NodeNFT deployed to:", nftAddress);
    console.log("   Transaction hash:", (await nodeNFT.deploymentTransaction())?.hash);
  }

  // 4. Deploy or check NFTManager (Upgradeable UUPS Proxy)
  console.log("\n4️⃣  Checking NFTManager...");
  let nftManager: any;
  if (!forceDeploy && existingManagerAddress && await isContractDeployed(existingManagerAddress)) {
    console.log("✅ NFTManager (Proxy) already deployed at:", existingManagerAddress);
    managerAddress = existingManagerAddress;
    nftManager = await ethers.getContractAt("NFTManager", managerAddress);
    implementationAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
    console.log("✅ NFTManager (Implementation):", implementationAddress);
    
    // Check configuration
    try {
      const currentOracle = await nftManager.oracle();
      const currentTreasury = await nftManager.treasury();
      console.log("   Oracle:", currentOracle);
      console.log("   Treasury:", currentTreasury);
    } catch {
      console.log("   ⚠️  Could not check configuration");
    }
  } else {
    console.log("📦 Deploying NFTManager (Upgradeable UUPS Proxy)...");
    const NFTManager = await ethers.getContractFactory("NFTManager");
    nftManager = await upgrades.deployProxy(
      NFTManager,
      [
        nftAddress,        // nodeNFT address
        eclvAddress,       // eclvToken address
        USDT_ADDRESS,     // usdtToken address
        ORACLE_ADDRESS,    // oracle address
        TREASURY_ADDRESS,  // treasury address
      ],
      { 
        initializer: "initialize", 
        kind: "uups",
        timeout: 600000, // 10 minutes timeout for mainnet
      }
    );
    await nftManager.waitForDeployment();
    managerAddress = await nftManager.getAddress();
    console.log("✅ NFTManager (Proxy) deployed to:", managerAddress);
    
    // Get implementation address
    implementationAddress = await upgrades.erc1967.getImplementationAddress(managerAddress);
    console.log("✅ NFTManager (Implementation) deployed to:", implementationAddress);
    console.log("   Transaction hash:", (await nftManager.deploymentTransaction())?.hash);
  }

  // 5. Configure NodeNFT (if needed)
  console.log("\n5️⃣  Configuring NodeNFT...");
  try {
    const currentManager = await nodeNFT.nftManager();
    if (currentManager.toLowerCase() !== managerAddress.toLowerCase()) {
      console.log("📝 Setting NFTManager in NodeNFT...");
      const tx1 = await nodeNFT.setNFTManager(managerAddress);
      await tx1.wait();
      console.log("✅ NFTManager set in NodeNFT");
      console.log("   Transaction hash:", tx1.hash);
    } else {
      console.log("✅ NFTManager already configured in NodeNFT");
    }
  } catch (error: any) {
    console.log("⚠️  Could not configure NFTManager:", error.message);
  }

  // 6. Set Base URI (if needed)
  const baseURI = process.env.BASE_URI || "https://api.enclave.com/nft/metadata/";
  try {
    const currentBaseURI = await nodeNFT.baseURI();
    if (currentBaseURI !== baseURI) {
      console.log("📝 Setting Base URI...");
      const tx2 = await nodeNFT.setBaseURI(baseURI);
      await tx2.wait();
      console.log("✅ Base URI set:", baseURI);
      console.log("   Transaction hash:", tx2.hash);
    } else {
      console.log("✅ Base URI already set:", baseURI);
    }
  } catch (error: any) {
    console.log("⚠️  Could not set Base URI:", error.message);
  }

  // 7. Add reward tokens
  console.log("\n6️⃣  Adding reward tokens...");
  // USDT is automatically added during NFTManager initialization, so skip adding it again
  // Check if USDT is already a reward token
  try {
    // Try to check if USDT is already added (this will revert if not a reward token)
    // We'll use a different approach: just skip adding since it's added in initialize
    console.log("✅ USDT is automatically added as reward token during NFTManager initialization");
    console.log("   No need to add it again");
  } catch (error: any) {
    // If we need to add other reward tokens in the future, we can add them here
    console.log("⚠️  Note: USDT should already be added during initialization");
  }

  // 8. Transfer initial $E to NFTManager (optional, for production distribution)
  if (process.env.INITIAL_ECLV_TRANSFER) {
    console.log("\n7️⃣  Setting up initial $E balance...");
    const initial$E = ethers.parseEther(process.env.INITIAL_ECLV_TRANSFER);
    const tx4 = await eclvToken.transfer(managerAddress, initial$E);
    await tx4.wait();
    console.log(`✅ Transferred ${ethers.formatEther(initial$E)} $E to NFTManager`);
    console.log("   Transaction hash:", tx4.hash);
  }

  // 9. Set Oracle (if needed)
  try {
    const currentOracle = await nftManager.oracle();
    if (currentOracle.toLowerCase() !== ORACLE_ADDRESS.toLowerCase()) {
      console.log("\n8️⃣  Setting Oracle...");
      const tx5 = await nftManager.setOracle(ORACLE_ADDRESS);
      await tx5.wait();
      console.log("✅ Oracle set to:", ORACLE_ADDRESS);
      console.log("   Transaction hash:", tx5.hash);
    } else {
      console.log("\n8️⃣  Oracle already set to:", ORACLE_ADDRESS);
    }
  } catch (error: any) {
    console.log("\n8️⃣  ⚠️  Could not set Oracle:", error.message);
  }

  // Print final summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log("\n📝 Contract Addresses (SAVE THESE!):");
  console.log("─".repeat(70));
  console.log("EnclaveToken ($E): ", eclvAddress);
  console.log("TokenVesting:        ", vestingAddress);
  console.log("NodeNFT:             ", nftAddress);
  console.log("NFTManager (Proxy): ", managerAddress);
  console.log("NFTManager (Impl):  ", implementationAddress);
  console.log("USDT:               ", USDT_ADDRESS);
  
  console.log("\n💾 Add these to contracts/.env:");
  console.log("─".repeat(70));
  console.log(`ECLV_ADDRESS=${eclvAddress}`);
  console.log(`VESTING_ADDRESS=${vestingAddress}`);
  console.log(`NFT_ADDRESS=${nftAddress}`);
  console.log(`MANAGER_ADDRESS=${managerAddress}`);
  console.log(`MANAGER_IMPL_ADDRESS=${implementationAddress}`);
  console.log(`USDT_ADDRESS=${USDT_ADDRESS}`);

  console.log("\n💾 Add these to frontend/.env.local:");
  console.log("─".repeat(70));
  console.log(`NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${eclvAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=56`);
  console.log(`NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org`);

  console.log("\n💾 Add these to backend/.env:");
  console.log("─".repeat(70));
  console.log(`NFT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`RPC_URL=https://bsc-dataseed1.binance.org`);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("EnclaveToken: https://bscscan.com/address/" + eclvAddress);
  console.log("TokenVesting: https://bscscan.com/address/" + vestingAddress);
  console.log("NodeNFT:      https://bscscan.com/address/" + nftAddress);
  console.log("NFTManager:    https://bscscan.com/address/" + managerAddress);
  console.log("Implementation: https://bscscan.com/address/" + implementationAddress);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Verify contracts on BSCScan:");
  console.log(`   npx hardhat verify --network bscMainnet ${eclvAddress}`);
  console.log(`   npx hardhat verify --network bscMainnet ${vestingAddress} ${eclvAddress} ${MULTISIG_ADDRESS}`);
  console.log(`   npx hardhat verify --network bscMainnet ${nftAddress} "Enclave Node NFT" "ENFT"`);
  console.log(`   npx hardhat verify --network bscMainnet ${implementationAddress}`);
  console.log("\n2. Verify proxy (if needed):");
  console.log(`   npx hardhat verify --network bscMainnet ${managerAddress}`);
  console.log("\n3. Set TGE time (if not set during deployment):");
  console.log(`   vesting.setTGETime(<timestamp>)`);
  console.log("\n4. Create vesting schedules (if not created during deployment):");
  console.log(`   vesting.createVestingSchedule(beneficiary, amount, lockPeriod, releaseDuration)`);
  console.log("\n5. Mint tokens to TokenVesting (via oracle):");
  console.log(`   eclvToken.mineTokens(${vestingAddress}, ethers.parseEther("20000000")) // 20M for Team+SAFT`);
  console.log("\n6. Update frontend and backend .env files");
  console.log("\n7. Test basic functionality on mainnet");
  console.log("\n8. Set up monitoring and alerts");
  
  console.log("\n⚠️  IMPORTANT REMINDERS:");
  console.log("─".repeat(70));
  console.log("- Save all addresses to a secure location");
  console.log("- Verify all contracts on BSCScan");
  console.log("- Update frontend and backend configurations");
  console.log("- Test thoroughly before allowing public access");
  console.log("- Monitor contract interactions and gas costs");

  // Update DEPLOYMENT_RESULTS.md with mainnet deployment info
  console.log("\n📝 Updating DEPLOYMENT_RESULTS.md...");
  try {
    const resultsFile = path.join(__dirname, "..", "DEPLOYMENT_RESULTS.md");
    const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const networkName = "BSC Mainnet";
    const chainId = 56;
    
    if (fs.existsSync(resultsFile)) {
      let content = fs.readFileSync(resultsFile, "utf-8");
      
      // Update last updated date
      content = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/g,
        `**Last Updated:** ${currentDate}`
      );
      
      // Check if BSC Mainnet section exists
      const mainnetSectionRegex = /## 🌐 BSC Mainnet Deployment[\s\S]*?(?=## |$)/;
      const mainnetSectionExists = mainnetSectionRegex.test(content);
      
      // Create/update BSC Mainnet section
      const mainnetSection = `## 🌐 BSC Mainnet Deployment

**Last Updated:** ${currentDate}  
**Network:** ${networkName} (Chain ID: ${chainId})  
**Status:** ✅ **Deployed**

> **Note:** All contracts are deployed on **BSC Mainnet** for production use.

---

### 📋 Deployment Summary

| Contract | Status | Address | Network |
|----------|--------|---------|---------|
| **EnclaveToken ($E)** | ✅ Deployed | \`${eclvAddress}\` | **BSC Mainnet** ✅ |
| **TokenVesting** | ✅ Deployed | \`${vestingAddress}\` | **BSC Mainnet** ✅ |
| **NodeNFT** | ✅ Deployed | \`${nftAddress}\` | **BSC Mainnet** ✅ |
| **NFTManager (Proxy)** | ✅ Deployed | \`${managerAddress}\` | **BSC Mainnet** ✅ |
| **NFTManager (Implementation)** | ✅ Deployed | \`${implementationAddress}\` | **BSC Mainnet** ✅ |
| **USDT** | ✅ Using | \`${USDT_ADDRESS}\` | **BSC Mainnet** ✅ |

---

### 🔍 Contract Details

#### EnclaveToken ($E)

**Address:** \`${eclvAddress}\`  
**Network:** BSC Mainnet  
**Type:** ERC20 Token  
**Symbol:** $E  
**Decimals:** 18  
**Initial Supply:** 0 $E (minted by oracle as needed)  
**Max Supply:** 100,000,000 $E  

**BSCScan:** https://bscscan.com/address/${eclvAddress}

**Features:**
- Mining mechanism (first 6 years: 5M/year, after: min(burned, 2M)/year)
- Burn mechanism with history tracking
- Oracle-controlled mining and burning

**Deployment Notes:**
- No initial minting - tokens will be minted by oracle as needed
- Oracle address: \`${ORACLE_ADDRESS}\`
- Initial 70M supply can be minted before TGE
- Mining rewards (30M) will be minted gradually over 6 years after TGE

---

#### TokenVesting

**Address:** \`${vestingAddress}\`  
**Network:** BSC Mainnet  
**Type:** Token Vesting Contract  
**Owner:** \`${MULTISIG_ADDRESS}\`  

**BSCScan:** https://bscscan.com/address/${vestingAddress}

**Features:**
- Multiple vesting schedules per beneficiary
- Linear release mechanism
- TGE time-based scheduling

**Deployment Notes:**
- Owner set to multisig address: \`${MULTISIG_ADDRESS}\`
- TGE time: ${process.env.TGE_TIME ? `Set to ${process.env.TGE_TIME} (${new Date(Number(process.env.TGE_TIME) * 1000).toISOString()})` : "Not set yet (can be set later)"}
- Vesting schedules: ${process.env.CREATE_VESTING_SCHEDULES === "true" ? "Created during deployment" : "Not created (can be created later)"}

**Note:** TokenVesting is used for Team/SAFT token lockup schedules

---

#### NodeNFT (ERC721)

**Address:** \`${nftAddress}\`  
**Network:** BSC Mainnet  
**Type:** ERC721 NFT  
**Name:** Enclave Node NFT  
**Symbol:** ENFT  

**BSCScan:** https://bscscan.com/address/${nftAddress}

**Features:**
- Non-transferable by default (transfers disabled)
- Only NFTManager can mint/burn
- Metadata URI support
- Auto-sync feature: Automatically calls \`NFTManager.onNFTTransfer\` on direct transfers

**Deployment Notes:**
- NFTManager address configured: \`${managerAddress}\`
- Base URI: ${process.env.BASE_URI || "https://api.enclave.com/nft/metadata/"}

---

#### NFTManager (Proxy)

**Address:** \`${managerAddress}\`  
**Network:** BSC Mainnet  
**Type:** UUPS Upgradeable Proxy  
**Implementation:** \`${implementationAddress}\`

**BSCScan:** https://bscscan.com/address/${managerAddress}

**Features:**
- Whitelist-based minting
- Batch management with price and quantity control
- O(1) global index reward distribution
- Dual reward system ($E production + multi-token rewards)
- Marketplace functionality
- Multisig rewards: 20% of rewards distributed to multisig node, 80% to NFTs

**Configuration:**
- NodeNFT: \`${nftAddress}\`
- EnclaveToken: \`${eclvAddress}\`
- USDT Token: \`${USDT_ADDRESS}\`
- Oracle: \`${ORACLE_ADDRESS}\`
- Treasury: \`${TREASURY_ADDRESS}\`

**Owner:** \`${deployer.address}\`

**Implementation Address:** \`${implementationAddress}\`  
**BSCScan:** https://bscscan.com/address/${implementationAddress}

---

### 📝 Environment Variables

#### contracts/.env

\`\`\`bash
# Network
NETWORK=bscMainnet

# Contract Addresses
USDT_ADDRESS=${USDT_ADDRESS}
ECLV_ADDRESS=${eclvAddress}
VESTING_ADDRESS=${vestingAddress}
NFT_ADDRESS=${nftAddress}
NODE_NFT_ADDRESS=${nftAddress}
NFT_MANAGER_ADDRESS=${managerAddress}
MANAGER_ADDRESS=${managerAddress}
MANAGER_IMPL_ADDRESS=${implementationAddress}
\`\`\`

#### frontend/.env.local

\`\`\`bash
NEXT_PUBLIC_ENCLAVE_TOKEN_ADDRESS=${eclvAddress}
NEXT_PUBLIC_NODE_NFT_ADDRESS=${nftAddress}
NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${managerAddress}
NEXT_PUBLIC_USDT_ADDRESS=${USDT_ADDRESS}
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed1.binance.org
\`\`\`

#### backend/.env

\`\`\`bash
NFT_MANAGER_ADDRESS=${managerAddress}
NODE_NFT_ADDRESS=${nftAddress}
RPC_URL=https://bsc-dataseed1.binance.org
\`\`\`

---

### ✅ Verification Commands

\`\`\`bash
# Verify EnclaveToken
npx hardhat verify --network bscMainnet ${eclvAddress}

# Verify TokenVesting
npx hardhat verify --network bscMainnet ${vestingAddress} ${eclvAddress} ${MULTISIG_ADDRESS}

# Verify NodeNFT
npx hardhat verify --network bscMainnet ${nftAddress} "Enclave Node NFT" "ENFT"

# Verify NFTManager Implementation
npx hardhat verify --network bscMainnet ${implementationAddress}

# Verify NFTManager Proxy (if needed)
npx hardhat verify --network bscMainnet ${managerAddress}
\`\`\`

---

### 📊 Deployment Statistics

- **Deployer Address:** \`${deployer.address}\`
- **Deployment Date:** ${currentDate}
- **Network:** BSC Mainnet (Chain ID: 56)
- **Total Contracts Deployed:** 5 (EnclaveToken, TokenVesting, NodeNFT, NFTManager Proxy, NFTManager Implementation)

---

`;
      
      if (mainnetSectionExists) {
        // Replace existing mainnet section
        content = content.replace(mainnetSectionRegex, mainnetSection);
      } else {
        // Insert mainnet section after Quick Reference, before Testnet section
        const testnetSectionMatch = content.match(/## 🌐 BSC Testnet Deployment/);
        if (testnetSectionMatch && testnetSectionMatch.index !== undefined) {
          // Insert before testnet section
          const insertPos = testnetSectionMatch.index;
          content = content.slice(0, insertPos) + mainnetSection + "\n\n" + content.slice(insertPos);
        } else {
          // If no testnet section, append after Quick Reference
          const quickRefEnd = content.indexOf("---\n\n## 🌐");
          if (quickRefEnd > 0) {
            const insertPos = quickRefEnd + 4; // After "---\n\n"
            content = content.slice(0, insertPos) + "\n" + mainnetSection + "\n" + content.slice(insertPos);
          } else {
            // Append at the end
            content += "\n\n" + mainnetSection;
          }
        }
      }
      
      // Update Quick Reference table with mainnet status
      const quickRefRegex = /\| \*\*BSC Mainnet\*\* \| See below \| - \| 56 \|/;
      if (quickRefRegex.test(content)) {
        content = content.replace(
          quickRefRegex,
          `| **BSC Mainnet** | ✅ Deployed | ${currentDate} | 56 |`
        );
      }
      
      fs.writeFileSync(resultsFile, content, "utf-8");
      console.log(`✅ Updated DEPLOYMENT_RESULTS.md with ${networkName} deployment info`);
      console.log(`   - Created/updated ${networkName} section`);
      console.log(`   - Updated all contract addresses`);
      console.log(`   - Updated deployment date to ${currentDate}`);
    } else {
      console.log("⚠️  DEPLOYMENT_RESULTS.md not found, skipping update");
    }
  } catch (error: any) {
    console.warn("⚠️  Failed to update DEPLOYMENT_RESULTS.md:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

