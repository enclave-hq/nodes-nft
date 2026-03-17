import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 查询 RewardVault 的角色信息
 */

const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;

async function main() {
  console.log("🔍 查询 RewardVault 角色信息...");
  console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log("");

  // OPERATOR_ROLE = keccak256("OPERATOR_ROLE")
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE = 0x00...

  // 连接到 RewardVault（只读，不需要 signer）
  const provider = ethers.provider;
  const RewardVault = await ethers.getContractAt("RewardVault", REWARD_VAULT_ADDRESS);

  // 查询一些可能的 admin 地址
  const possibleAdmins = [
    "0x6f3995e2e40ca58adcbd47A2EdAD192E43D98638",
    "0x4561a736b9663948e06371d19541aa1dc5107e1a",
  ];

  console.log("📋 地址角色检查:");
  for (const addr of possibleAdmins) {
    try {
      const hasAdmin = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, addr);
      const hasOperator = await RewardVault.hasRole(OPERATOR_ROLE, addr);
      console.log(`   ${addr}:`);
      console.log(`      DEFAULT_ADMIN_ROLE: ${hasAdmin ? "✅ 是" : "❌ 否"}`);
      console.log(`      OPERATOR_ROLE: ${hasOperator ? "✅ 是" : "❌ 否"}`);
    } catch (error: any) {
      console.log(`   ${addr}: 查询失败 - ${error.message}`);
    }
  }
  console.log("");

  // 尝试通过事件查找 admin（需要查询初始化事件或 RoleGranted 事件）
  console.log("💡 查找 DEFAULT_ADMIN_ROLE 的方法:");
  console.log("   1. 查看 RewardVault 的初始化交易");
  console.log("   2. 查看 RoleGranted 事件（DEFAULT_ADMIN_ROLE）");
  console.log("   3. 或者查看部署 RewardVault 的脚本/文档");
  console.log("");

  // 查询当前 Operator（通过事件可能能找到，但这里先简单查询）
  console.log("💡 提示:");
  console.log("   如果部署者地址不是 DEFAULT_ADMIN_ROLE，需要:");
  console.log("   1. 找到拥有 DEFAULT_ADMIN_ROLE 的地址");
  console.log("   2. 使用该地址的私钥运行脚本");
  console.log("   或者");
  console.log("   3. 让拥有 DEFAULT_ADMIN_ROLE 的地址授予部署者 DEFAULT_ADMIN_ROLE");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

