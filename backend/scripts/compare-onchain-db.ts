import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function compareOnchainDb(address: string) {
  const normalizedAddr = address.toLowerCase();
  const REWARD_VAULT_ADDRESS = process.env.REWARD_VAULT_ADDRESS;

  if (!REWARD_VAULT_ADDRESS) {
    console.log('❌ 错误: 未设置 REWARD_VAULT_ADDRESS 环境变量');
    process.exit(1);
  }

  console.log(`\n🔍 对比链上和数据库的值 - 地址 ${normalizedAddr}\n`);
  console.log('='.repeat(80));
  console.log(`RewardVault 地址: ${REWARD_VAULT_ADDRESS}`);
  console.log('='.repeat(80));

  // 1. 查询链上的值
  console.log('\n📡 查询链上的值...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://bsc-dataseed1.binance.org/');
    const rewardVaultAbi = [
      'function totalAllocated(address) view returns (uint256)',
      'function getRewardState(address) view returns (uint256 allocated, uint256 withdrawn, uint256 available)',
    ];
    const vault = new ethers.Contract(REWARD_VAULT_ADDRESS, rewardVaultAbi, provider);

    const [allocated, withdrawn, available] = await vault.getRewardState(normalizedAddr);
    const totalAllocated = await vault.totalAllocated(normalizedAddr);

    console.log(`   总分配量 (totalAllocated): ${ethers.formatUnits(totalAllocated, 18)} USDT`);
    console.log(`   总分配量 (Wei): ${totalAllocated.toString()}`);
    console.log(`   已提取量: ${ethers.formatUnits(withdrawn, 18)} USDT`);
    console.log(`   可提取量: ${ethers.formatUnits(available, 18)} USDT`);

    // 2. 查询数据库的值（使用同步逻辑的 SQL）
    console.log('\n🗄️  查询数据库的值（使用同步逻辑的 SQL）...');
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

    let dbTotalWei = BigInt(0);
    for (const r of rows) {
      const addr = (r.address || '').toLowerCase();
      if (addr === normalizedAddr) {
        const totalWeiStr = (r.totalWei ?? '0').toString();
        const integerPart = totalWeiStr.includes('.') ? totalWeiStr.split('.')[0] : totalWeiStr;
        dbTotalWei = BigInt(integerPart || '0');
        console.log(`   SQL 原始值: ${r.totalWei}`);
        console.log(`   处理后的值: ${totalWeiStr}`);
        console.log(`   整数部分: ${integerPart}`);
        break;
      }
    }

    if (dbTotalWei === BigInt(0)) {
      console.log(`   ⚠️  未在 SQL 查询结果中找到该地址`);
      console.log(`   SQL 查询结果中的地址列表:`);
      for (const r of rows) {
        console.log(`     - ${r.address}`);
      }
    } else {
      console.log(`   数据库总返佣: ${ethers.formatUnits(dbTotalWei, 18)} USDT`);
      console.log(`   数据库总返佣 (Wei): ${dbTotalWei.toString()}`);
    }

    // 3. 对比结果
    console.log('\n📊 对比结果:');
    console.log('='.repeat(80));
    const onchainWei = BigInt(totalAllocated.toString());
    
    if (dbTotalWei === BigInt(0)) {
      console.log('❌ 数据库查询结果为空，无法对比');
    } else if (onchainWei === dbTotalWei) {
      console.log(`✅ 链上和数据库的值一致: ${ethers.formatUnits(onchainWei, 18)} USDT`);
    } else {
      console.log(`❌ 链上和数据库的值不一致！`);
      console.log(`   链上值: ${ethers.formatUnits(onchainWei, 18)} USDT (${onchainWei.toString()} wei)`);
      console.log(`   数据库值: ${ethers.formatUnits(dbTotalWei, 18)} USDT (${dbTotalWei.toString()} wei)`);
      
      if (dbTotalWei > onchainWei) {
        const diff = dbTotalWei - onchainWei;
        console.log(`\n💡 需要同步: 数据库比链上多 ${ethers.formatUnits(diff, 18)} USDT`);
        console.log(`   应该更新链上值从 ${ethers.formatUnits(onchainWei, 18)} 到 ${ethers.formatUnits(dbTotalWei, 18)} USDT`);
      } else {
        const diff = onchainWei - dbTotalWei;
        console.log(`\n⚠️  异常: 链上值比数据库值多 ${ethers.formatUnits(diff, 18)} USDT`);
        console.log(`   这可能表示链上已经更新，但数据库查询有问题`);
      }
    }

    // 4. 检查所有相关记录
    console.log('\n📝 数据库中的相关记录:');
    console.log('-'.repeat(80));
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
        nftId: 'asc',
      },
    });

    console.log(`总记录数: ${allRecords.length}`);
    console.log('-'.repeat(80));
    console.log('NFT ID | 铸造者 | 返佣(USDT) | 返佣(Wei) | 创建时间 | 是否匹配SQL条件');
    console.log('-'.repeat(80));

    let manualSum = BigInt(0);
    for (const record of allRecords) {
      const minter = record.minterAddress.toLowerCase();
      const referrer = record.rootReferrerAddress?.toLowerCase() || '';
      const rewardWei = BigInt(record.referralRewardWei || '0');
      
      const matchesSQL = 
        referrer !== '' &&
        referrer !== null &&
        minter !== referrer &&
        referrer === normalizedAddr;

      if (matchesSQL) {
        manualSum += rewardWei;
      }

      const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
      const rewardUsdt = ethers.formatUnits(rewardWei, 18);
      const createdAt = record.createdAt.toISOString().split('T')[0];

      console.log(
        `${String(record.nftId).padStart(6)} | ${minterShort.padEnd(8)} | ${rewardUsdt.padEnd(11)} | ${record.referralRewardWei?.padEnd(20)} | ${createdAt} | ${matchesSQL ? '✅' : '❌'}`
      );
    }

    console.log('-'.repeat(80));
    console.log(`手动累加: ${ethers.formatUnits(manualSum, 18)} USDT (${manualSum.toString()} wei)`);

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  }
}

// 从命令行参数获取地址
const address = process.argv[2];

if (!address) {
  console.log('用法: npx ts-node scripts/compare-onchain-db.ts <地址>');
  console.log('示例: npx ts-node scripts/compare-onchain-db.ts 0xc227f7134ed23ea02bf39404d96bbd0e44580037');
  console.log('\n需要设置环境变量:');
  console.log('  REWARD_VAULT_ADDRESS=0x...');
  console.log('  RPC_URL=https://bsc-dataseed1.binance.org/ (可选)');
  process.exit(1);
}

compareOnchainDb(address)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



















