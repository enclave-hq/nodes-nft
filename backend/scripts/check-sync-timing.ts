import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function checkSyncTiming(address: string) {
  const normalizedAddr = address.toLowerCase();

  console.log(`\n🔍 检查同步时机问题 - 地址 ${normalizedAddr}\n`);
  console.log('='.repeat(80));

  // 1. 检查 NFT 90 的记录详情
  console.log('\n📝 检查 NFT 90 的记录:');
  console.log('-'.repeat(80));
  
  const nft90 = await prisma.nftRecord.findUnique({
    where: { nftId: 90 },
    include: {
      inviteCode: true,
    },
  });

  if (!nft90) {
    console.log('❌ NFT 90 的记录不存在于 nft_records 表');
  } else {
    console.log(`✅ NFT 90 记录存在:`);
    console.log(`   铸造者: ${nft90.minterAddress}`);
    console.log(`   所有者: ${nft90.ownerAddress}`);
    console.log(`   批次ID: ${nft90.batchId?.toString()}`);
    console.log(`   铸造时间: ${nft90.mintedAt}`);
    console.log(`   邀请码ID: ${nft90.inviteCodeId}`);
    console.log(`   创建时间: ${nft90.createdAt}`);
  }

  // 2. 检查 NFT 90 的返佣记录
  console.log('\n💰 检查 NFT 90 的返佣记录:');
  console.log('-'.repeat(80));
  
  const reward90 = await prisma.referralRewardRecord.findUnique({
    where: { nftId: 90 },
  });

  if (!reward90) {
    console.log('❌ NFT 90 的返佣记录不存在');
  } else {
    console.log(`✅ NFT 90 返佣记录存在:`);
    console.log(`   铸造者: ${reward90.minterAddress}`);
    console.log(`   邀请者: ${reward90.rootReferrerAddress}`);
    console.log(`   返佣: ${reward90.referralReward} USDT`);
    console.log(`   返佣 Wei: ${reward90.referralRewardWei}`);
    console.log(`   创建时间: ${reward90.createdAt}`);
  }

  // 3. 模拟同步时的 SQL 查询（完全相同的查询）
  console.log('\n🗄️  模拟同步时的 SQL 查询:');
  console.log('-'.repeat(80));
  
  const rows = await prisma.$queryRawUnsafe<Array<{ address: string; totalWei: string }>>(
    `
    SELECT
      lower("rootReferrerAddress") as "address",
      (SUM(("referralRewardWei")::numeric))::text as "totalWei"
    FROM "referral_reward_records"
    WHERE "rootReferrerAddress" IS NOT NULL
      AND "rootReferrerAddress" != ''
      AND lower("minterAddress") <> lower("rootReferrerAddress")
    GROUP BY lower("rootReferrerAddress")
    `
  );

  let foundTotal = BigInt(0);
  for (const r of rows) {
    const addr = (r.address || '').toLowerCase();
    if (addr === normalizedAddr) {
      const totalWeiStr = (r.totalWei ?? '0').toString();
      const integerPart = totalWeiStr.includes('.') ? totalWeiStr.split('.')[0] : totalWeiStr;
      foundTotal = BigInt(integerPart || '0');
      console.log(`✅ 找到地址: ${addr}`);
      console.log(`   SQL 原始值: ${r.totalWei}`);
      console.log(`   处理后的值: ${totalWeiStr}`);
      console.log(`   整数部分: ${integerPart}`);
      console.log(`   BigInt 值: ${foundTotal.toString()}`);
      console.log(`   USDT 值: ${ethers.formatUnits(foundTotal, 18)}`);
      break;
    }
  }

  if (foundTotal === BigInt(0)) {
    console.log(`❌ 未在 SQL 查询结果中找到该地址`);
    console.log(`\nSQL 查询结果中的所有地址:`);
    for (const r of rows) {
      console.log(`   - ${r.address}: ${ethers.formatUnits(BigInt(r.totalWei.includes('.') ? r.totalWei.split('.')[0] : r.totalWei), 18)} USDT`);
    }
  }

  // 4. 检查所有相关记录的创建时间
  console.log('\n📅 所有相关记录的创建时间:');
  console.log('-'.repeat(80));
  
  const allRewards = await prisma.referralRewardRecord.findMany({
    where: {
      rootReferrerAddress: {
        equals: normalizedAddr,
        mode: 'insensitive',
      },
    },
    select: {
      nftId: true,
      createdAt: true,
      referralRewardWei: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log('NFT ID | 返佣(USDT) | 创建时间');
  console.log('-'.repeat(80));
  for (const r of allRewards) {
    const rewardWei = BigInt(r.referralRewardWei || '0');
    console.log(`${String(r.nftId).padStart(6)} | ${ethers.formatUnits(rewardWei, 18).padEnd(11)} | ${r.createdAt.toISOString()}`);
  }

  // 5. 检查是否有时间差问题
  if (reward90 && nft90) {
    const timeDiff = reward90.createdAt.getTime() - nft90.createdAt.getTime();
    console.log(`\n⏱️  时间差分析:`);
    console.log(`   NFT 记录创建时间: ${nft90.createdAt.toISOString()}`);
    console.log(`   返佣记录创建时间: ${reward90.createdAt.toISOString()}`);
    console.log(`   时间差: ${timeDiff}ms (${(timeDiff / 1000).toFixed(2)}秒)`);
    
    if (timeDiff > 60000) { // 超过1分钟
      console.log(`\n⚠️  返佣记录创建时间比 NFT 记录晚 ${(timeDiff / 1000).toFixed(2)} 秒`);
      console.log(`   如果同步在返佣记录创建之前执行，就会查询不到这条记录`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/check-sync-timing.ts <地址>');
  console.log('示例: npx ts-node scripts/check-sync-timing.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  process.exit(1);
}

checkSyncTiming(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















