import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 检查 BNB Chain 地址的委托状态
 * 
 * 用于检查地址是否被委托，以及委托给了哪个地址
 */

// BNB Chain 系统委托合约地址
const DELEGATION_CONTRACT_MAINNET = "0x0000000000000000000000000000000000001000";

// 目标地址
const TARGET_ADDRESS = "0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6";

/**
 * BNB Chain 委托合约 ABI
 */
const DELEGATION_ABI = [
  "function getDelegated(address delegator) external view returns (address)",
  "function getDelegations(address delegator) external view returns (address[] memory)",
  "function getDelegation(address delegator, address validator) external view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "https://bsc-dataseed1.binance.org"
  );

  console.log("🔍 检查委托状态...");
  console.log("目标地址:", TARGET_ADDRESS);
  console.log("");

  // 连接到委托合约
  const delegationContract = new ethers.Contract(
    DELEGATION_CONTRACT_MAINNET,
    DELEGATION_ABI,
    provider
  );

  try {
    // 查询委托状态
    console.log("📋 查询委托信息...");
    const delegatedTo = await delegationContract.getDelegated(TARGET_ADDRESS);
    console.log("当前委托给:", delegatedTo);
    
    if (delegatedTo === ethers.ZeroAddress) {
      console.log("✅ 地址未被委托");
    } else {
      console.log("⚠️  地址已被委托到:", delegatedTo);
      
      // 查询委托金额（如果有）
      try {
        const delegationAmount = await delegationContract.getDelegation(
          TARGET_ADDRESS,
          delegatedTo
        );
        console.log("委托金额:", ethers.formatEther(delegationAmount), "BNB");
      } catch (error) {
        // 某些委托可能没有金额信息
      }
    }

    // 查询所有委托
    try {
      const delegations = await delegationContract.getDelegations(TARGET_ADDRESS);
      if (delegations && delegations.length > 0) {
        console.log("");
        console.log("所有委托:");
        for (let i = 0; i < delegations.length; i++) {
          console.log(`  ${i + 1}. ${delegations[i]}`);
        }
      }
    } catch (error) {
      // 某些合约可能不支持此函数
      console.log("(无法查询所有委托列表)");
    }

  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
    console.log("");
    console.log("💡 提示:");
    console.log("1. 检查 RPC URL 是否正确");
    console.log("2. 检查地址是否正确");
    console.log("3. 可能需要在 BSCScan 上直接查看");
    console.log("   链接: https://bscscan.com/address/" + TARGET_ADDRESS);
  }

  console.log("");
  console.log("📝 下一步:");
  if (delegatedTo !== ethers.ZeroAddress) {
    console.log("1. 运行取消委托脚本: npx hardhat run scripts/undelegate-from-malicious.ts --network bscMainnet");
    console.log("2. 或通过 BSCScan 取消委托");
  } else {
    console.log("✅ 可以直接进行所有权转移");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























