import { PrismaClient } from '@prisma/client';

/**
 * 迁移脚本：将返佣记录从根推荐人改为直接邀请人
 * 
 * 说明：
 * - 此脚本会更新所有现有的 ReferralRewardRecord
 * - 将 rootReferrerAddress 从根推荐人改为直接邀请人
 * - 直接邀请人：用户使用的邀请码的申请人地址
 * 
 * 运行方式：
 * npx ts-node scripts/migrate-to-direct-referrer.ts
 */

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 开始迁移返佣记录：从根推荐人改为直接邀请人...\n');

    // 1. 获取所有返佣记录
    const rewardRecords = await prisma.referralRewardRecord.findMany({
      select: {
        id: true,
        nftId: true,
        minterAddress: true,
        rootReferrerAddress: true,
        rootInviteCodeId: true,
      },
    });

    console.log(`📊 找到 ${rewardRecords.length} 条返佣记录\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. 处理每条记录
    for (const record of rewardRecords) {
      try {
        // 查找用户使用的邀请码（直接邀请码）
        const usage = await prisma.inviteCodeUsage.findFirst({
          where: {
            userAddress: record.minterAddress.toLowerCase(),
          },
          include: {
            inviteCode: true,
          },
          orderBy: {
            createdAt: 'desc', // 使用最近的邀请码
          },
        });

        if (!usage || !usage.inviteCode) {
          console.log(`⚠️  NFT #${record.nftId}: 未找到邀请码使用记录，跳过`);
          skippedCount++;
          continue;
        }

        // 直接邀请人是邀请码的申请人
        const directReferrerAddress = usage.inviteCode.applicantAddress?.toLowerCase() || null;
        const directInviteCodeId = usage.inviteCode.id;

        // 如果直接邀请人与当前记录相同，跳过
        if (directReferrerAddress === record.rootReferrerAddress?.toLowerCase() &&
            directInviteCodeId === record.rootInviteCodeId) {
          console.log(`ℹ️  NFT #${record.nftId}: 已经是直接邀请人，跳过`);
          skippedCount++;
          continue;
        }

        // 更新记录
        await prisma.referralRewardRecord.update({
          where: { id: record.id },
          data: {
            rootReferrerAddress: directReferrerAddress || record.minterAddress.toLowerCase(),
            rootInviteCodeId: directInviteCodeId,
          },
        });

        console.log(
          `✅ NFT #${record.nftId}: ` +
          `根推荐人 ${record.rootReferrerAddress || '无'} → ` +
          `直接邀请人 ${directReferrerAddress || record.minterAddress}`
        );
        updatedCount++;

      } catch (error: any) {
        console.error(`❌ NFT #${record.nftId}: 处理失败 - ${error.message}`);
        errorCount++;
      }
    }

    // 3. 输出统计
    console.log('\n📊 迁移完成统计：');
    console.log(`   ✅ 更新: ${updatedCount} 条`);
    console.log(`   ⏭️  跳过: ${skippedCount} 条`);
    console.log(`   ❌ 错误: ${errorCount} 条`);
    console.log(`   📝 总计: ${rewardRecords.length} 条\n`);

    if (errorCount > 0) {
      console.log('⚠️  有部分记录处理失败，请检查日志');
    } else {
      console.log('✅ 所有记录处理完成！');
    }

  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });



























