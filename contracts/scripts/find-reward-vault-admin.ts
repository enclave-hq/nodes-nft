import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 查找 RewardVault 的 DEFAULT_ADMIN_ROLE
 */

const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;

async function main() {
  console.log("🔍 查找 RewardVault 的 DEFAULT_ADMIN_ROLE...");
  console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log("");

  const provider = ethers.provider;
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  // 查询 RoleGranted 事件（DEFAULT_ADMIN_ROLE）
  // AccessControl 的 RoleGranted 事件: RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
  const roleGrantedTopic = ethers.id("RoleGranted(bytes32,address,address)");
  
  console.log("📋 查询 RoleGranted 事件...");
  console.log("   这可能需要一些时间...");
  console.log("");

  try {
    // 查询最近的 RoleGranted 事件
    const filter = {
      address: REWARD_VAULT_ADDRESS,
      topics: [
        roleGrantedTopic,
        ethers.zeroPadValue(DEFAULT_ADMIN_ROLE, 32), // role = DEFAULT_ADMIN_ROLE
      ],
    };

    const logs = await provider.getLogs({
      ...filter,
      fromBlock: 0,
      toBlock: "latest",
    });

    console.log(`   找到 ${logs.length} 个 DEFAULT_ADMIN_ROLE 的 RoleGranted 事件`);
    console.log("");

    if (logs.length > 0) {
      console.log("📋 拥有 DEFAULT_ADMIN_ROLE 的地址:");
      const admins = new Set<string>();
      
      for (const log of logs) {
        // 解析事件
        // topics[0] = RoleGranted signature
        // topics[1] = role (DEFAULT_ADMIN_ROLE)
        // topics[2] = account (拥有角色的地址)
        // topics[3] = sender (授予角色的地址)
        if (log.topics.length >= 3) {
          const account = ethers.getAddress("0x" + log.topics[2].slice(-40));
          admins.add(account);
          console.log(`   ✅ ${account}`);
        }
      }
      console.log("");
      console.log("💡 使用其中一个地址的私钥运行 set-reward-vault-operator.ts");
    } else {
      console.log("   ⚠️  未找到 DEFAULT_ADMIN_ROLE 的 RoleGranted 事件");
      console.log("");
      console.log("   尝试查询所有 RoleGranted 事件...");
      
      // 查询所有 RoleGranted 事件
      const allLogs = await provider.getLogs({
        address: REWARD_VAULT_ADDRESS,
        topics: [roleGrantedTopic],
        fromBlock: 0,
        toBlock: "latest",
      });

      console.log(`   找到 ${allLogs.length} 个 RoleGranted 事件`);
      console.log("");

      if (allLogs.length > 0) {
        console.log("📋 所有角色授予记录（前 20 条）:");
        for (let i = 0; i < Math.min(allLogs.length, 20); i++) {
          const log = allLogs[i];
          if (log.topics.length >= 3) {
            const role = log.topics[1];
            const account = ethers.getAddress("0x" + log.topics[2].slice(-40));
            const isAdmin = role === DEFAULT_ADMIN_ROLE;
            console.log(`   ${i + 1}. ${account} - Role: ${isAdmin ? "DEFAULT_ADMIN_ROLE ✅" : role.slice(0, 10) + "..."}`);
          }
        }
      }
    }
  } catch (error: any) {
    console.error("   ❌ 查询失败:", error.message);
    console.log("");
    console.log("💡 替代方法:");
    console.log("   1. 查看 RewardVault 的部署/初始化交易");
    console.log("   2. 查看 BSCScan 上的合约页面");
    console.log("   3. 检查部署脚本中的 admin 地址");
  }

  console.log("");
  console.log("🔗 BSCScan:");
  console.log(`   https://bscscan.com/address/${REWARD_VAULT_ADDRESS}#events`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



















