import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInviteCodeStats(inviteCode: string) {
  try {
    console.log(`\n🔍 检查邀请码 ${inviteCode} 的统计数据...\n`);

    // 1. 查找邀请码
    const inviteCodeRecord = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
      include: {
        parentInviteCode: true,
        children: true,
      },
    });

    if (!inviteCodeRecord) {
      console.log(`❌ 未找到邀请码 ${inviteCode}`);
      return;
    }

    console.log(`✅ 找到邀请码:`);
    console.log(`   ID: ${inviteCodeRecord.id}`);
    console.log(`   申请人地址: ${inviteCodeRecord.applicantAddress}`);
    console.log(`   状态: ${inviteCodeRecord.status}`);
    console.log(`   父邀请码: ${inviteCodeRecord.parentInviteCode?.code || '根节点'}`);
    console.log(`   子邀请码数量: ${inviteCodeRecord.children.length}`);

    // 2. 自身铸造数量（申请人地址铸造的NFT）
    const selfMintedCount = await prisma.nftRecord.count({
      where: {
        minterAddress: inviteCodeRecord.applicantAddress.toLowerCase(),
      },
    });
    console.log(`\n📊 自身铸造数量: ${selfMintedCount}`);

    // 3. 使用该邀请码铸造的NFT数量（下级铸造）
    const inviteCodeMintedCount = await prisma.nftRecord.count({
      where: {
        inviteCodeId: inviteCodeRecord.id,
      },
    });
    console.log(`📊 使用邀请码铸造数量（下级铸造）: ${inviteCodeMintedCount}`);

    // 4. 详细列出使用该邀请码的NFT
    const nftRecords = await prisma.nftRecord.findMany({
      where: {
        inviteCodeId: inviteCodeRecord.id,
      },
      include: {
        inviteCode: true,
      },
      orderBy: {
        nftId: 'asc',
      },
    });

    console.log(`\n📋 使用该邀请码的NFT列表（共 ${nftRecords.length} 个）:`);
    console.log('='.repeat(80));
    console.log('NFT ID | 铸造者地址 | 使用的邀请码 | 批次ID | 铸造时间');
    console.log('-'.repeat(80));

    for (const record of nftRecords) {
      const minterShort = `${record.minterAddress.slice(0, 6)}...${record.minterAddress.slice(-4)}`;
      const inviteCodeShort = record.inviteCode?.code || 'N/A';
      const batchId = record.batchId?.toString() || 'N/A';
      const mintedAt = record.mintedAt.toLocaleString('zh-CN');
      
      console.log(`${record.nftId.toString().padStart(6)} | ${minterShort.padEnd(15)} | ${inviteCodeShort.padEnd(12)} | ${batchId.padEnd(8)} | ${mintedAt}`);
    }

    // 5. 检查是否有NFT的铸造者地址等于申请人地址（应该算在自身铸造中）
    const selfMintedNFTs = nftRecords.filter(
      r => r.minterAddress.toLowerCase() === inviteCodeRecord.applicantAddress.toLowerCase()
    );
    if (selfMintedNFTs.length > 0) {
      console.log(`\n⚠️  注意：有 ${selfMintedNFTs.length} 个NFT的铸造者地址等于申请人地址，这些应该算在"自身铸造"中，而不是"下级铸造"`);
      console.log(`   NFT IDs: ${selfMintedNFTs.map(r => r.nftId).join(', ')}`);
    }

    // 6. 检查邀请码使用记录
    const inviteCodeUsages = await prisma.inviteCodeUsage.findMany({
      where: {
        inviteCodeId: inviteCodeRecord.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`\n👥 使用该邀请码的用户（共 ${inviteCodeUsages.length} 个）:`);
    console.log('='.repeat(80));
    console.log('用户地址 | 使用时间');
    console.log('-'.repeat(80));

    for (const usage of inviteCodeUsages) {
      const userShort = `${usage.userAddress.slice(0, 6)}...${usage.userAddress.slice(-4)}`;
      const usedAt = usage.createdAt.toLocaleString('zh-CN');
      console.log(`${userShort.padEnd(15)} | ${usedAt}`);
    }

    // 7. 返佣总量
    const referralRewards = await prisma.referralRewardRecord.findMany({
      where: {
        rootInviteCodeId: inviteCodeRecord.id,
      },
    });

    const totalReward = referralRewards.reduce((sum, r) => {
      return sum + parseFloat(r.referralReward || '0');
    }, 0);

    console.log(`\n💰 返佣总量: ${totalReward.toFixed(2)} USDT`);
    console.log(`   返佣记录数: ${referralRewards.length}`);

    // 8. 检查子邀请码的统计
    if (inviteCodeRecord.children.length > 0) {
      console.log(`\n🌳 子邀请码统计:`);
      for (const child of inviteCodeRecord.children) {
        const childMintedCount = await prisma.nftRecord.count({
          where: {
            inviteCodeId: child.id,
          },
        });
        console.log(`   ${child.code}: ${childMintedCount} 个NFT`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n总结:`);
    console.log(`  自身铸造: ${selfMintedCount}`);
    console.log(`  下级铸造: ${inviteCodeMintedCount}`);
    console.log(`  返佣总量: ${totalReward.toFixed(2)} USDT`);

  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// 从命令行参数获取邀请码
const inviteCode = process.argv[2];

if (!inviteCode) {
  console.log('用法: npx ts-node scripts/check-invite-code-stats.ts <邀请码>');
  console.log('示例: npx ts-node scripts/check-invite-code-stats.ts 2Z4EE');
  process.exit(1);
}

checkInviteCodeStats(inviteCode.toUpperCase());

