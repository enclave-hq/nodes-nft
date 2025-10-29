import { ethers } from "hardhat";

async function main() {
  console.log("💰 Minting 10 Million TestUSDT (18 decimals) to each test address...\n");

  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const testUSDT = TestUSDT.attach("0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34");

  const testAddresses = [
    "0x900E9a2EC90DfB7f0F90f11A5B475f56B98d272E", // Deployer
    "0x8013f4da90c0811E9c4e399124BBa2ff7a0EB85e", // Alice
    "0x07b072C17D57eDc2fAE9027c18d2d5f9b93fA762", // Bob
    "0x28F43B9B87A4436cDBDc4f6e1C73F6951457186D", // Charlie
    "0x3DA6d9103f98eB2ECBC04089a8a4E60E549F03C9", // Oracle
  ];

  const names = ["Deployer", "Alice", "Bob", "Charlie", "Oracle"];
  const mintAmount = ethers.parseUnits("10000000", 18); // 10 million USDT with 18 decimals

  console.log(`Minting ${ethers.formatUnits(mintAmount, 18)} USDT to each address...\n`);

  for (let i = 0; i < testAddresses.length; i++) {
    try {
      console.log(`Minting to ${names[i]} (${testAddresses[i]})...`);
      const tx = await testUSDT.mint(testAddresses[i], mintAmount);
      await tx.wait();
      console.log(`✅ Successfully minted 10,000,000 USDT to ${names[i]}`);
    } catch (error: any) {
      console.log(`❌ Failed to mint to ${names[i]}: ${error.message}`);
    }
  }

  console.log("\n📊 Final USDT Balances (18 decimals):");
  for (let i = 0; i < testAddresses.length; i++) {
    const balance = await testUSDT.balanceOf(testAddresses[i]);
    console.log(`${names[i]}: ${ethers.formatUnits(balance, 18)} USDT`);
  }

  console.log("\n📝 Contract Information:");
  console.log("TestUSDT Address:", await testUSDT.getAddress());
  console.log("Decimals:", await testUSDT.decimals());
  console.log("Total Supply:", ethers.formatUnits(await testUSDT.totalSupply(), 18), "USDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

