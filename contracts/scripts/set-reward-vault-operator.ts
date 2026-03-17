import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 设置 RewardVault 的 Operator
 * 
 * 前提条件：
 * - 执行者地址必须是 DEFAULT_ADMIN_ROLE
 */

// 从 docker-compose.yaml 中的默认值
const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;
const NEW_OPERATOR_ADDRESS = "0x4561a736b9663948e06371d19541aa1dc5107e1a";
const OLD_OPERATOR_ADDRESS = process.env.OLD_OPERATOR_ADDRESS || ""; // 可选：要撤销的旧 Operator 地址

async function main() {
  if (!REWARD_VAULT_ADDRESS || REWARD_VAULT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("❌ 错误: 未设置 REWARD_VAULT_ADDRESS 环境变量");
    console.log("");
    console.log("使用方法:");
    console.log("  export REWARD_VAULT_ADDRESS=0x...");
    console.log("  npx hardhat run scripts/set-reward-vault-operator.ts --network bscMainnet");
    console.log("");
    console.log("或者使用默认地址（从 docker-compose.yaml）:");
    console.log(`  npx hardhat run scripts/set-reward-vault-operator.ts --network bscMainnet`);
    process.exit(1);
  }

  console.log("📝 设置 RewardVault 的 Operator...");
  console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log(`   新 Operator 地址: ${NEW_OPERATOR_ADDRESS}`);
  if (OLD_OPERATOR_ADDRESS) {
    console.log(`   旧 Operator 地址: ${OLD_OPERATOR_ADDRESS} (将撤销)`);
  }
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

  // OPERATOR_ROLE = keccak256("OPERATOR_ROLE")
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE = 0x00...

  // 连接到 RewardVault
  console.log("📝 步骤 1: 连接 RewardVault 合约...");
  const RewardVault = await ethers.getContractAt("RewardVault", REWARD_VAULT_ADDRESS);
  console.log("   ✅ 已连接到 RewardVault");
  console.log("");

  // 检查部署者是否有 DEFAULT_ADMIN_ROLE
  console.log("📝 步骤 2: 检查权限...");
  const deployerHasAdminRole = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  if (!deployerHasAdminRole) {
    throw new Error(`部署者地址 ${deployer.address} 没有 DEFAULT_ADMIN_ROLE，无法设置 Operator`);
  }
  console.log("   ✅ 部署者拥有 DEFAULT_ADMIN_ROLE");
  console.log("");

  // 检查新 Operator 是否已经有 OPERATOR_ROLE
  console.log("📝 步骤 3: 检查新 Operator 状态...");
  const newOperatorHasRole = await RewardVault.hasRole(OPERATOR_ROLE, NEW_OPERATOR_ADDRESS);
  if (newOperatorHasRole) {
    console.log("   ✅ 新 Operator 地址已经拥有 OPERATOR_ROLE");
    console.log("");
  } else {
    console.log("   ⚠️  新 Operator 地址还没有 OPERATOR_ROLE，将授予");
    console.log("");
  }

  // 撤销旧 Operator（如果指定）
  if (OLD_OPERATOR_ADDRESS && OLD_OPERATOR_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    console.log("📝 步骤 4: 撤销旧 Operator...");
    const oldOperatorHasRole = await RewardVault.hasRole(OPERATOR_ROLE, OLD_OPERATOR_ADDRESS);
    if (oldOperatorHasRole) {
      try {
        const tx = await RewardVault.revokeRole(OPERATOR_ROLE, OLD_OPERATOR_ADDRESS);
        console.log("   ✅ 交易已发送");
        console.log(`   交易哈希: ${tx.hash}`);
        console.log("   等待确认...");
        console.log("");

        const receipt = await tx.wait();
        if (receipt && receipt.status === 1) {
          console.log("   ✅ 旧 Operator 角色已撤销");
          console.log("");
        } else {
          console.error("   ❌ 撤销旧 Operator 失败！");
          throw new Error("撤销旧 Operator 失败");
        }
      } catch (error: any) {
        console.error("   ❌ 撤销旧 Operator 失败:", error.message);
        throw error;
      }
    } else {
      console.log("   ℹ️  旧 Operator 地址没有 OPERATOR_ROLE，无需撤销");
      console.log("");
    }
  }

  // 授予新 Operator
  if (!newOperatorHasRole) {
    console.log("📝 步骤 5: 授予新 Operator...");
    try {
      const tx = await RewardVault.grantRole(OPERATOR_ROLE, NEW_OPERATOR_ADDRESS);
      
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
        throw new Error("授予 Operator 角色失败");
      }
    } catch (error: any) {
      console.error("   ❌ 授予 Operator 失败:", error.message);
      throw error;
    }
  }

  // 验证新的 Operator
  console.log("📝 步骤 6: 验证新的 Operator...");
  const finalCheck = await RewardVault.hasRole(OPERATOR_ROLE, NEW_OPERATOR_ADDRESS);
  if (finalCheck) {
    console.log(`   ✅ 新 Operator ${NEW_OPERATOR_ADDRESS} 已成功设置！`);
    console.log("");
    console.log("🎉 Operator 设置完成！");
  } else {
    console.log("   ⚠️  验证失败：新 Operator 没有 OPERATOR_ROLE");
    throw new Error("Operator 设置验证失败");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

