import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 快速取消委托并转移所有权脚本
 * 
 * 这个脚本使用目标地址的私钥签名，但可以由执行者代付 gas（通过发送BNB到目标地址）
 * 
 * 执行流程：
 * 1. 执行者发送少量 BNB 到目标地址（用于支付 gas）
 * 2. 使用目标地址的私钥签名并发送取消委托交易
 * 3. 使用目标地址的私钥签名并发送所有权转移交易
 * 
 * 注意：如果目标地址完全没有 BNB，需要先发送 BNB
 */

// 目标地址（私钥泄露的地址）
// 注意：脚本会自动使用私钥对应的地址，不需要硬编码
const TARGET_ADDRESS = process.env.TARGET_ADDRESS || "";

// BNB Chain 系统委托合约
const DELEGATION_CONTRACT = "0x0000000000000000000000000000000000001000";

// 需要转移所有权的合约
const CONTRACTS = {
  NFT_MANAGER: "0xD9eA9F4B8F24872262568fB2C6133117EC02C774",
  NODE_NFT: "0x6F0f5fE4B9FA05CA5C2690d4106F46Bf5e06629b",
  ENCLAVE_TOKEN: "0xDA8cB40036ACA4994B95c0Ae7D41f8944f0B5011",
  TOKEN_VESTING: "0x67B8927F0835e79632f4622F017915Cb0B9a6c72",
};

// 新 Owner 地址（应该是多签钱包）
const NEW_OWNER = process.env.NEW_OWNER_ADDRESS || "";

  // 委托合约 ABI
  const DELEGATION_ABI = [
    "function undelegate(address validator) external",
    "function getDelegated(address delegator) external view returns (address)",
    "function getDelegations(address delegator) external view returns (address[] memory)",
  ];

