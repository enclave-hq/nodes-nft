import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 部署 EIP-7702 恢复代理合约
 * 
 * 这个合约用于通过 EIP-7702 在一个交易中执行：
 * 1. 取消委托
 * 2. 转移所有权
 */

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("❌ No signers found. Please configure PRIVATE_KEY in .env file or set it as environment variable");
  }
  
  const deployer = signers[0];
  console.log("🔐 Deployer address:", deployer.address);
  console.log("");

  // 部署代理合约
  console.log("📦 部署 EIP7702RecoveryProxy 合约...");
  const EIP7702RecoveryProxy = await ethers.getContractFactory("EIP7702RecoveryProxy");
  const proxy = await EIP7702RecoveryProxy.deploy();
  await proxy.waitForDeployment();
  
  const proxyAddress = await proxy.getAddress();
  console.log("✅ EIP7702RecoveryProxy 已部署");
  console.log("   地址:", proxyAddress);
  console.log("");

  // 保存部署信息
  console.log("📝 部署信息:");
  console.log("   Network:", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("   Deployer:", deployer.address);
  console.log("   Contract:", proxyAddress);
  console.log("");

  console.log("🔗 BSCScan 链接:");
  console.log(`   https://bscscan.com/address/${proxyAddress}`);
  console.log("");

  console.log("⚠️  重要:");
  console.log("   1. 保存合约地址，用于 EIP-7702 调用");
  console.log("   2. 确认 BSC 是否支持 EIP-7702");
  console.log("   3. 如果不支持，需要使用脚本方案");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

