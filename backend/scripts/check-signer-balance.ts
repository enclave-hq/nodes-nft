import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkSignerBalance() {
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!rpcUrl) {
    console.log('❌ 错误: 未设置 RPC_URL 环境变量');
    process.exit(1);
  }

  if (!privateKey) {
    console.log('❌ 错误: 未设置 ADMIN_PRIVATE_KEY 环境变量');
    process.exit(1);
  }

  console.log('\n🔍 检查签名者地址和余额\n');
  console.log('='.repeat(80));

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const address = signer.address;

    console.log(`📋 签名者地址: ${address}`);
    console.log('-'.repeat(80));

    // 查询 BNB 余额
    const balance = await provider.getBalance(address);
    const balanceBNB = ethers.formatEther(balance);

    console.log(`💰 BNB 余额: ${balanceBNB} BNB`);
    console.log(`   Wei: ${balance.toString()}`);

    // 估算 gas 价格
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const maxFeePerGas = feeData.maxFeePerGas || BigInt(0);
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt(0);

    console.log(`\n⛽ Gas 信息:`);
    console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    if (maxFeePerGas > 0) {
      console.log(`   Max Fee Per Gas: ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`);
      console.log(`   Max Priority Fee Per Gas: ${ethers.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`);
    }

    // 估算一次 RewardVault 同步的 gas 成本（假设更新 5 个地址）
    // 根据错误信息，tx cost 是 4817100000000 wei
    const estimatedGasCost = BigInt('4817100000000');
    const estimatedGasCostBNB = ethers.formatEther(estimatedGasCost);

    console.log(`\n💸 估算的 Gas 成本:`);
    console.log(`   单次同步（5个地址）: ${estimatedGasCostBNB} BNB`);
    console.log(`   Wei: ${estimatedGasCost.toString()}`);

    // 检查余额是否足够
    if (balance < estimatedGasCost) {
      const shortage = estimatedGasCost - balance;
      const shortageBNB = ethers.formatEther(shortage);
      console.log(`\n❌ 余额不足！`);
      console.log(`   需要: ${estimatedGasCostBNB} BNB`);
      console.log(`   当前: ${balanceBNB} BNB`);
      console.log(`   缺少: ${shortageBNB} BNB`);
      console.log(`\n💡 建议: 向地址 ${address} 转入至少 ${estimatedGasCostBNB} BNB`);
    } else {
      const remaining = balance - estimatedGasCost;
      const remainingBNB = ethers.formatEther(remaining);
      console.log(`\n✅ 余额充足`);
      console.log(`   当前余额: ${balanceBNB} BNB`);
      console.log(`   同步后剩余: ${remainingBNB} BNB`);
    }

    // 检查是否有 OPERATOR_ROLE
    const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS;
    if (REWARD_VAULT_ADDRESS) {
      console.log(`\n🔐 检查 RewardVault 权限:`);
      console.log(`   RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
      
      const rewardVaultAbi = [
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function OPERATOR_ROLE() view returns (bytes32)',
      ];
      const vault = new ethers.Contract(REWARD_VAULT_ADDRESS, rewardVaultAbi, provider);
      
      try {
        const OPERATOR_ROLE = await vault.OPERATOR_ROLE();
        const hasRole = await vault.hasRole(OPERATOR_ROLE, address);
        
        console.log(`   签名者是否有 OPERATOR_ROLE: ${hasRole ? '✅ 是' : '❌ 否'}`);
        if (!hasRole) {
          console.log(`\n⚠️  签名者地址 ${address} 没有 OPERATOR_ROLE 权限！`);
          console.log(`   需要管理员授予该地址 OPERATOR_ROLE 权限`);
        }
      } catch (e: any) {
        console.log(`   ⚠️  无法查询权限: ${e.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  }
}

checkSignerBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  });



















