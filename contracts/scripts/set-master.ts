import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 设置 NFTManager 的 master
 * 
 * 前提条件：
 * - 执行者地址必须是 contractOwner
 */

const NFT_MANAGER_ADDRESS = "0xD9eA9F4B8F24872262568fB2C6133117EC02C774";
const NEW_MASTER_ADDRESS = "0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638";

async function main() {
  console.log("📝 设置 NFTManager 的 master...");
  console.log(`   NFTManager 地址: ${NFT_MANAGER_ADDRESS}`);
  console.log(`   新 Master 地址: ${NEW_MASTER_ADDRESS}`);
  console.log("");

  // 获取 signer（使用 hardhat 配置，与 add-owner-facet-direct.ts 一致）
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("没有可用的 signer。请确保在 hardhat.config.ts 中配置了 PRIVATE_KEY 环境变量");
  }
  const deployer = signers[0];
  
  console.log("🔐 账户信息:");
  console.log("   部署者地址:", deployer.address);
  console.log("   余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("");

  // 连接到 NFTManager（使用 AdminFacet 接口）
  console.log("📝 步骤 1: 连接 NFTManager 合约...");
  const AdminFacet = await ethers.getContractAt("AdminFacet", NFT_MANAGER_ADDRESS);
  console.log("   ✅ 已连接到 NFTManager");
  console.log("");

  // 查询当前的 master
  console.log("📝 步骤 2: 查询当前的 master...");
  try {
    const currentMaster = await AdminFacet.master();
    console.log(`   当前 Master: ${currentMaster}`);
    console.log("");
    
    if (currentMaster.toLowerCase() === NEW_MASTER_ADDRESS.toLowerCase()) {
      console.log("   ✅ Master 已经是目标地址，无需修改");
      return;
    }
  } catch (error: any) {
    console.log(`   ⚠️  查询当前 master 失败: ${error.message}`);
    console.log("   继续执行设置操作...");
    console.log("");
  }

  // 设置新的 master
  console.log("📝 步骤 3: 设置新的 master...");
  console.log("   注意: 只有 contractOwner 可以调用此函数");
  console.log("");

  try {
    const tx = await AdminFacet.setMaster(NEW_MASTER_ADDRESS);
    
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
      
      // 验证新的 master
      console.log("📝 步骤 4: 验证新的 master...");
      const newMaster = await AdminFacet.master();
      console.log(`   新的 Master: ${newMaster}`);
      
      if (newMaster.toLowerCase() === NEW_MASTER_ADDRESS.toLowerCase()) {
        console.log("   ✅ Master 设置成功！");
      } else {
        console.log("   ⚠️  Master 地址不匹配");
      }
    } else {
      console.error("   ❌ 交易失败！");
    }
  } catch (error: any) {
    console.error("   ❌ 调用失败:", error.message);
    if (error.message.includes("Only owner")) {
      console.error("");
      console.error("   ⚠️  错误: 部署者地址不是 contractOwner");
      console.error("   请确认:");
      console.error("     1. 部署者地址是否是 contractOwner");
      console.error(`     2. 当前 contractOwner: 0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638`);
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

