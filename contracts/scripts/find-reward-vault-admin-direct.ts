import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 直接查询 RewardVault 的 DEFAULT_ADMIN_ROLE
 */

const DEFAULT_REWARD_VAULT_ADDRESS = "0xb34AF294558761dcD366ffe998759F2C9BC26a8A";
const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS || DEFAULT_REWARD_VAULT_ADDRESS;

async function main() {
  console.log("🔍 查找 RewardVault 的 DEFAULT_ADMIN_ROLE...");
  console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log("");

  // 使用多个 RPC 节点尝试
  const rpcUrls = [
    "https://bsc-dataseed2.binance.org",
    "https://bsc-dataseed3.binance.org",
    "https://bsc-dataseed4.binance.org",
    "https://bsc-dataseed.binance.org",
    "https://bsc-rpc.publicnode.com",
    "https://bsc.publicnode.com",
  ];

  let provider = ethers.provider;
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  // 连接到 RewardVault
  const RewardVault = await ethers.getContractAt("RewardVault", REWARD_VAULT_ADDRESS);

  console.log("📋 方法 1: 查询 RoleGranted 事件...");
  console.log("");

  try {
    // RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
    const roleGrantedTopic = ethers.id("RoleGranted(bytes32,address,address)");
    
    // 查询 DEFAULT_ADMIN_ROLE 的 RoleGranted 事件
    const filter = {
      address: REWARD_VAULT_ADDRESS,
      topics: [
        roleGrantedTopic,
        ethers.zeroPadValue(DEFAULT_ADMIN_ROLE, 32), // role = DEFAULT_ADMIN_ROLE
      ],
    };

    // 从合约创建开始查询（使用一个较早的区块号，BSC 主网从 0 开始）
    // 但为了效率，我们从最近的区块往前查询
    let currentBlock = await provider.getBlockNumber();
    let fromBlock = Math.max(0, currentBlock - 50000); // 先查询最近 5 万个区块

    console.log(`   查询范围: 区块 ${fromBlock} 到 ${currentBlock}`);
    console.log("   这可能需要一些时间...");
    console.log("");

    let logs: any[] = [];
    let lastError: any = null;

    // 尝试使用不同的 RPC 节点
    for (let i = 0; i < rpcUrls.length; i++) {
      try {
        console.log(`   尝试 RPC ${i + 1}/${rpcUrls.length}: ${rpcUrls[i]}...`);
        const testProvider = new ethers.JsonRpcProvider(rpcUrls[i]);
        currentBlock = await testProvider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 50000);
        
        logs = await testProvider.getLogs({
          ...filter,
          fromBlock,
          toBlock: "latest",
        });
        
        console.log(`   ✅ 成功！使用 RPC: ${rpcUrls[i]}`);
        provider = testProvider; // 使用成功的 provider
        break;
      } catch (error: any) {
        lastError = error;
        if (error.message.includes("limit") || error.message.includes("exceeded")) {
          console.log(`   ⚠️  RPC ${i + 1} 受限，尝试下一个...`);
          continue;
        } else {
          throw error;
        }
      }
    }

    if (logs.length === 0 && lastError) {
      throw lastError;
    }

    console.log(`   ✅ 找到 ${logs.length} 个 DEFAULT_ADMIN_ROLE 的 RoleGranted 事件`);
    console.log("");

    if (logs.length > 0) {
      const admins = new Set<string>();
      
      for (const log of logs) {
        if (log.topics.length >= 3) {
          const account = ethers.getAddress("0x" + log.topics[2].slice(-40));
          admins.add(account);
        }
      }

      console.log("📋 拥有 DEFAULT_ADMIN_ROLE 的地址:");
      for (const admin of admins) {
        console.log(`   ✅ ${admin}`);
        
        // 验证这个地址是否真的有 DEFAULT_ADMIN_ROLE
        try {
          const hasAdmin = await RewardVault.hasRole(DEFAULT_ADMIN_ROLE, admin);
          const hasOperator = await RewardVault.hasRole(OPERATOR_ROLE, admin);
          console.log(`      DEFAULT_ADMIN_ROLE: ${hasAdmin ? "✅" : "❌"}`);
          console.log(`      OPERATOR_ROLE: ${hasOperator ? "✅" : "❌"}`);
        } catch (error: any) {
          console.log(`      ⚠️  验证失败: ${error.message}`);
        }
        console.log("");
      }
    } else {
      console.log("   ⚠️  在最近 10 万个区块中未找到 DEFAULT_ADMIN_ROLE 的 RoleGranted 事件");
      console.log("");
      console.log("📋 方法 2: 查询所有 RoleGranted 事件...");
      
      const allLogs = await provider.getLogs({
        address: REWARD_VAULT_ADDRESS,
        topics: [roleGrantedTopic],
        fromBlock,
        toBlock: "latest",
      });

      console.log(`   找到 ${allLogs.length} 个 RoleGranted 事件`);
      console.log("");

      if (allLogs.length > 0) {
        console.log("📋 所有角色授予记录（前 20 条）:");
        const seen = new Set<string>();
        for (let i = 0; i < Math.min(allLogs.length, 20); i++) {
          const log = allLogs[i];
          if (log.topics.length >= 3) {
            const role = log.topics[1];
            const account = ethers.getAddress("0x" + log.topics[2].slice(-40));
            const isAdmin = role === DEFAULT_ADMIN_ROLE;
            const isOperator = role === OPERATOR_ROLE;
            
            const key = `${account}-${role}`;
            if (!seen.has(key)) {
              seen.add(key);
              console.log(`   ${i + 1}. ${account}`);
              console.log(`      Role: ${isAdmin ? "DEFAULT_ADMIN_ROLE ✅" : isOperator ? "OPERATOR_ROLE" : role.slice(0, 10) + "..."}`);
              console.log("");
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("   ❌ 查询失败:", error.message);
    console.log("");
    console.log("💡 如果遇到 'limit exceeded' 错误，建议:");
    console.log("   1. 直接查看 BSCScan:");
    console.log(`      https://bscscan.com/address/${REWARD_VAULT_ADDRESS}#events`);
    console.log("   2. 查找 'RoleGranted' 事件");
    console.log("   3. 查找 role 为 '0x0000000000000000000000000000000000000000000000000000000000000000' 的事件");
    console.log("   4. account 字段就是 admin 地址");
  }

  console.log("");
  console.log("🔗 BSCScan:");
  console.log(`   https://bscscan.com/address/${REWARD_VAULT_ADDRESS}#events`);
  console.log("");
  console.log("💡 提示:");
  console.log("   找到 admin 地址后，使用该地址的私钥运行 set-reward-vault-operator.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

