import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";

async function main() {
  console.log("🔍 通过合约读取 NFTManager Owner...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  // 方法1: 尝试通过 AdminFacet 读取（如果 owner 函数存在）
  // 方法2: 部署 OwnerFacet 并添加到 NFTManager
  // 方法3: 直接调用 LibNFTManager.contractOwner()（但这是 internal）

  // 最简单的方法：部署 OwnerFacet，然后通过 nftManagerCut 添加它
  console.log("📋 方案 1: 部署 OwnerFacet 并添加到 NFTManager");
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);
  console.log("");

  // 部署 OwnerFacet
  console.log("1. 部署 OwnerFacet...");
  const OwnerFacet = await ethers.getContractFactory("OwnerFacet");
  const ownerFacet = await OwnerFacet.deploy();
  await ownerFacet.waitForDeployment();
  const ownerFacetAddress = await ownerFacet.getAddress();
  console.log("   ✅ OwnerFacet 已部署:", ownerFacetAddress);
  console.log("");

  // 检查当前 owner（需要先添加 Facet）
  // 但添加 Facet 需要 owner 权限，所以我们需要另一种方法

  console.log("📋 方案 2: 直接通过合约调用（如果 Facet 已存在）");
  console.log("");

  // 尝试通过 NFTManager 调用 owner 函数
  // 如果 OwnerFacet 已经添加，可以直接调用
  try {
    const nftManager = await ethers.getContractAt("OwnerFacet", NFT_MANAGER_ADDRESS);
    const owner = await nftManager.owner();
    console.log("   ✅ Owner:", owner);
  } catch (e) {
    console.log("   ❌ OwnerFacet 尚未添加到 NFTManager");
    console.log("   需要先通过 nftManagerCut 添加 OwnerFacet");
    console.log("");
    console.log("📋 方案 3: 使用测试合约直接读取存储");
    console.log("");

    // 创建一个测试合约来读取存储
    const TestStorageReader = await ethers.getContractFactory("TestStorageReader");
    const testReader = await TestStorageReader.deploy();
    await testReader.waitForDeployment();
    const testReaderAddress = await testReader.getAddress();
    console.log("   ✅ TestStorageReader 已部署:", testReaderAddress);

    const owner = await testReader.readOwner(NFT_MANAGER_ADDRESS);
    console.log("   ✅ Owner (通过存储读取):", owner);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























