import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function checkSQLDirectly(address: string) {
  const normalizedAddr = address.toLowerCase();

  console.log(`\n🔍 直接执行 SQL 查询 - 地址 ${normalizedAddr}\n`);
  console.log('='.repeat(80));

  // 使用完全相同的 SQL 查询
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

  console.log(`\n📊 SQL 查询结果:`);
  console.log(`   总记录数: ${rows.length}`);
  console.log('-'.repeat(80));

  for (const r of rows) {
    const addr = (r.address || '').toLowerCase();
    if (addr === normalizedAddr) {
      const totalWeiStr = (r.totalWei ?? '0').toString();
      const integerPart = totalWeiStr.includes('.') ? totalWeiStr.split('.')[0] : totalWeiStr;
      const totalWei = BigInt(integerPart || '0');
      
      console.log(`✅ 找到目标地址:`);
      console.log(`   地址: ${addr}`);
      console.log(`   SQL 原始值: ${r.totalWei}`);
      console.log(`   处理后的值: ${totalWeiStr}`);
      console.log(`   整数部分: ${integerPart}`);
      console.log(`   BigInt 值: ${totalWei.toString()}`);
      console.log(`   USDT 值: ${ethers.formatUnits(totalWei, 18)}`);
      
      // 检查是否是 200 还是 300
      if (totalWei === BigInt('200000000000000000000')) {
        console.log(`\n⚠️  查询结果是 200 USDT，但应该是 300 USDT！`);
        console.log(`   可能的原因：`);
        console.log(`   1. NFT 90 的返佣记录被排除了`);
        console.log(`   2. SQL 查询条件有问题`);
      } else if (totalWei === BigInt('300000000000000000000')) {
        console.log(`\n✅ 查询结果是 300 USDT（正确）`);
      }
      
      break;
    }
  }

  // 详细检查每条记录
  console.log(`\n📝 详细检查每条记录:`);
  console.log('-'.repeat(80));
  
  const allRecords = await prisma.referralRewardRecord.findMany({
    where: {
      rootReferrerAddress: {
        equals: normalizedAddr,
        mode: 'insensitive',
      },
    },
    select: {
      nftId: true,
      minterAddress: true,
      rootReferrerAddress: true,
      referralRewardWei: true,
    },
    orderBy: {
      nftId: 'asc',
    },
  });

  console.log(`总记录数: ${allRecords.length}`);
  console.log('-'.repeat(80));
  console.log('NFT ID | 铸造者 | 邀请者 | 返佣(Wei) | 是否匹配SQL条件');
  console.log('-'.repeat(80));

  let matchingCount = 0;
  let totalMatching = BigInt(0);

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
      matchingCount++;
      totalMatching += rewardWei;
    }

    const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
    const referrerShort = referrer ? `${referrer.slice(0, 6)}...${referrer.slice(-4)}` : 'NULL';

    console.log(
      `${String(record.nftId).padStart(6)} | ${minterShort.padEnd(8)} | ${referrerShort.padEnd(8)} | ${record.referralRewardWei?.padEnd(20)} | ${matchesSQL ? '✅' : '❌'}`
    );
  }

  console.log('-'.repeat(80));
  console.log(`\n📊 匹配 SQL 条件的记录:`);
  console.log(`   记录数: ${matchingCount}`);
  console.log(`   总返佣: ${ethers.formatUnits(totalMatching, 18)} USDT (${totalMatching.toString()} wei)`);

  if (totalMatching === BigInt('200000000000000000000')) {
    console.log(`\n⚠️  只有 200 USDT，说明 NFT 90 的记录被排除了！`);
    const nft90 = allRecords.find(r => r.nftId === 90);
    if (nft90) {
      console.log(`\n🔍 NFT 90 的记录详情:`);
      console.log(`   铸造者: ${nft90.minterAddress}`);
      console.log(`   邀请者: ${nft90.rootReferrerAddress}`);
      const minter = nft90.minterAddress.toLowerCase();
      const referrer = nft90.rootReferrerAddress?.toLowerCase() || '';
      console.log(`   是否自返佣: ${minter === referrer ? '是' : '否'}`);
      console.log(`   邀请者是否为空: ${!referrer || referrer === '' ? '是' : '否'}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/check-sql-directly.ts <地址>');
  console.log('示例: npx ts-node scripts/check-sql-directly.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  process.exit(1);
}

checkSQLDirectly(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















