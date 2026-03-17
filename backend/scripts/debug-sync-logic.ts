import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function debugSyncLogic(address: string) {
  const normalizedAddr = address.toLowerCase();

  console.log(`\n🔍 调试同步逻辑 - 地址 ${normalizedAddr}\n`);
  console.log('='.repeat(80));

  // 完全模拟 syncReferralRewardsToVault 的 SQL 查询
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

  console.log(`\n📊 SQL 查询结果总数: ${rows.length}`);
  console.log('-'.repeat(80));

  // 模拟 entitledMap 的构建过程
  const entitledMap = new Map<string, bigint>();
  for (const r of rows) {
    const addr = (r.address || '').toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      console.log(`⚠️  跳过无效地址: ${addr}`);
      continue;
    }
    const totalWeiStr = (r.totalWei ?? '0').toString();
    const integerPart = totalWeiStr.includes('.') ? totalWeiStr.split('.')[0] : totalWeiStr;
    const totalWei = BigInt(integerPart || '0');
    entitledMap.set(addr, totalWei);
    
    if (addr === normalizedAddr) {
      console.log(`\n✅ 找到目标地址:`);
      console.log(`   地址: ${addr}`);
      console.log(`   SQL 原始值: ${r.totalWei}`);
      console.log(`   处理后的值: ${totalWeiStr}`);
      console.log(`   整数部分: ${integerPart}`);
      console.log(`   BigInt 值: ${totalWei.toString()}`);
      console.log(`   USDT 值: ${ethers.formatUnits(totalWei, 18)}`);
    }
  }

  const targetTotal = entitledMap.get(normalizedAddr);
  if (targetTotal === undefined) {
    console.log(`\n❌ 未在 entitledMap 中找到地址 ${normalizedAddr}`);
    console.log(`\n📋 entitledMap 中的所有地址:`);
    for (const [addr, total] of entitledMap.entries()) {
      console.log(`   ${addr}: ${ethers.formatUnits(total, 18)} USDT`);
    }
  } else {
    console.log(`\n📊 entitledMap 中的值:`);
    console.log(`   总返佣: ${ethers.formatUnits(targetTotal, 18)} USDT`);
    console.log(`   总返佣 Wei: ${targetTotal.toString()}`);
  }

  // 检查所有相关记录
  console.log(`\n📝 检查所有相关记录:`);
  console.log('-'.repeat(80));
  const allRecords = await prisma.referralRewardRecord.findMany({
    where: {
      OR: [
        { rootReferrerAddress: { equals: normalizedAddr, mode: 'insensitive' } },
        { minterAddress: { equals: normalizedAddr, mode: 'insensitive' } },
      ],
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

  console.log(`总记录数: ${allRecords.length}`);
  console.log('-'.repeat(80));
  console.log('NFT ID | 铸造者 | 邀请者 | 返佣(USDT) | 返佣(Wei) | 是否匹配SQL条件');
  console.log('-'.repeat(80));

  let manualSum = BigInt(0);
  let matchingCount = 0;

  for (const record of allRecords) {
    const minter = record.minterAddress.toLowerCase();
    const referrer = record.rootReferrerAddress?.toLowerCase() || '';
    const rewardWei = BigInt(record.referralRewardWei || '0');
    
    // 检查是否匹配 SQL 条件
    const matchesSQL = 
      referrer !== '' &&
      referrer !== null &&
      minter !== referrer &&
      referrer === normalizedAddr;

    if (matchesSQL) {
      manualSum += rewardWei;
      matchingCount++;
    }

    const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
    const referrerShort = referrer ? `${referrer.slice(0, 6)}...${referrer.slice(-4)}` : 'NULL';
    const rewardUsdt = ethers.formatUnits(rewardWei, 18);

    console.log(
      `${String(record.nftId).padStart(6)} | ${minterShort.padEnd(8)} | ${referrerShort.padEnd(8)} | ${rewardUsdt.padEnd(11)} | ${record.referralRewardWei?.padEnd(20)} | ${matchesSQL ? '✅' : '❌'}`
    );
  }

  console.log('-'.repeat(80));
  console.log(`\n📊 手动计算结果:`);
  console.log(`   匹配 SQL 条件的记录数: ${matchingCount}`);
  console.log(`   手动累加的总返佣: ${ethers.formatUnits(manualSum, 18)} USDT`);
  console.log(`   手动累加的总返佣 Wei: ${manualSum.toString()}`);

  if (targetTotal !== undefined) {
    if (targetTotal === manualSum) {
      console.log(`\n✅ SQL 查询结果与手动计算结果一致`);
    } else {
      console.log(`\n❌ SQL 查询结果与手动计算结果不一致！`);
      console.log(`   SQL 结果: ${ethers.formatUnits(targetTotal, 18)} USDT (${targetTotal.toString()} wei)`);
      console.log(`   手动结果: ${ethers.formatUnits(manualSum, 18)} USDT (${manualSum.toString()} wei)`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/debug-sync-logic.ts <地址>');
  console.log('示例: npx ts-node scripts/debug-sync-logic.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  process.exit(1);
}

debugSyncLogic(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















