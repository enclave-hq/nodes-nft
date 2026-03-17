import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function debugRewardSync(address: string) {
  const normalizedAddr = address.toLowerCase();

  console.log(`\n🔍 调试地址 ${normalizedAddr} 的返佣同步问题\n`);
  console.log('='.repeat(80));

  // 1. 查询所有相关记录
  const allRecords = await prisma.referralRewardRecord.findMany({
    where: {
      rootReferrerAddress: {
        equals: normalizedAddr,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      nftId: true,
      minterAddress: true,
      rootReferrerAddress: true,
      referralReward: true,
      referralRewardWei: true,
    },
    orderBy: {
      nftId: 'asc',
    },
  });

  console.log(`\n📋 数据库记录总数: ${allRecords.length}`);
  console.log('-'.repeat(80));

  // 2. 排除自返佣后的记录
  const validRecords = allRecords.filter(
    (r) => r.minterAddress.toLowerCase() !== normalizedAddr && r.rootReferrerAddress?.toLowerCase() === normalizedAddr
  );

  console.log(`✅ 有效记录数（排除自返佣）: ${validRecords.length}`);
  console.log('-'.repeat(80));

  // 3. 使用 getDistributableReferralRewards 的方式计算（内存聚合）
  let totalWeiMemory = BigInt(0);
  let recordCountMemory = 0;
  for (const record of allRecords) {
    const minter = record.minterAddress.toLowerCase();
    const directReferrer = record.rootReferrerAddress?.toLowerCase();
    
    if (!directReferrer || minter === directReferrer) {
      continue;
    }
    
    if (directReferrer === normalizedAddr) {
      const rewardWei = BigInt(record.referralRewardWei || '0');
      totalWeiMemory += rewardWei;
      recordCountMemory++;
    }
  }

  console.log(`\n💾 内存聚合结果（getDistributableReferralRewards 方式）:`);
  console.log(`   总返佣: ${ethers.formatUnits(totalWeiMemory, 18)} USDT`);
  console.log(`   总返佣 Wei: ${totalWeiMemory.toString()}`);
  console.log(`   记录数: ${recordCountMemory}`);

  // 4. 使用 syncReferralRewardsToVault 的方式计算（SQL 聚合）
  const sqlRows = await prisma.$queryRawUnsafe<Array<{ address: string; totalWei: string }>>(
    `
    SELECT
      lower("rootReferrerAddress") as "address",
      (SUM(("referralRewardWei")::numeric))::text as "totalWei"
    FROM "referral_reward_records"
    WHERE lower("rootReferrerAddress") = lower($1)
      AND lower("minterAddress") <> lower("rootReferrerAddress")
    GROUP BY lower("rootReferrerAddress")
    `,
    normalizedAddr
  );

  console.log(`\n🗄️  SQL 聚合结果（syncReferralRewardsToVault 方式）:`);
  if (sqlRows.length > 0) {
    const sqlTotalWeiStr = sqlRows[0].totalWei || '0';
    const integerPart = sqlTotalWeiStr.includes('.') ? sqlTotalWeiStr.split('.')[0] : sqlTotalWeiStr;
    const sqlTotalWei = BigInt(integerPart || '0');
    console.log(`   总返佣: ${ethers.formatUnits(sqlTotalWei, 18)} USDT`);
    console.log(`   总返佣 Wei: ${sqlTotalWei.toString()}`);
    console.log(`   SQL 原始值: ${sqlTotalWeiStr}`);
  } else {
    console.log(`   ❌ 未找到记录`);
  }

  // 5. 详细列出每条记录
  console.log(`\n📝 详细记录列表:`);
  console.log('-'.repeat(80));
  console.log('NFT ID | 铸造者地址 | 返佣 (USDT) | 返佣 (Wei) | 是否自返佣');
  console.log('-'.repeat(80));

  for (const record of allRecords) {
    const minter = record.minterAddress.toLowerCase();
    const isSelfReferral = minter === normalizedAddr;
    const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
    const rewardWei = BigInt(record.referralRewardWei || '0');
    const rewardUsdt = ethers.formatUnits(rewardWei, 18);

    console.log(
      `${String(record.nftId).padStart(6)} | ${minterShort.padEnd(15)} | ${rewardUsdt.padEnd(12)} | ${record.referralRewardWei?.padEnd(20)} | ${isSelfReferral ? '是' : '否'}`
    );
  }

  // 6. 检查是否有 NULL 或空值
  const nullRecords = allRecords.filter(
    (r) => !r.rootReferrerAddress || r.rootReferrerAddress.trim() === ''
  );
  if (nullRecords.length > 0) {
    console.log(`\n⚠️  发现 ${nullRecords.length} 条记录的 rootReferrerAddress 为空或 NULL`);
  }

  // 7. 检查 referralRewardWei 格式
  const invalidWeiRecords = allRecords.filter(
    (r) => !r.referralRewardWei || r.referralRewardWei.trim() === '' || isNaN(Number(r.referralRewardWei))
  );
  if (invalidWeiRecords.length > 0) {
    console.log(`\n⚠️  发现 ${invalidWeiRecords.length} 条记录的 referralRewardWei 格式无效`);
    for (const r of invalidWeiRecords) {
      console.log(`   NFT ID ${r.nftId}: referralRewardWei = "${r.referralRewardWei}"`);
    }
  }

  // 8. 对比结果
  console.log(`\n📊 对比结果:`);
  console.log('='.repeat(80));
  if (sqlRows.length > 0) {
    const sqlTotalWeiStr = sqlRows[0].totalWei || '0';
    const integerPart = sqlTotalWeiStr.includes('.') ? sqlTotalWeiStr.split('.')[0] : sqlTotalWeiStr;
    const sqlTotalWei = BigInt(integerPart || '0');
    
    if (totalWeiMemory === sqlTotalWei) {
      console.log(`✅ 两种方式计算结果一致: ${ethers.formatUnits(totalWeiMemory, 18)} USDT`);
    } else {
      console.log(`❌ 两种方式计算结果不一致！`);
      console.log(`   内存聚合: ${ethers.formatUnits(totalWeiMemory, 18)} USDT (${totalWeiMemory.toString()} wei)`);
      console.log(`   SQL 聚合: ${ethers.formatUnits(sqlTotalWei, 18)} USDT (${sqlTotalWei.toString()} wei)`);
      console.log(`   差异: ${ethers.formatUnits(totalWeiMemory > sqlTotalWei ? totalWeiMemory - sqlTotalWei : sqlTotalWei - totalWeiMemory, 18)} USDT`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/debug-reward-sync.ts <地址>');
  console.log('示例: npx ts-node scripts/debug-reward-sync.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  process.exit(1);
}

debugRewardSync(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















