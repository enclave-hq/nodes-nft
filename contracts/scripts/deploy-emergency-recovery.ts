import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 部署紧急恢复合约
 * 
 * 这个合约用于在私钥泄露时快速恢复控制权：
 * 1. 取消委托
 * 2. 转移合约所有权
 * 3. 支持代付 Gas
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔐 Deployer address:", deployer.address);
  console.log("");

  // 部署紧急恢复合约
  console.log("📦 部署 EmergencyRecovery 合约...");
  const EmergencyRecovery = await ethers.getContractFactory("EmergencyRecovery");
  const recovery = await EmergencyRecovery.deploy();
  await recovery.waitForDeployment();
  
  const recoveryAddress = await recovery.getAddress();
  console.log("✅ EmergencyRecovery 已部署");
  console.log("   地址:", recoveryAddress);
  console.log("");

  // 保存部署信息
  console.log("📝 部署信息:");
  console.log("   Network:", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("   Deployer:", deployer.address);
  console.log("   Contract:", recoveryAddress);
  console.log("");

  console.log("🔗 BSCScan 链接:");
  console.log(`   https://bscscan.com/address/${recoveryAddress}`);
  console.log("");

  console.log("⚠️  重要:");
  console.log("   1. 将合约 Owner 设置为多签钱包");
  console.log("   2. 保存合约地址，用于紧急恢复");
  console.log("   3. 测试合约功能后再使用");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























