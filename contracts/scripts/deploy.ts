import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { INFTManagerCut } from "../typechain-types";

/**
 * @notice Unified deployment script for all Enclave contracts
 * @dev Supports local, testnet, and mainnet deployments
 * 
 * Deploys:
 * - EnclaveToken ($E)
 * - NodeNFT
 * - NFTManager (Diamond Pattern)
 * - TokenVesting
 * 
 * Environment Variables:
 *   USDT_ADDRESS     - USDT token address (required for testnet/mainnet)
 *   ORACLE_ADDRESS   - Oracle address (defaults to deployer)
 *   TREASURY_ADDRESS - Treasury address (defaults to deployer)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network localhost
 *   npx hardhat run scripts/deploy.ts --network bscTestnet
 *   npx hardhat run scripts/deploy.ts --network bscMainnet
 */

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" 
    ? (process.env.HARDHAT_NETWORK || "localhost")
    : network.name;
  
  const isLocal = networkName === "localhost" || networkName === "hardhat";
  const isTestnet = networkName.includes("testnet") || networkName.includes("Testnet");
  const isMainnet = networkName.includes("mainnet") || networkName.includes("Mainnet");

  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Enclave Full Deployment to ${networkName.toUpperCase()}`);
  console.log("=".repeat(60) + "\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), isLocal ? "ETH" : "BNB");
  console.log("");

  // Configuration
  let usdtAddress: string;
  let oracleAddress: string;
  let treasuryAddress: string;

  if (isLocal) {
    // Local deployment - deploy test USDT
    console.log("📦 Local deployment mode\n");
    
    console.log("0️⃣  Deploying Test USDT...");
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    const usdt = await TestUSDT.deploy();
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log("✅ Test USDT:", usdtAddress);

    const mintAmount = ethers.parseUnits("10000000", 18);
    await usdt.mint(deployer.address, mintAmount);
    console.log("✅ Minted 10M USDT to deployer");

    oracleAddress = deployer.address;
    treasuryAddress = deployer.address;
    console.log("✅ Oracle and Treasury set to deployer\n");

  } else {
    // Testnet/Mainnet - use environment variables or defaults
    console.log("📦 Network deployment mode\n");
    
    // USDT Address - use env or default
    const defaultUsdt = isTestnet 
      ? "0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34"  // BSC Testnet TestUSDT
      : "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT
    
    usdtAddress = process.env.USDT_ADDRESS || defaultUsdt;
    oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;
    treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

    console.log("Configuration:");
    console.log("   USDT:", usdtAddress);
    console.log("   Oracle:", oracleAddress);
    console.log("   Treasury:", treasuryAddress);
    console.log("");
  }

  // ========================================
  // Step 1: Deploy EnclaveToken
  // ========================================
  console.log("1️⃣  Deploying EnclaveToken...");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const eclvToken = await EnclaveToken.deploy();
  await eclvToken.waitForDeployment();
  const eclvAddress = await eclvToken.getAddress();
  console.log("✅ EnclaveToken:", eclvAddress);

  // Set oracle on EnclaveToken
  await eclvToken.setOracle(oracleAddress);
  console.log("   Oracle set to:", oracleAddress);

  // ========================================
  // Step 2: Deploy NodeNFT
  // ========================================
  console.log("\n2️⃣  Deploying NodeNFT...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFT = await NodeNFT.deploy("Enclave Node NFT", "ENFT");
  await nodeNFT.waitForDeployment();
  const nodeNFTAddress = await nodeNFT.getAddress();
  console.log("✅ NodeNFT:", nodeNFTAddress);

  // ========================================
  // Step 3: Deploy NFTManager (Diamond Pattern)
  // ========================================
  console.log("\n3️⃣  Deploying NFTManager (Diamond)...");
  
  // Deploy Core Facets
  const NFTManagerCutFacet = await ethers.getContractFactory("NFTManagerCutFacet");
  const nftManagerCutFacet = await NFTManagerCutFacet.deploy();
  await nftManagerCutFacet.waitForDeployment();
  const nftManagerCutFacetAddress = await nftManagerCutFacet.getAddress();
  console.log("   NFTManagerCutFacet:", nftManagerCutFacetAddress);

  const NFTManagerLoupeFacet = await ethers.getContractFactory("NFTManagerLoupeFacet");
  const nftManagerLoupeFacet = await NFTManagerLoupeFacet.deploy();
  await nftManagerLoupeFacet.waitForDeployment();
  const nftManagerLoupeFacetAddress = await nftManagerLoupeFacet.getAddress();
  console.log("   NFTManagerLoupeFacet:", nftManagerLoupeFacetAddress);

  // Deploy NFTManager
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const nftManager = await NFTManager.deploy(deployer.address, nftManagerCutFacetAddress);
  await nftManager.waitForDeployment();
  const nftManagerAddress = await nftManager.getAddress();
  console.log("   NFTManager:", nftManagerAddress);

  // Deploy NFTManagerInit
  const NFTManagerInit = await ethers.getContractFactory("NFTManagerInit");
  const nftManagerInit = await NFTManagerInit.deploy();
  await nftManagerInit.waitForDeployment();
  const nftManagerInitAddress = await nftManagerInit.getAddress();
  console.log("   NFTManagerInit:", nftManagerInitAddress);

  // Deploy all Facets
  const facetFactories = [
    "NFTManagerFacet",
    "MarketplaceFacet",
    "RewardFacet",
    "AdminFacet",
  ];

  const facetAddresses: { [key: string]: string } = {};

  for (const facetName of facetFactories) {
    const FacetFactory = await ethers.getContractFactory(facetName);
    const facet = await FacetFactory.deploy();
    await facet.waitForDeployment();
    const facetAddress = await facet.getAddress();
    facetAddresses[facetName] = facetAddress;
    console.log(`   ${facetName}:`, facetAddress);
  }

  // Prepare NFTManagerCut
  console.log("\n   Preparing Diamond Cut...");
  
  const nftManagerCut = await ethers.getContractAt("INFTManagerCut", nftManagerAddress) as INFTManagerCut;
  
  // Helper to get function selectors
  const getSelectors = async (facetName: string) => {
    const FacetFactory = await ethers.getContractFactory(facetName);
    const iface = FacetFactory.interface;
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
    
    return selectors;
  };

  // Build facet cuts
  const cuts: INFTManagerCut.FacetCutStruct[] = [];
  const allSelectors = new Set<string>();

  // Add NFTManagerLoupeFacet
  const loupeSelectors = await getSelectors("NFTManagerLoupeFacet");
  const uniqueLoupeSelectors = loupeSelectors.filter(s => !allSelectors.has(s));
  uniqueLoupeSelectors.forEach(s => allSelectors.add(s));
  
  if (uniqueLoupeSelectors.length > 0) {
    cuts.push({
      facetAddress: nftManagerLoupeFacetAddress,
      action: 0, // Add
      functionSelectors: uniqueLoupeSelectors,
    });
  }

  // Add all other facets
  for (const [facetName, facetAddress] of Object.entries(facetAddresses)) {
    const selectors = await getSelectors(facetName);
    const uniqueSelectors = selectors.filter(s => !allSelectors.has(s));
    uniqueSelectors.forEach(s => allSelectors.add(s));
    
    if (uniqueSelectors.length > 0) {
      cuts.push({
        facetAddress: facetAddress,
        action: 0, // Add
        functionSelectors: uniqueSelectors,
      });
    }
  }

  // Initialize NFTManager
  console.log("   Initializing NFTManager...");
  const initData = nftManagerInit.interface.encodeFunctionData("init", [
    nodeNFTAddress,
    eclvAddress,
    usdtAddress,
    oracleAddress,
    treasuryAddress,
  ]);

  const cutTx = await nftManagerCut.nftManagerCut(cuts, nftManagerInitAddress, initData);
  console.log("   Transaction hash:", cutTx.hash);
  await cutTx.wait();
  console.log("✅ NFTManager initialized");

  // ========================================
  // Step 4: Deploy TokenVesting
  // ========================================
  console.log("\n4️⃣  Deploying TokenVesting...");
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  // TokenVesting constructor: (configSource, owner)
  const tokenVesting = await TokenVesting.deploy(nftManagerAddress, deployer.address);
  await tokenVesting.waitForDeployment();
  const vestingAddress = await tokenVesting.getAddress();
  console.log("✅ TokenVesting:", vestingAddress);
  console.log("   ConfigSource (NFTManager):", nftManagerAddress);

  // ========================================
  // Step 5: Configure Contracts
  // ========================================
  console.log("\n5️⃣  Configuring Contracts...");

  // Configure NodeNFT to use NFTManager
  await nodeNFT.setNFTManager(nftManagerAddress);
  console.log("   NodeNFT.setNFTManager:", nftManagerAddress);

  // Set NodeNFT base URI
  await nodeNFT.setBaseURI("https://api.enclave.com/nft/metadata/");
  console.log("   NodeNFT.setBaseURI: https://api.enclave.com/nft/metadata/");

  console.log("✅ All contracts configured");

  // ========================================
  // Step 6: Save Deployment Results
  // ========================================
  console.log("\n6️⃣  Saving Deployment Results...");
  
  const deploymentData = {
    network: networkName,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      enclaveToken: eclvAddress,
      nodeNFT: nodeNFTAddress,
      nftManager: nftManagerAddress,
      tokenVesting: vestingAddress,
      usdt: usdtAddress,
      facets: {
        nftManagerCutFacet: nftManagerCutFacetAddress,
        nftManagerLoupeFacet: nftManagerLoupeFacetAddress,
        nftManagerInit: nftManagerInitAddress,
        ...facetAddresses,
      },
    },
    configuration: {
      oracle: oracleAddress,
      treasury: treasuryAddress,
    },
  };

  // Determine output file name
  let outputFileName: string;
  if (isLocal) {
    outputFileName = "deployment.local.json";
  } else if (isTestnet) {
    outputFileName = "deployment.testnet.json";
  } else if (isMainnet) {
    outputFileName = "deployment.mainnet.json";
  } else {
    outputFileName = `deployment.${networkName}.json`;
  }

  const outputPath = path.join(__dirname, "..", outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`✅ Deployment data saved to: ${outputFileName}`);

  // ========================================
  // Step 7: Generate Environment File
  // ========================================
  console.log("\n7️⃣  Generating Environment File...");
  
  let envFileName: string;
  if (isLocal) {
    envFileName = "env.localnode";
  } else if (isTestnet) {
    envFileName = "env.testnet";
  } else if (isMainnet) {
    envFileName = "env.mainnet";
  } else {
    envFileName = `env.${networkName}`;
  }

  const rpcUrl = isLocal 
    ? "http://localhost:8545" 
    : isTestnet 
      ? "https://data-seed-prebsc-1-s1.binance.org:8545" 
      : "https://bsc-dataseed.binance.org";

  const envContent = `# ${networkName.toUpperCase()} Environment Configuration
