import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking Contract Decimals...\n");

  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const testUSDT = TestUSDT.attach("0x4ae1f43dD636Eb028F5a321361Ca41e1C3cCfA34");

  const EnclaveToken = await ethers.getContractFactory("EnclaveToken");
  const enclaveToken = EnclaveToken.attach("0xBC281BB3a2d3696999E638CaB3e7D06E1Ae9d809");

  console.log("📊 Contract Decimals:");
  console.log("TestUSDT decimals:", await testUSDT.decimals());
  console.log("EnclaveToken decimals:", await enclaveToken.decimals());

  console.log("\n📊 Contract Information:");
  console.log("TestUSDT Address:", await testUSDT.getAddress());
  console.log("EnclaveToken Address:", await enclaveToken.getAddress());

  console.log("\n📊 Sample Balance Check (Alice):");
  const aliceAddress = "0x8013f4da90c0811E9c4e399124BBa2ff7a0EB85e";
  
  const usdtBalance = await testUSDT.balanceOf(aliceAddress);
  const eBalance = await enclaveToken.balanceOf(aliceAddress);
  
  console.log("Alice USDT balance (raw):", usdtBalance.toString());
  console.log("Alice USDT balance (formatted):", ethers.formatUnits(usdtBalance, 18), "USDT");
  console.log("Alice $E balance (raw):", eBalance.toString());
  console.log("Alice $E balance (formatted):", ethers.formatUnits(eBalance, 18), "$E");

  console.log("\n✅ Decimals verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

