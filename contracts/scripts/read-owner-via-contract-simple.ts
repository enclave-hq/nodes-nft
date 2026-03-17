import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";

async function main() {
  console.log("🔍 通过合约读取 NFTManager Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 获取 signer（用于部署合约）
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available");
  }
  const deployer = signers[0];
  console.log("部署者地址:", await deployer.getAddress());
  console.log("");

  // 部署 TestStorageReader 合约
  console.log("1. 部署 TestStorageReader 合约...");
  const TestStorageReader = await ethers.getContractFactory("TestStorageReader");
  const testReader = await TestStorageReader.deploy();
  await testReader.waitForDeployment();
  const testReaderAddress = await testReader.getAddress();
  console.log("   ✅ TestStorageReader 已部署:", testReaderAddress);
  console.log("");

  // 使用合约读取 owner
  console.log("2. 通过合约读取 Owner...");
  try {
    const owner = await testReader.readOwner(NFT_MANAGER_ADDRESS);
    console.log("   ✅ Owner (通过合约读取):", owner);
    console.log("");

    // 也读取 facetAddresses 数组长度（验证存储槽是否正确）
    const arrayLength = await testReader.readFacetAddressesLength(NFT_MANAGER_ADDRESS);
    console.log("   Facet addresses 数组长度:", arrayLength.toString());
    console.log("");

    if (owner === ethers.ZeroAddress) {
      console.log("   ⚠️  Owner 是零地址，可能存储槽计算错误");
    } else {
      console.log("   ✅ Owner 读取成功！");
    }
  } catch (error: any) {
    console.error("   ❌ 读取失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

