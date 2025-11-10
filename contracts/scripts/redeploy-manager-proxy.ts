import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Redeploy NFTManager Proxy with existing implementation address
 * 
 * This script:
 * 1. Deploys a new ERC1967Proxy pointing to existing implementation
 * 2. Initializes the proxy with existing contract addresses
 * 3. Updates NodeNFT to point to the new Manager address
 */
async function main() {
  console.log("🚀 Redeploying NFTManager Proxy with Existing Implementation\n");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "BNB\n");

  // Fixed addresses
  const IMPLEMENTATION_ADDRESS = "0x4AA58A38A0cFe3D3c51FF2903a382922c1B284fF";
  const NODENFT_ADDRESS = "0x92301C0acA7586d9F0B1968af2502616009Abf69";

  console.log("Implementation Address:", IMPLEMENTATION_ADDRESS);
  console.log("NodeNFT Address:", NODENFT_ADDRESS);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("");

  // Get other addresses from environment
  const ECLV_ADDRESS = process.env.ECLV_ADDRESS || process.env.$E_ADDRESS;
  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || deployer.address;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;

  if (!ECLV_ADDRESS) {
    throw new Error("❌ Please set ECLV_ADDRESS or $E_ADDRESS in .env file");
  }
  if (!USDT_ADDRESS) {
    throw new Error("❌ Please set USDT_ADDRESS in .env file");
  }

  console.log("Configuration:");
  console.log("─".repeat(70));
  console.log("ECLV Token:", ECLV_ADDRESS);
  console.log("USDT Token:", USDT_ADDRESS);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Treasury:", TREASURY_ADDRESS);
  console.log("");

  // Verify implementation address is a contract
  const code = await ethers.provider.getCode(IMPLEMENTATION_ADDRESS);
  if (code === "0x") {
    throw new Error(`❌ Implementation address ${IMPLEMENTATION_ADDRESS} is not a contract!`);
  }
  console.log("✅ Implementation contract verified");

  // Verify NodeNFT address is a contract
  const nftCode = await ethers.provider.getCode(NODENFT_ADDRESS);
  if (nftCode === "0x") {
    throw new Error(`❌ NodeNFT address ${NODENFT_ADDRESS} is not a contract!`);
  }
  console.log("✅ NodeNFT contract verified\n");

  // Load NFTManager contract factory
  const NFTManager = await ethers.getContractFactory("NFTManager");

  // Deploy ERC1967Proxy manually using OpenZeppelin's proxy
  console.log("📦 Deploying new Proxy...");
  
  // Encode initialize function call
  const initializeData = NFTManager.interface.encodeFunctionData("initialize", [
    NODENFT_ADDRESS,
    ECLV_ADDRESS,
    USDT_ADDRESS,
    ORACLE_ADDRESS,
    TREASURY_ADDRESS,
  ]);

  // Get ERC1967Proxy from OpenZeppelin contracts
  // Use the full path to the contract
  let ERC1967ProxyFactory;
  try {
    // Method 1: Try using the full contract path
    ERC1967ProxyFactory = await ethers.getContractFactory(
      "ERC1967Proxy",
      {
        libraries: {},
      }
    );
  } catch (error1: any) {
    try {
      // Method 2: Try with node_modules path
      const proxyPath = require.resolve("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol");
      ERC1967ProxyFactory = await ethers.getContractFactory(
        proxyPath + ":ERC1967Proxy"
      );
    } catch (error2: any) {
      // Method 3: Load from OpenZeppelin build artifacts
      console.log("   ⚠️  Loading from OpenZeppelin build artifacts...");
      
      const proxyArtifactPath = path.join(
        __dirname,
        "../node_modules/@openzeppelin/contracts/build/contracts/ERC1967Proxy.json"
      );
      
      if (fs.existsSync(proxyArtifactPath)) {
        const proxyArtifact = JSON.parse(fs.readFileSync(proxyArtifactPath, "utf-8"));
        ERC1967ProxyFactory = new ethers.ContractFactory(
          proxyArtifact.abi,
          proxyArtifact.bytecode,
          deployer
        );
        console.log("   ✅ Loaded ERC1967Proxy from build artifacts");
      } else {
        throw new Error(
          `Cannot load ERC1967Proxy. Tried multiple methods.\n` +
          `Error 1: ${error1.message}\n` +
          `Error 2: ${error2.message}\n` +
          `Proxy artifact not found at: ${proxyArtifactPath}\n` +
          `Please ensure @openzeppelin/contracts is installed.`
        );
      }
    }
  }

  // Deploy proxy
  const proxy = await ERC1967ProxyFactory.deploy(IMPLEMENTATION_ADDRESS, initializeData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  console.log("✅ Proxy deployed to:", proxyAddress);
  console.log("   Transaction hash:", (await proxy.deploymentTransaction())?.hash);

  // Verify proxy points to correct implementation
  const actualImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  if (actualImpl.toLowerCase() !== IMPLEMENTATION_ADDRESS.toLowerCase()) {
    throw new Error(`❌ Proxy implementation mismatch! Expected ${IMPLEMENTATION_ADDRESS}, got ${actualImpl}`);
  }
  console.log("✅ Proxy implementation verified:", actualImpl);

  // Attach NFTManager interface to proxy
  const nftManager = await NFTManager.attach(proxyAddress);

  // Verify initialization
  console.log("\n🔍 Verifying initialization...");
  try {
    const nodeNFT = await nftManager.nodeNFT();
    const eclvToken = await nftManager.eclvToken();
    const usdtToken = await nftManager.usdtToken();
    const owner = await nftManager.owner();

    console.log("   NodeNFT:", nodeNFT);
    console.log("   ECLV Token:", eclvToken);
    console.log("   USDT Token:", usdtToken);
    console.log("   Owner:", owner);

    if (nodeNFT.toLowerCase() !== NODENFT_ADDRESS.toLowerCase()) {
      throw new Error(`NodeNFT address mismatch! Expected ${NODENFT_ADDRESS}, got ${nodeNFT}`);
    }
    console.log("✅ Initialization verified\n");
  } catch (error: any) {
    console.error("❌ Initialization verification failed:", error.message);
    throw error;
  }

  // Update NodeNFT to point to new Manager
  console.log("📝 Updating NodeNFT Manager address...");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const nodeNFTContract = await NodeNFT.attach(NODENFT_ADDRESS);
  
  // Check current manager
  let currentManager: string;
  try {
    currentManager = await nodeNFTContract.nftManager();
    console.log("   Current Manager:", currentManager);
    
    // Check if manager is already set
    if (currentManager !== "0x0000000000000000000000000000000000000000") {
      // Use updateNFTManager instead of setNFTManager
      console.log("   Manager already set, using updateNFTManager...");
      const updateManagerTx = await nodeNFTContract.updateNFTManager(proxyAddress);
      const receipt = await updateManagerTx.wait();
      console.log("✅ NodeNFT Manager updated");
      console.log("   Transaction hash:", updateManagerTx.hash);
      console.log("   Block number:", receipt.blockNumber);
      console.log("   Confirmations:", receipt.confirmations);
    } else {
      // Use setNFTManager for first time setup
      console.log("   Manager not set, using setNFTManager...");
      const setManagerTx = await nodeNFTContract.setNFTManager(proxyAddress);
      const receipt = await setManagerTx.wait();
      console.log("✅ NodeNFT Manager set");
      console.log("   Transaction hash:", setManagerTx.hash);
      console.log("   Block number:", receipt.blockNumber);
      console.log("   Confirmations:", receipt.confirmations);
    }
  } catch (error: any) {
    // If setNFTManager fails with "Manager already set", try updateNFTManager
    if (error.message.includes("Manager already set")) {
      console.log("   Manager already set, using updateNFTManager...");
      const updateManagerTx = await nodeNFTContract.updateNFTManager(proxyAddress);
      const receipt = await updateManagerTx.wait();
      console.log("✅ NodeNFT Manager updated");
      console.log("   Transaction hash:", updateManagerTx.hash);
      console.log("   Block number:", receipt.blockNumber);
      console.log("   Confirmations:", receipt.confirmations);
    } else {
      throw error;
    }
  }

  // Verify NodeNFT manager was updated
  console.log("🔍 Verifying NodeNFT Manager update...");
  // Wait a bit for the transaction to be confirmed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const newManager = await nodeNFTContract.nftManager();
  console.log("   New Manager:", newManager);
  console.log("   Expected:", proxyAddress);
  
  if (newManager.toLowerCase() !== proxyAddress.toLowerCase()) {
    console.log("   ⚠️  Manager address mismatch, waiting for more confirmations...");
    // Wait a bit more and check again
    await new Promise(resolve => setTimeout(resolve, 5000));
    const finalManager = await nodeNFTContract.nftManager();
    if (finalManager.toLowerCase() !== proxyAddress.toLowerCase()) {
      throw new Error(`❌ NodeNFT manager update failed! Expected ${proxyAddress}, got ${finalManager}`);
    }
    console.log("   ✅ Manager updated after additional wait");
  } else {
    console.log("✅ NodeNFT Manager verified:", newManager);
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 PROXY REDEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));

  console.log("\n📝 Contract Addresses:");
  console.log("─".repeat(70));
  console.log("NFTManager (Proxy):      ", proxyAddress);
  console.log("NFTManager (Implementation):", IMPLEMENTATION_ADDRESS);
  console.log("NodeNFT:                 ", NODENFT_ADDRESS);
  console.log("ECLV Token:              ", ECLV_ADDRESS);
  console.log("USDT Token:              ", USDT_ADDRESS);

  console.log("\n💾 Add these to contracts/.env:");
  console.log("─".repeat(70));
  console.log(`MANAGER_ADDRESS=${proxyAddress}`);
  console.log(`NFT_MANAGER_ADDRESS=${proxyAddress}`);

  console.log("\n💾 Add these to frontend/.env.local:");
  console.log("─".repeat(70));
  console.log(`NEXT_PUBLIC_NFT_MANAGER_ADDRESS=${proxyAddress}`);
  console.log(`NEXT_PUBLIC_NODE_NFT_ADDRESS=${NODENFT_ADDRESS}`);

  console.log("\n🔍 View on BSCScan:");
  console.log("─".repeat(70));
  console.log("Proxy:         https://testnet.bscscan.com/address/" + proxyAddress);
  console.log("Implementation: https://testnet.bscscan.com/address/" + IMPLEMENTATION_ADDRESS);
  console.log("NodeNFT:       https://testnet.bscscan.com/address/" + NODENFT_ADDRESS);

  console.log("\n💡 Next steps:");
  console.log("─".repeat(70));
  console.log("1. Verify the proxy on BSCScan");
  console.log("2. Update frontend and backend .env files");
  console.log("3. Test basic functionality");
  console.log("4. Update DEPLOYMENT_RESULTS.md if needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

