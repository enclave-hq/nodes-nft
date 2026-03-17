import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 直接添加 OwnerFacet 到 NFTManager
 * 
 * 前提条件：
 * - 执行者地址必须是 contractOwner
 * - 不需要 EIP-7702
 */

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";

async function main() {
  console.log("📝 直接添加 OwnerFacet 到 NFTManager...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  console.log("🔐 账户信息:");
  console.log("   部署者地址:", deployer.address);
  console.log("   余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("");

  // 步骤 1: 部署 OwnerFacet
  console.log("📝 步骤 1: 部署 OwnerFacet...");
  const OwnerFacet = await ethers.getContractFactory("OwnerFacet");
  const ownerFacet = await OwnerFacet.deploy();
  await ownerFacet.waitForDeployment();
  const ownerFacetAddress = await ownerFacet.getAddress();
  console.log(`   ✅ OwnerFacet 已部署: ${ownerFacetAddress}`);
  console.log("");

  // 步骤 2: 获取 NFTManager 合约实例
  console.log("📝 步骤 2: 连接 NFTManager 合约...");
  // 使用 getContractAt 获取合约实例（使用 INFTManagerCut 接口）
  const INFTManagerCut = await ethers.getContractAt("INFTManagerCut", NFT_MANAGER_ADDRESS);
  console.log("   ✅ 已连接到 NFTManager");
  console.log("");

  // 步骤 3: 构建 FacetCut
  console.log("📝 步骤 3: 构建 FacetCut...");
  
  // 函数选择器
  const ownerSelector = OwnerFacet.interface.getFunction("owner").selector;
  const contractOwnerSelector = OwnerFacet.interface.getFunction("contractOwner").selector;
  
  console.log(`   owner() 选择器: ${ownerSelector}`);
  console.log(`   contractOwner() 选择器: ${contractOwnerSelector}`);
  console.log("");

  // 构建 FacetCut 结构
  const facetCut = {
    facetAddress: ownerFacetAddress,
    action: 0, // FacetCutAction.Add
    functionSelectors: [ownerSelector, contractOwnerSelector]
  };

  // 步骤 4: 调用 nftManagerCut
  console.log("📝 步骤 4: 调用 nftManagerCut 添加 OwnerFacet...");
  console.log("   注意: 只有 contractOwner 可以调用此函数");
  console.log("");

  try {
    const tx = await INFTManagerCut.nftManagerCut(
      [facetCut],
      ethers.ZeroAddress, // _init
      "0x" // _calldata
    );
    
    console.log("   ✅ 交易已发送");
    console.log(`   交易哈希: ${tx.hash}`);
    console.log("   等待确认...");
    console.log("");

    const receipt = await tx.wait();
    
    if (receipt && receipt.status === 1) {
      console.log("   ✅ 交易成功！");
      console.log("");
      console.log("🔗 BSCScan:");
      console.log(`   https://bscscan.com/tx/${tx.hash}`);
      console.log("");
      console.log("✅ OwnerFacet 已添加到 NFTManager！");
      console.log("   现在可以通过 owner() 或 contractOwner() 函数查询 owner 了");
    } else {
      console.error("   ❌ 交易失败！");
    }
  } catch (error: any) {
    console.error("   ❌ 调用失败:", error.message);
    if (error.message.includes("Must be contract owner")) {
      console.error("");
      console.error("   ⚠️  错误: 部署者地址不是 contractOwner");
      console.error("   请确认:");
      console.error("     1. 部署者地址是否是 contractOwner");
      console.error("     2. 或者需要使用 EIP-7702 方式");
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

