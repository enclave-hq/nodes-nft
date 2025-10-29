import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  console.log("🔧 Completing NFTManager initialization...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "BNB\n");

  const nftManagerAddress = process.env.MANAGER_ADDRESS;
  const nodeNFTAddress = process.env.NFT_ADDRESS;
  const enclaveTokenAddress = process.env.ECLV_ADDRESS;
  const usdtAddress = process.env.USDT_ADDRESS;

  if (!nftManagerAddress || !nodeNFTAddress || !enclaveTokenAddress || !usdtAddress) {
    console.log("❌ Contract addresses not set in .env file");
    return;
  }

  console.log("Contract Addresses:");
  console.log("NFTManager:", nftManagerAddress);
  console.log("NodeNFT:", nodeNFTAddress);
  console.log("EnclaveToken:", enclaveTokenAddress);
  console.log("USDT:", usdtAddress);
  console.log("");

  // Connect to contracts
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");

  const nftManager = NFTManager.attach(nftManagerAddress);
  const nodeNFT = NodeNFT.attach(nodeNFTAddress);
  const enclaveToken = EnclaveToken.attach(enclaveTokenAddress);

  try {
    // Initialize NFTManager
    console.log("🔧 Initializing NFTManager...");
    const initTx = await nftManager.initialize(
      nodeNFTAddress,
      enclaveTokenAddress,
      usdtAddress,
      deployer.address, // Oracle
      deployer.address  // Treasury
    );
    await initTx.wait();
    console.log("✅ NFTManager initialized");

    // Set NFTManager as minter for NodeNFT
    console.log("🔧 Setting NFTManager as minter for NodeNFT...");
    const setMinterTx = await nodeNFT.setMinter(nftManagerAddress);
    await setMinterTx.wait();
    console.log("✅ NFTManager set as minter");

    // Set NFTManager as oracle for EnclaveToken
    console.log("🔧 Setting NFTManager as oracle for EnclaveToken...");
    const setOracleTx = await enclaveToken.setOracle(nftManagerAddress);
    await setOracleTx.wait();
    console.log("✅ NFTManager set as oracle");

    console.log("\n✅ All contracts configured successfully!");

  } catch (error) {
    console.log("❌ Configuration failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

