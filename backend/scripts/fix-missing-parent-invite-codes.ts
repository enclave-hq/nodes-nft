import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingParentInviteCodes() {
  try {
    console.log('🔍 检查并修复缺失的 parentInviteCodeId...\n');

    // 获取所有 parentInviteCodeId 为 null 的邀请码
    const codesWithoutParent = await prisma.inviteCode.findMany({
      where: {
        parentInviteCodeId: null,
      },
      select: {
        id: true,
        code: true,
        applicantAddress: true,
        createdAt: true,
      },
    });

    console.log(`📊 找到 ${codesWithoutParent.length} 个没有父邀请码的邀请码\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const code of codesWithoutParent) {
      // 查找该地址使用的邀请码（从 InviteCodeUsage 表）
      const usage = await prisma.inviteCodeUsage.findFirst({
        where: {
          userAddress: code.applicantAddress.toLowerCase(),
        },
        include: {
          inviteCode: {
            select: {
              id: true,
              code: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // 使用最早的使用记录
        },
      });

      if (usage && usage.inviteCode) {
        // 确保使用时间早于邀请码创建时间
        if (usage.createdAt < code.createdAt) {
          // 检查父邀请码状态是否有效
          if (usage.inviteCode.status === 'active' || usage.inviteCode.status === 'pending') {
            // 更新 parentInviteCodeId
            await prisma.inviteCode.update({
              where: { id: code.id },
              data: { parentInviteCodeId: usage.inviteCode.id },
            });

            console.log(`✅ 修复: ${code.code} (ID: ${code.id})`);
            console.log(`   设置父邀请码: ${usage.inviteCode.code} (ID: ${usage.inviteCode.id})`);
            console.log(`   使用时间: ${usage.createdAt.toISOString()}`);
            console.log(`   邀请码创建时间: ${code.createdAt.toISOString()}\n`);

            fixedCount++;
          } else {
            console.log(`⚠️  跳过: ${code.code} (ID: ${code.id})`);
            console.log(`   父邀请码 ${usage.inviteCode.code} 状态为 ${usage.inviteCode.status}，不是 active 或 pending\n`);
            skippedCount++;
          }
        } else {
          console.log(`⚠️  跳过: ${code.code} (ID: ${code.id})`);
          console.log(`   使用时间晚于邀请码创建时间，可能是数据异常\n`);
          skippedCount++;
        }
      } else {
        console.log(`ℹ️  跳过: ${code.code} (ID: ${code.id})`);
        console.log(`   未找到使用记录，可能是根节点\n`);
        skippedCount++;
      }
    }

    console.log('\n✨ 修复完成！');
    console.log(`   修复: ${fixedCount} 个`);
    console.log(`   跳过: ${skippedCount} 个`);
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingParentInviteCodes();



