# Generated on ${new Date().toISOString()}
# Copy this file to .env when deploying to ${networkName}

# Network
NETWORK=${networkName}
CHAIN_ID=${network.chainId}

# Contract Addresses
ECLV_ADDRESS=${eclvAddress}
NODE_NFT_ADDRESS=${nodeNFTAddress}
NFT_ADDRESS=${nodeNFTAddress}
NFT_MANAGER_ADDRESS=${nftManagerAddress}
MANAGER_ADDRESS=${nftManagerAddress}
VESTING_ADDRESS=${vestingAddress}
USDT_ADDRESS=${usdtAddress}

# Roles
ORACLE_ADDRESS=${oracleAddress}
TREASURY_ADDRESS=${treasuryAddress}

# Facets
NFT_MANAGER_CUT_FACET=${nftManagerCutFacetAddress}
NFT_MANAGER_LOUPE_FACET=${nftManagerLoupeFacetAddress}
NFT_MANAGER_INIT=${nftManagerInitAddress}
NFT_MANAGER_FACET=${facetAddresses.NFTManagerFacet}
MARKETPLACE_FACET=${facetAddresses.MarketplaceFacet}
REWARD_FACET=${facetAddresses.RewardFacet}
ADMIN_FACET=${facetAddresses.AdminFacet}

# RPC URL
RPC_URL=${rpcUrl}
`;

  const envPath = path.join(__dirname, "..", envFileName);
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Environment file saved to: ${envFileName}`);

  // ========================================
  // Summary
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log(`Network:        ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log(`   EnclaveToken:  ${eclvAddress}`);
  console.log(`   NodeNFT:       ${nodeNFTAddress}`);
  console.log(`   NFTManager:    ${nftManagerAddress}`);
  console.log(`   TokenVesting:  ${vestingAddress}`);
  console.log(`   USDT:          ${usdtAddress}`);
  console.log("");
  console.log("📁 Output Files:");
  console.log(`   Deployment:    ${outputFileName}`);
  console.log(`   Environment:   ${envFileName}`);
  console.log("");
  console.log("💡 Next Steps:");
  console.log(`   1. Copy environment: cp ${envFileName} .env`);
  console.log("   2. Update DEPLOYMENT_RESULTS.md with new addresses");
  if (!isLocal) {
    console.log("   3. Verify contracts on BSCScan");
    console.log("   4. Set TGE time when ready: eclvToken.setTGETime(timestamp)");
    console.log("   5. Create whitelist and batches for NFT minting");
  }
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
