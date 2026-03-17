import { PrismaClient } from '@prisma/client';
import { RevenueService } from '../src/modules/revenue/revenue.service';
import { ContractService } from '../src/modules/contract/contract.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

// 注意：这个脚本需要在实际的后端服务环境中运行
// 或者需要手动初始化所有依赖

async function manualSyncVault() {
  console.log('\n🔄 手动触发 RewardVault 同步\n');
  console.log('='.repeat(80));

  try {
    // 这里需要初始化服务
    // 由于依赖注入，直接运行可能比较复杂
    // 建议通过 API 或服务内部调用
    
    console.log('💡 建议通过以下方式触发同步:');
    console.log('');
    console.log('1. 通过 API 调用 syncNFTsFromSubgraph（会自动触发 RewardVault 同步）:');
    console.log('   POST /admin/nfts/sync-from-subgraph');
    console.log('');
    console.log('2. 或者等待自动同步（每小时或每天）');
    console.log('');
    console.log('3. 或者直接调用后端服务的 syncReferralRewardsToVault 方法');
    console.log('');

    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  }
}

manualSyncVault()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  });



















