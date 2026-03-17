import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 执行紧急恢复
 * 
 * 这个脚本会：
 * 1. 取消目标地址的委托
 * 2. 转移所有合约的所有权到新地址
 * 3. Gas 由执行者支付
 */

// 合约地址（从部署结果获取）
const EMERGENCY_RECOVERY_ADDRESS = process.env.EMERGENCY_RECOVERY_ADDRESS || "";

// 目标地址（私钥泄露的地址）
const TARGET_ADDRESS = "0xa80eb088b28444914000Bec0D2894A9EDf43F0cb6";

// 恶意验证者地址（需要从 BSCScan 获取完整地址）
const MALICIOUS_VALIDATOR = process.env.MALICIOUS_VALIDATOR_ADDRESS || "";

// 新 Owner 地址（应该是多签钱包）
const NEW_OWNER = process.env.NEW_OWNER_ADDRESS || "";

// 需要转移所有权的合约
const CONTRACTS_TO_TRANSFER = [
  "0xD9eA9F4B8F24872262568fB2C6133117EC02C774", // NFTManager
  "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b", // NodeNFT
  "0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011", // EnclaveToken
  "0x67B8927F0835e79632f4622F017915Cb0B9a6c72", // TokenVesting
];

async function main() {
  const [executor] = await ethers.getSigners();
  console.log("🔐 Executor address:", executor.address);
  console.log("   (Gas 将由此地址支付)");
  console.log("");
  console.log("🎯 Target address:", TARGET_ADDRESS);
  console.log("   (需要恢复的地址)");
  console.log("");
  
  if (!EMERGENCY_RECOVERY_ADDRESS) {
    throw new Error("EMERGENCY_RECOVERY_ADDRESS 环境变量未设置");
  }
  
  if (!NEW_OWNER) {
    throw new Error("NEW_OWNER_ADDRESS 环境变量未设置（应该是多签钱包地址）");
  }
  
  console.log("📋 配置:");
  console.log("   紧急恢复合约:", EMERGENCY_RECOVERY_ADDRESS);
  console.log("   恶意验证者:", MALICIOUS_VALIDATOR || "(将从链上查询)");
  console.log("   新 Owner:", NEW_OWNER);
  console.log("   需要转移的合约数量:", CONTRACTS_TO_TRANSFER.length);
  console.log("");

  // 连接到紧急恢复合约
  const EmergencyRecovery = await ethers.getContractFactory("EmergencyRecovery");
  const recovery = EmergencyRecovery.attach(EMERGENCY_RECOVERY_ADDRESS);
  
  // 检查当前委托状态
  console.log("📋 步骤 1: 检查委托状态...");
  try {
    const delegatedTo = await recovery.getDelegationStatus(TARGET_ADDRESS);
    console.log("   当前委托给:", delegatedTo);
    
    if (delegatedTo === ethers.ZeroAddress) {
      console.log("   ✅ 地址未被委托");
    } else {
      console.log("   ⚠️  地址已被委托，需要取消");
    }
  } catch (error: any) {
    console.log("   ⚠️  无法查询委托状态:", error.message);
  }
  console.log("");

  // 检查合约当前 Owner
  console.log("📋 步骤 2: 检查合约当前 Owner...");
  for (const contractAddr of CONTRACTS_TO_TRANSFER) {
    try {
      const owner = await recovery.getContractOwner(contractAddr);
      console.log(`   ${contractAddr.slice(0, 10)}...: ${owner}`);
      if (owner.toLowerCase() !== TARGET_ADDRESS.toLowerCase()) {
        console.log(`      ⚠️  警告: Owner 不是目标地址`);
      }
    } catch (error: any) {
      console.log(`   ${contractAddr.slice(0, 10)}...: 查询失败 - ${error.message}`);
    }
  }
  console.log("");

  // 执行紧急恢复
  console.log("📋 步骤 3: 执行紧急恢复...");
  console.log("   ⚠️  这将取消委托并转移所有权");
  console.log("");

  try {
    // 如果知道恶意验证者地址，使用它；否则传 address(0) 让合约处理
    const validatorToRevoke = MALICIOUS_VALIDATOR || ethers.ZeroAddress;
    
    // 空签名数组（如果合约需要签名验证，需要提供）
    const signatures: string[] = [];
    
    const tx = await recovery.emergencyRecover(
      TARGET_ADDRESS,
      validatorToRevoke,
      CONTRACTS_TO_TRANSFER,
      NEW_OWNER,
      signatures,
      {
        gasLimit: 5000000, // 设置足够的 gas limit
      }
    );
    
    console.log("   交易已发送:", tx.hash);
    console.log("   等待确认...");
    
    const receipt = await tx.wait();
    console.log("   ✅ 紧急恢复执行成功");
    console.log("   区块:", receipt.blockNumber);
    console.log("   Gas 使用:", receipt.gasUsed.toString());
    console.log("");

    // 验证结果
    console.log("📋 步骤 4: 验证恢复结果...");
    
    // 检查委托状态
    try {
      const newDelegatedTo = await recovery.getDelegationStatus(TARGET_ADDRESS);
      if (newDelegatedTo === ethers.ZeroAddress) {
        console.log("   ✅ 委托已取消");
      } else {
        console.log("   ⚠️  仍有委托:", newDelegatedTo);
      }
    } catch (error) {
      console.log("   (无法验证委托状态)");
    }
    
    // 检查合约 Owner
    console.log("   检查合约 Owner:");
    for (const contractAddr of CONTRACTS_TO_TRANSFER) {
      try {
        const owner = await recovery.getContractOwner(contractAddr);
        if (owner.toLowerCase() === NEW_OWNER.toLowerCase()) {
          console.log(`   ✅ ${contractAddr.slice(0, 10)}...: ${owner}`);
        } else {
          console.log(`   ⚠️  ${contractAddr.slice(0, 10)}...: ${owner} (应该是 ${NEW_OWNER})`);
        }
      } catch (error) {
        console.log(`   ❌ ${contractAddr.slice(0, 10)}...: 查询失败`);
      }
    }

  } catch (error: any) {
    console.error("❌ 紧急恢复失败:", error.message);
    if (error.reason) {
      console.error("   原因:", error.reason);
    }
    if (error.data) {
      console.error("   数据:", error.data);
    }
    throw error;
  }

  console.log("");
  console.log("✅ 紧急恢复流程完成");
  console.log("📝 请在 BSCScan 上验证所有操作");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });























