import { ethers } from "hardhat";
import "dotenv/config";

async function main() {
  console.log("🧪 Testing BSC Testnet Deployment...\n");

  // Get contract addresses from environment
  const enclaveTokenAddress = process.env.ECLV_ADDRESS;
  const nodeNFTAddress = process.env.NFT_ADDRESS;
  const nftManagerAddress = process.env.MANAGER_ADDRESS;
  const usdtAddress = process.env.USDT_ADDRESS;

  if (!enclaveTokenAddress || !nodeNFTAddress || !nftManagerAddress || !usdtAddress) {
    console.log("❌ Contract addresses not set in .env file");
    console.log("Please deploy contracts first");
    return;
  }

  console.log("Contract Addresses:");
  console.log("EnclaveToken:", enclaveTokenAddress);
  console.log("NodeNFT:", nodeNFTAddress);
  console.log("NFTManager:", nftManagerAddress);
  console.log("USDT:", usdtAddress);
  console.log("");

  // Get signers
  const [deployer, alice, bob] = await ethers.getSigners();
  console.log("Test Accounts:");
  console.log("Deployer:", deployer.address);
  console.log("Alice:", alice.address);
  console.log("Bob:", bob.address);
  console.log("");

  // Connect to contracts
  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const NodeNFT = await ethers.getContractFactory("NodeNFT");
  const NFTManager = await ethers.getContractFactory("NFTManager");
  const TestUSDT = await ethers.getContractFactory("TestUSDT");

  const enclaveToken = EnclaveToken.attach(enclaveTokenAddress);
  const nodeNFT = NodeNFT.attach(nodeNFTAddress);
  const nftManager = NFTManager.attach(nftManagerAddress);
  const testUSDT = TestUSDT.attach(usdtAddress);

  // Test 1: Check contract connections
  console.log("🔍 Test 1: Contract Connections");
  try {
    const tokenName = await enclaveToken.name();
    const nftName = await nodeNFT.name();
    const managerOwner = await nftManager.owner();
    const usdtSymbol = await testUSDT.symbol();
    
    console.log("✅ EnclaveToken name:", tokenName);
    console.log("✅ NodeNFT name:", nftName);
    console.log("✅ NFTManager owner:", managerOwner);
    console.log("✅ TestUSDT symbol:", usdtSymbol);
  } catch (error) {
    console.log("❌ Contract connection failed:", error);
    return;
  }

  // Test 2: Check USDT balances
  console.log("\n💰 Test 2: USDT Balances");
  const aliceUSDTBalance = await testUSDT.balanceOf(alice.address);
  const bobUSDTBalance = await testUSDT.balanceOf(bob.address);
  
  console.log("Alice USDT balance:", ethers.formatUnits(aliceUSDTBalance, 6), "USDT");
  console.log("Bob USDT balance:", ethers.formatUnits(bobUSDTBalance, 6), "USDT");

  if (aliceUSDTBalance === 0n || bobUSDTBalance === 0n) {
    console.log("⚠️  Warning: Some accounts have zero USDT balance");
    console.log("Please ensure TestUSDT has been deployed and minted to test accounts");
  }

  // Test 3: Test NFT minting (if USDT balance is sufficient)
  console.log("\n🎨 Test 3: NFT Minting");
  const mintPrice = ethers.parseUnits("10000", 6); // 10,000 USDT
  
  if (aliceUSDTBalance >= mintPrice) {
    try {
      // Approve USDT spending
      console.log("Approving USDT spending...");
      const approveTx = await testUSDT.connect(alice).approve(nftManagerAddress, mintPrice);
      await approveTx.wait();
      console.log("✅ USDT approval successful");

      // Mint Standard NFT
      console.log("Minting Standard NFT...");
      const mintTx = await nftManager.connect(alice).mintNFT(0, alice.address); // Standard NFT
      const mintReceipt = await mintTx.wait();
      console.log("✅ NFT minted successfully");
      console.log("Transaction hash:", mintReceipt?.hash);

      // Check NFT ownership
      const nftBalance = await nodeNFT.balanceOf(alice.address);
      console.log("Alice NFT balance:", nftBalance.toString());

      // Check share ownership
      const shareCount = await nftManager.getUserShareCount(1, alice.address); // NFT ID 1
      console.log("Alice share count in NFT #1:", shareCount.toString());

    } catch (error) {
      console.log("❌ NFT minting failed:", error);
    }
  } else {
    console.log("⚠️  Skipping NFT minting - insufficient USDT balance");
  }

  // Test 4: Check contract states
  console.log("\n📊 Test 4: Contract States");
  try {
    const totalSupply = await enclaveToken.totalSupply();
    const nftTotalSupply = await nodeNFT.totalSupply();
    const managerBalance = await testUSDT.balanceOf(nftManagerAddress);
    
    console.log("EnclaveToken total supply:", ethers.formatUnits(totalSupply, 18), "$E");
    console.log("NodeNFT total supply:", nftTotalSupply.toString());
    console.log("NFTManager USDT balance:", ethers.formatUnits(managerBalance, 6), "USDT");
  } catch (error) {
    console.log("❌ Contract state check failed:", error);
  }

  console.log("\n✅ BSC Testnet testing completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


