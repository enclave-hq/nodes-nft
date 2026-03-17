import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
const TARGET_ADDRESS = "0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6"; // Owner address

async function main() {
  console.log("📋 添加 OwnerFacet 到 NFTManager...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log(`   Owner 地址: ${TARGET_ADDRESS}`);
  console.log("");

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers available");
  }
  const deployer = signers[0];
  console.log("部署者地址:", await deployer.getAddress());
  console.log("");

  // 1. 部署 OwnerFacet
  console.log("1. 部署 OwnerFacet...");
  const OwnerFacet = await ethers.getContractFactory("OwnerFacet");
  const ownerFacet = await OwnerFacet.deploy();
  await ownerFacet.waitForDeployment();
  const ownerFacetAddress = await ownerFacet.getAddress();
  console.log("   ✅ OwnerFacet 已部署:", ownerFacetAddress);
  console.log("");

  // 2. 准备 nftManagerCut 调用
  console.log("2. 准备 nftManagerCut 调用...");
  const NFTManagerCutFacet = await ethers.getContractAt(
    "NFTManagerCutFacet",
    NFT_MANAGER_ADDRESS
  );

  // 构建 FacetCut
  const functionSelectors = [
    OwnerFacet.interface.getFunction("owner").selector,
    OwnerFacet.interface.getFunction("contractOwner").selector,
  ];

  const facetCut = [
    {
      facetAddress: ownerFacetAddress,
      action: 0, // Add
      functionSelectors: functionSelectors,
    },
  ];

  console.log("   Function selectors:", functionSelectors.map(s => s));
  console.log("");

  // 3. 调用 nftManagerCut（需要 owner 权限）
  console.log("3. 调用 nftManagerCut...");
  console.log("   ⚠️  需要 owner 权限");
  console.log("   如果 deployer 不是 owner，这个调用会失败");
  console.log("");

  try {
    const tx = await NFTManagerCutFacet.nftManagerCut(facetCut, ethers.ZeroAddress, "0x");
    console.log("   ✅ 交易已发送:", tx.hash);
    await tx.wait();
    console.log("   ✅ OwnerFacet 已添加");
    console.log("");

    // 4. 测试读取 owner
    console.log("4. 测试读取 owner...");
    const nftManager = await ethers.getContractAt("OwnerFacet", NFT_MANAGER_ADDRESS);
    const owner = await nftManager.owner();
    console.log("   ✅ Owner:", owner);
  } catch (error: any) {
    console.error("   ❌ 失败:", error.message);
    if (error.message.includes("Must be contract owner")) {
      console.log("");
      console.log("   💡 说明 deployer 不是 owner");
      console.log("   需要使用 owner 地址来调用");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