async function main() {
  // 检查环境变量
  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY;
  const targetPrivateKey = process.env.TARGET_PRIVATE_KEY;
  
  if (!executorPrivateKey) {
    throw new Error("EXECUTOR_PRIVATE_KEY 环境变量未设置（执行者的私钥，用于代付 gas）");
  }
  
  if (!targetPrivateKey) {
    throw new Error("TARGET_PRIVATE_KEY 环境变量未设置（目标地址的私钥）");
  }
  
  if (!NEW_OWNER) {
    throw new Error("NEW_OWNER_ADDRESS 环境变量未设置（应该是多签钱包地址）");
  }

  // 连接到 provider
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org"
  );

  // 创建执行者钱包（代付 gas 的地址）
  const executorWallet = new ethers.Wallet(executorPrivateKey, provider);
  console.log("🔐 Executor address:", executorWallet.address);
  console.log("   (将代付 gas 费用)");
  console.log("");

  // 创建目标地址钱包
  const targetWallet = new ethers.Wallet(targetPrivateKey, provider);
  const actualTargetAddress = targetWallet.address;
  console.log("🎯 Target address (from private key):", actualTargetAddress);
  
  // 使用实际私钥对应的地址，而不是硬编码的地址
  const finalTargetAddress = actualTargetAddress;
  
  // 如果设置了 TARGET_ADDRESS 环境变量，进行验证
  if (TARGET_ADDRESS && TARGET_ADDRESS !== "0xa80eb088b2844914000Bec0D2894A9EDf43F0cb6") {
    if (actualTargetAddress.toLowerCase() !== TARGET_ADDRESS.toLowerCase()) {
      console.log("   ⚠️  警告: 私钥对应的地址与 TARGET_ADDRESS 环境变量不匹配");
      console.log(`   将使用私钥对应的地址: ${actualTargetAddress}`);
    }
  }
  console.log("");

  const targetSigner = targetWallet;

  // 检查目标地址余额
  const targetBalance = await provider.getBalance(finalTargetAddress);
  console.log("💰 目标地址余额:", ethers.formatEther(targetBalance), "BNB");
  
  // 计算实际需要的 gas 费用
  // 1. 取消委托: ~200,000 gas
  // 2. 转移所有权 (3个合约): ~200,000 gas * 3 = 600,000 gas
  // 总计: ~800,000 gas
  // 加上安全余量: 1,000,000 gas
  const estimatedGasLimit = 1000000n;
  
  // 获取当前 gas price
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || 3000000000n; // 默认 3 gwei
  const maxGasPrice = feeData.maxFeePerGas || gasPrice;
  
  // 计算需要的 BNB: gas limit * gas price + 安全余量 (20%)
  const estimatedGasCost = (estimatedGasLimit * maxGasPrice * 120n) / 100n;
  const minRequiredBalance = estimatedGasCost;
  
  console.log("📊 Gas 费用估算:");
  console.log(`   Gas Limit: ${estimatedGasLimit.toLocaleString()}`);
  console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`   预计费用: ${ethers.formatEther(estimatedGasCost)} BNB`);
  console.log("");
  
  // 如果余额不足，执行者发送 BNB
  if (targetBalance < minRequiredBalance) {
    const neededAmount = minRequiredBalance - targetBalance;
    const sendAmount = neededAmount + (neededAmount * 10n) / 100n; // 加 10% 安全余量
    
    console.log("⚠️  余额不足，执行者将发送 BNB...");
    console.log(`   需要: ${ethers.formatEther(neededAmount)} BNB`);
    console.log(`   将发送: ${ethers.formatEther(sendAmount)} BNB (含 10% 安全余量)`);
    
    // 检查执行者余额
    const executorBalance = await provider.getBalance(executorWallet.address);
    const executorNeeded = sendAmount + (estimatedGasLimit * maxGasPrice); // 发送交易本身也需要 gas
    
    if (executorBalance < executorNeeded) {
      throw new Error(
        `执行者余额不足:\n` +
        `  需要: ${ethers.formatEther(executorNeeded)} BNB\n` +
        `  当前: ${ethers.formatEther(executorBalance)} BNB\n` +
        `  缺少: ${ethers.formatEther(executorNeeded - executorBalance)} BNB`
      );
    }
    
    const sendTx = await executorWallet.sendTransaction({
      to: finalTargetAddress,
      value: sendAmount,
      gasLimit: 21000, // 标准转账 gas limit
    });
    console.log("   交易已发送:", sendTx.hash);
    console.log("   等待确认...");
    const sendReceipt = await sendTx.wait();
    console.log("   ✅ BNB 已发送");
    console.log(`   实际费用: ${ethers.formatEther(sendReceipt.gasUsed * sendReceipt.gasPrice!)} BNB`);
    console.log("");
    
    // 等待余额更新
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalance = await provider.getBalance(finalTargetAddress);
    console.log(`   目标地址新余额: ${ethers.formatEther(newBalance)} BNB`);
    console.log("");
  }

  // 步骤 1: 取消委托（必须先执行）
  console.log("📋 步骤 1: 取消委托（必须先执行）...");
  const delegationContract = new ethers.Contract(
    DELEGATION_CONTRACT,
    DELEGATION_ABI,
    targetSigner
  );

  let delegationRevoked = false;
  try {
    // 查询当前委托状态
    const delegatedTo = await delegationContract.getDelegated(finalTargetAddress);
    console.log("   当前委托给:", delegatedTo);
    
    if (delegatedTo === ethers.ZeroAddress) {
      console.log("   ✅ 地址未被委托，可以继续");
      delegationRevoked = true;
    } else {
      console.log("   ⚠️  发现委托，必须先取消委托才能转移所有权");
      
      // 获取恶意验证者地址（从环境变量或自动检测）
      const maliciousValidator = process.env.MALICIOUS_VALIDATOR_ADDRESS || delegatedTo;
      
      console.log("   正在取消委托给:", maliciousValidator);
      
      // 估算 gas
      try {
        const estimatedGas = await delegationContract.undelegate.estimateGas(maliciousValidator);
        console.log(`   估算 Gas: ${estimatedGas.toString()}`);
      } catch (e) {
        // 如果估算失败，使用默认值
      }
      
      const undelegateTx = await delegationContract.undelegate(maliciousValidator, {
        gasLimit: 500000,
      });
      console.log("   交易已发送:", undelegateTx.hash);
      console.log("   等待确认...");
      
      const receipt = await undelegateTx.wait();
      console.log("   ✅ 委托已取消");
      console.log("   区块:", receipt.blockNumber);
      console.log("   Gas 使用:", receipt.gasUsed.toString());
      console.log("   Gas 费用:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice!), "BNB");
      
      delegationRevoked = true;
      
      // 验证委托已取消
      const newDelegatedTo = await delegationContract.getDelegated(finalTargetAddress);
      if (newDelegatedTo === ethers.ZeroAddress) {
        console.log("   ✅ 验证: 委托已成功取消");
      } else {
        console.log("   ⚠️  警告: 委托可能未完全取消，当前委托给:", newDelegatedTo);
      }
    }
  } catch (error: any) {
    console.error("   ❌ 取消委托失败:", error.message);
    if (error.reason) {
      console.error("   原因:", error.reason);
    }
    throw new Error(`无法取消委托，无法继续转移所有权。错误: ${error.message}`);
  }
  
  if (!delegationRevoked) {
    throw new Error("委托未取消，无法继续执行所有权转移");
  }
  
  console.log("");

  // 步骤 2: 转移所有权（委托已取消后执行）
  console.log("📋 步骤 2: 转移合约所有权（委托已取消，可以继续）...");
  
  const contracts = [
    { name: "NodeNFT", address: CONTRACTS.NODE_NFT },
    { name: "EnclaveToken", address: CONTRACTS.ENCLAVE_TOKEN },
    { name: "TokenVesting", address: CONTRACTS.TOKEN_VESTING },
  ];

  // 标准 Ownable ABI
  const OWNABLE_ABI = [
    "function transferOwnership(address newOwner) external",
    "function owner() external view returns (address)",
  ];

  for (const contract of contracts) {
    try {
      const ownable = new ethers.Contract(contract.address, OWNABLE_ABI, targetSigner);
      
      // 检查当前 Owner
      const currentOwner = await ownable.owner();
      console.log(`   ${contract.name} (${contract.address.slice(0, 10)}...):`);
      console.log(`      当前 Owner: ${currentOwner}`);
      
      if (currentOwner.toLowerCase() === finalTargetAddress.toLowerCase()) {
        // 转移所有权
        const tx = await ownable.transferOwnership(NEW_OWNER, {
          gasLimit: 200000,
        });
        console.log(`      交易已发送: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`      ✅ 所有权已转移`);
        console.log(`      区块: ${receipt.blockNumber}`);
      } else {
        console.log(`      ⚠️  Owner 不匹配，跳过`);
      }
    } catch (error: any) {
      console.error(`      ❌ 转移失败: ${error.message}`);
    }
    console.log("");
  }

  // 步骤 3: 处理 NFTManager (Diamond Pattern)
  console.log("📋 步骤 3: 处理 NFTManager (Diamond Pattern)...");
  console.log("   ⚠️  NFTManager 使用 Diamond Pattern，需要特殊处理");
  console.log("   请检查 AdminFacet 是否有 transferOwnership 函数");
  console.log("   如果没有，需要添加新的 Facet");
  console.log("");

  console.log("✅ 恢复流程完成");
  console.log("📝 请在 BSCScan 上验证所有操作");
  console.log("");
  console.log("🔗 验证链接:");
  console.log(`   目标地址: https://bscscan.com/address/${finalTargetAddress}`);
  for (const contract of contracts) {
    console.log(`   ${contract.name}: https://bscscan.com/address/${contract.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

