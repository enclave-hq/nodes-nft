import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function checkSyncHistory(address: string) {
  const normalizedAddr = address.toLowerCase();

  console.log(`\n🔍 检查同步历史 - 地址 ${normalizedAddr}\n`);
  console.log('='.repeat(80));

  // 1. 查询所有相关记录，按创建时间排序
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
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`\n📝 所有返佣记录（按创建时间排序）:`);
  console.log('-'.repeat(80));
  console.log('NFT ID | 铸造者 | 返佣(USDT) | 创建时间 | 累计总额');
  console.log('-'.repeat(80));

  let cumulativeTotal = BigInt(0);
  for (const record of allRecords) {
    const minter = record.minterAddress.toLowerCase();
    const referrer = record.rootReferrerAddress?.toLowerCase() || '';
    const rewardWei = BigInt(record.referralRewardWei || '0');
    
    // 检查是否匹配 SQL 条件（排除自返佣）
    const matchesSQL = 
      referrer !== '' &&
      referrer !== null &&
      minter !== referrer &&
      referrer === normalizedAddr;

    if (matchesSQL) {
      cumulativeTotal += rewardWei;
    }

    const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
    const rewardUsdt = ethers.formatUnits(rewardWei, 18);
    const createdAt = record.createdAt.toISOString();

    console.log(
      `${String(record.nftId).padStart(6)} | ${minterShort.padEnd(8)} | ${rewardUsdt.padEnd(11)} | ${createdAt} | ${matchesSQL ? ethers.formatUnits(cumulativeTotal, 18) + ' USDT' : '排除'}`
    );
  }

  console.log('-'.repeat(80));
  console.log(`\n📊 累计总额: ${ethers.formatUnits(cumulativeTotal, 18)} USDT (${cumulativeTotal.toString()} wei)`);

  // 2. 分析：如果链上是200，说明只同步了前两条记录
  console.log(`\n🔍 分析:`);
  console.log('-'.repeat(80));
  
  const validRecords = allRecords.filter(r => {
    const minter = r.minterAddress.toLowerCase();
    const referrer = r.rootReferrerAddress?.toLowerCase() || '';
    return referrer !== '' && referrer !== null && minter !== referrer && referrer === normalizedAddr;
  });

  if (validRecords.length >= 2) {
    const firstTwoTotal = validRecords.slice(0, 2).reduce((sum, r) => {
      return sum + BigInt(r.referralRewardWei || '0');
    }, BigInt(0));
    
    console.log(`前 2 条记录总额: ${ethers.formatUnits(firstTwoTotal, 18)} USDT`);
    
    if (firstTwoTotal === BigInt('200000000000000000000')) {
      console.log(`✅ 链上的 200 USDT 对应前 2 条记录`);
      if (validRecords.length > 2) {
        const thirdRecord = validRecords[2];
        console.log(`\n⚠️  第 3 条记录（NFT ${thirdRecord.nftId}）还未同步:`);
        console.log(`   创建时间: ${thirdRecord.createdAt.toISOString()}`);
        console.log(`   返佣: ${ethers.formatUnits(BigInt(thirdRecord.referralRewardWei || '0'), 18)} USDT`);
        console.log(`\n💡 建议: 重新运行同步，应该会将链上值从 200 更新到 300 USDT`);
      }
    }
  }

  // 3. 检查是否有同步记录（如果有记录表的话）
  console.log(`\n📋 检查同步记录...`);
  try {
    // 检查是否有相关的同步日志或记录
    // 这里可以根据实际情况查询相关表
    console.log(`   (暂无同步记录表)`);
  } catch (e) {
    // 忽略
  }

  console.log('\n' + '='.repeat(80));
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/check-sync-history.ts <地址>');
  console.log('示例: npx ts-node scripts/check-sync-history.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  process.exit(1);
}

checkSyncHistory(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















