import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMissingReferrers() {
  try {
    console.log('🔍 查找缺少推荐人邀请码的申请记录...\n');

    // 查找所有已批准但缺少推荐人邀请码的申请
    const requestsWithoutReferrer = await prisma.inviteCodeRequest.findMany({
      where: {
        referrerInviteCodeId: null,
        status: { in: ['approved', 'pending', 'auto_approved'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📋 找到 ${requestsWithoutReferrer.length} 条缺少推荐人邀请码的申请记录\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const request of requestsWithoutReferrer) {
      // 查找用户使用的邀请码
      const usage = await prisma.inviteCodeUsage.findFirst({
        where: {
          userAddress: request.applicantAddress.toLowerCase(),
        },
        include: {
          inviteCode: true,
        },
        orderBy: {
          createdAt: 'asc', // 使用最早的使用记录
        },
      });

      if (usage && usage.inviteCode) {
        // 检查推荐人邀请码是否有效
        const referrerCode = await prisma.inviteCode.findUnique({
          where: { id: usage.inviteCode.id },
        });

        if (referrerCode && (referrerCode.status === 'active' || referrerCode.status === 'pending')) {
          // 更新申请记录
          await prisma.inviteCodeRequest.update({
            where: { id: request.id },
            data: {
              referrerInviteCodeId: usage.inviteCode.id,
            },
          });

          console.log(
            `✅ ID ${request.id}: ${request.applicantAddress.slice(0, 10)}... -> 推荐人: ${usage.inviteCode.code} (ID: ${usage.inviteCode.id})`
          );
          updatedCount++;

          // 如果申请还是 pending 状态，且现在有推荐人了，可以自动审核
          if (request.status === 'pending') {
            // 检查是否已经生成了邀请码
            const existingCode = await prisma.inviteCode.findFirst({
              where: {
                applicantAddress: request.applicantAddress.toLowerCase(),
                status: { in: ['pending', 'active'] },
              },
            });

            if (!existingCode) {
              console.log(`   ⚠️  申请 ID ${request.id} 还是 pending 状态，但已批准，可能需要手动审核或重新处理`);
            }
          }
        } else {
          console.log(
            `⚠️  ID ${request.id}: 找到推荐人邀请码 ${usage.inviteCode.code}，但状态为 ${referrerCode?.status || 'unknown'}，跳过`
          );
          skippedCount++;
        }
      } else {
        console.log(
          `ℹ️  ID ${request.id}: ${request.applicantAddress.slice(0, 10)}... -> 未找到使用记录（可能是顶号申请）`
        );
        skippedCount++;
      }
    }

    console.log(`\n📊 更新完成:`);
    console.log(`  ✅ 已更新: ${updatedCount} 条`);
    console.log(`  ⏭️  跳过: ${skippedCount} 条`);

    // 验证更新结果
    console.log('\n🔍 验证更新结果...');
    const stillMissing = await prisma.inviteCodeRequest.count({
      where: {
        referrerInviteCodeId: null,
        status: { in: ['approved', 'pending', 'auto_approved'] },
      },
    });

    console.log(`  仍有 ${stillMissing} 条申请记录缺少推荐人邀请码（可能是真正的顶号申请）`);
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateMissingReferrers();

