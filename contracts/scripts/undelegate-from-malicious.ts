import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * BNB Chain 委托取消脚本
 * 
 * 在 BNB Chain 上，地址可能被委托给验证者或恶意合约
 * 需要先取消委托，然后才能进行其他操作（如转移所有权）
 * 
 * BNB Chain 委托合约地址：
 * - Mainnet: 0x0000000000000000000000000000000000001000 (系统合约)
 * - 或使用 BSC Validator 合约
 */

// BNB Chain 系统委托合约地址
const DELEGATION_CONTRACT_MAINNET = "0x0000000000000000000000000000000000001000";

// 从图片中看到的委托地址（需要从 BSCScan 获取完整地址）
// 在 BSCScan 上查看地址的 "Delegated to" 部分获取完整地址
const MALICIOUS_DELEGATE_ADDRESS = process.env.MALICIOUS_DELEGATE_ADDRESS || ""; // 从环境变量读取或手动设置

// 目标地址（需要取消委托的地址）
const TARGET_ADDRESS = "0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6";

/**
 * BNB Chain 委托合约 ABI（简化版）
 * 主要函数：
 * - delegate(address validator) - 委托给验证者
 * - undelegate(address validator) - 取消委托
 * - getDelegated(address delegator) - 查询委托状态
 */
const DELEGATION_ABI = [
  "function delegate(address validator) external",
  "function undelegate(address validator) external",
  "function getDelegated(address delegator) external view returns (address)",
  "function getDelegations(address delegator) external view returns (address[] memory)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("🔐 Signer address:", signer.address);
  console.log("🎯 Target address:", TARGET_ADDRESS);
  console.log("");

  // 检查 signer 是否有权限操作目标地址
  if (signer.address.toLowerCase() !== TARGET_ADDRESS.toLowerCase()) {
    console.log("⚠️  警告: Signer 地址与目标地址不匹配");
    console.log("   请确保使用目标地址对应的私钥");
    console.log("");
  }

  // 连接到委托合约
  const delegationContract = new ethers.Contract(
    DELEGATION_CONTRACT_MAINNET,
    DELEGATION_ABI,
    signer
  );

  console.log("📋 步骤 1: 查询当前委托状态...");
  try {
    // 查询委托状态
    const delegatedTo = await delegationContract.getDelegated(TARGET_ADDRESS);
    console.log("   当前委托给:", delegatedTo);
    
    if (delegatedTo === ethers.ZeroAddress) {
      console.log("   ✅ 地址未被委托，可以直接进行所有权转移");
      return;
    }

    // 查询所有委托
    const delegations = await delegationContract.getDelegations(TARGET_ADDRESS);
    console.log("   所有委托:", delegations);
    console.log("");

    console.log("📋 步骤 2: 取消委托...");
    
    // 取消委托
    // 优先取消委托给恶意地址的委托
    let foundMalicious = false;
    
    // 如果指定了恶意地址，优先取消
    if (MALICIOUS_DELEGATE_ADDRESS) {
      const maliciousAddr = MALICIOUS_DELEGATE_ADDRESS.toLowerCase();
      for (const validator of delegations) {
        if (validator.toLowerCase() === maliciousAddr) {
          console.log(`   ⚠️  发现恶意委托地址: ${validator}`);
          console.log("   正在取消恶意委托...");
          foundMalicious = true;
          
          try {
            const tx = await delegationContract.undelegate(validator, {
              gasLimit: 500000,
            });
            console.log("   交易已发送:", tx.hash);
            console.log("   等待确认...");
            
            const receipt = await tx.wait();
            console.log("   ✅ 恶意委托已取消");
            console.log("   区块:", receipt.blockNumber);
            console.log("   Gas 使用:", receipt.gasUsed.toString());
            console.log("");
            break;
          } catch (error: any) {
            console.error("   ❌ 取消委托失败:", error.message);
            if (error.reason) {
              console.error("   原因:", error.reason);
            }
          }
        }
      }
    }
    
    // 如果没有找到指定的恶意地址，取消所有委托
    if (!foundMalicious) {
      console.log("   取消所有委托...");
      for (const validator of delegations) {
        console.log(`   取消委托给: ${validator}`);
        
        // 检查是否是恶意地址（通过部分匹配）
        if (validator.toLowerCase().includes("3ae1f70c") || 
            validator.toLowerCase().includes("f62162d10")) {
          console.log("   ⚠️  发现可能的恶意委托地址");
        }
        
        try {
          const tx = await delegationContract.undelegate(validator, {
            gasLimit: 500000,
          });
          console.log("   交易已发送:", tx.hash);
          console.log("   等待确认...");
          
          const receipt = await tx.wait();
          console.log("   ✅ 委托已取消");
          console.log("   区块:", receipt.blockNumber);
          console.log("   Gas 使用:", receipt.gasUsed.toString());
          console.log("");
        } catch (error: any) {
          console.error("   ❌ 取消委托失败:", error.message);
          if (error.reason) {
            console.error("   原因:", error.reason);
          }
        }
      }
    }

    // 再次验证委托状态
    console.log("📋 步骤 3: 验证委托状态...");
    const newDelegatedTo = await delegationContract.getDelegated(TARGET_ADDRESS);
    if (newDelegatedTo === ethers.ZeroAddress) {
      console.log("   ✅ 委托已成功取消");
    } else {
      console.log("   ⚠️  仍有委托:", newDelegatedTo);
    }

  } catch (error: any) {
    console.error("❌ 查询委托状态失败:", error.message);
    
    // 如果标准委托合约不可用，可能需要使用其他方法
    console.log("");
    console.log("💡 替代方案:");
    console.log("1. 检查是否是 BSC Validator 委托");
    console.log("2. 检查是否是其他类型的委托合约");
    console.log("3. 直接在 BSCScan 上查看委托状态");
    console.log("4. 使用 BSCScan 的合约交互功能取消委托");
  }

  console.log("");
  console.log("✅ 取消委托流程完成");
  console.log("📝 下一步: 执行合约所有权转移");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

