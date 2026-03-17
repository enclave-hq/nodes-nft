import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 设置 RewardVault 的 DEFAULT_ADMIN_ROLE
 * 
 * 前提条件：
 * - 执行者地址必须是当前的 DEFAULT_ADMIN_ROLE
 */

const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;
const NEW_ADMIN_ADDRESS = "0x4561a736b9663948e06371d19541aa1dc5107e1a";
const OLD_ADMIN_ADDRESS = process.env.OLD_ADMIN_ADDRESS || "0xa80eb088b2844914000bec0d2894a9edf43f0cb6"; // 当前 admin

async function main() {
  console.log("📝 设置 RewardVault 的 DEFAULT_ADMIN_ROLE...");
  console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log(`   新 Admin 地址: ${NEW_ADMIN_ADDRESS}`);
  console.log(`   当前 Admin 地址: ${OLD_ADMIN_ADDRESS}`);
  console.log("");

  // 获取 signer
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("没有可用的 signer。请确保在 hardhat.config.ts 中配置了 PRIVATE_KEY 环境变量");
  }
  const deployer = signers[0];

  console.log("🔐 账户信息:");
  console.log("   部署者地址:", deployer.address);
  console.log("   余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("");

  // 角色定义
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  // 连接到 RewardVault
  console.log("📝 步骤 1: 连接 RewardVault 合约...");
  const RewardVault = await ethers.getContractAt("RewardVault", REWARD_VAULT_ADDRESS);
  console.log("   ✅ 已连接到 RewardVault");
  console.log("");

  // 检查部署者是否有 DEFAULT_ADMIN_ROLE
  console.log("📝 步骤 2: 检查权限...");
  const deployerHasAdminRole = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  if (!deployerHasAdminRole) {
    throw new Error(`部署者地址 ${deployer.address} 没有 DEFAULT_ADMIN_ROLE，无法设置 Admin`);
  }
  console.log("   ✅ 部署者拥有 DEFAULT_ADMIN_ROLE");
  console.log("");

  // 检查新 Admin 是否已经有 DEFAULT_ADMIN_ROLE
  console.log("📝 步骤 3: 检查新 Admin 状态...");
  const newAdminHasRole = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
  if (newAdminHasRole) {
    console.log("   ✅ 新 Admin 地址已经拥有 DEFAULT_ADMIN_ROLE");
    console.log("");
  } else {
    console.log("   ⚠️  新 Admin 地址还没有 DEFAULT_ADMIN_ROLE，将授予");
    console.log("");
  }

  // 授予新 Admin DEFAULT_ADMIN_ROLE
  if (!newAdminHasRole) {
    console.log("📝 步骤 4: 授予新 Admin DEFAULT_ADMIN_ROLE...");
    try {
      const tx = await RewardVault.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
      
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
      } else {
        console.error("   ❌ 交易失败！");
        throw new Error("授予 DEFAULT_ADMIN_ROLE 失败");
      }
    } catch (error: any) {
      console.error("   ❌ 授予 DEFAULT_ADMIN_ROLE 失败:", error.message);
      throw error;
    }
  }

  // 同时授予新 Admin OPERATOR_ROLE（通常 admin 也应该有 operator 权限）
  console.log("📝 步骤 5: 授予新 Admin OPERATOR_ROLE...");
  const newAdminHasOperator = await RewardVault.hasRole(OPERATOR_ROLE, NEW_ADMIN_ADDRESS);
  if (!newAdminHasOperator) {
    try {
      const tx = await RewardVault.grantRole(OPERATOR_ROLE, NEW_ADMIN_ADDRESS);
      
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
      } else {
        console.error("   ❌ 交易失败！");
      }
    } catch (error: any) {
      console.error("   ⚠️  授予 OPERATOR_ROLE 失败:", error.message);
      // 不抛出错误，因为这不是必须的
    }
  } else {
    console.log("   ✅ 新 Admin 地址已经拥有 OPERATOR_ROLE");
    console.log("");
  }

  // 验证新的 Admin
  console.log("📝 步骤 6: 验证新的 Admin...");
  const finalCheck = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN_ADDRESS);
  if (finalCheck) {
    console.log(`   ✅ 新 Admin ${NEW_ADMIN_ADDRESS} 已成功设置！`);
    console.log("");
    console.log("🎉 Admin 设置完成！");
    console.log("");
    console.log("💡 提示:");
    console.log("   如果需要撤销旧 Admin 的角色，可以运行:");
    console.log("   OLD_ADMIN_ADDRESS=0xa80eb088b2844914000bec0d2894a9edf43f0cb6 npx hardhat run scripts/revoke-reward-vault-admin.ts --network bscMainnet");
  } else {
    console.log("   ⚠️  验证失败：新 Admin 没有 DEFAULT_ADMIN_ROLE");
    throw new Error("Admin 设置验证失败");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



















