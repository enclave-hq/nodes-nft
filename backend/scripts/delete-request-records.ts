import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteRequestRecords() {
  const requestIds = [22, 21];

  try {
    console.log(`🗑️  准备删除申请记录 ID: ${requestIds.join(', ')}...\n`);

    // 先查询这些记录
    const requests = await prisma.inviteCodeRequest.findMany({
      where: {
        id: { in: requestIds },
      },
    });

    if (requests.length === 0) {
      console.log('❌ 未找到指定的申请记录');
      return;
    }

    console.log('📋 找到以下申请记录：');
    for (const req of requests) {
      console.log(`  - ID: ${req.id}, 申请人: ${req.applicantAddress}, 状态: ${req.status}`);
    }

    console.log('\n🗑️  正在删除...');

    // 删除记录
    const result = await prisma.inviteCodeRequest.deleteMany({
      where: {
        id: { in: requestIds },
      },
    });

    console.log(`✅ 成功删除 ${result.count} 条申请记录\n`);

    // 验证删除结果
    const remaining = await prisma.inviteCodeRequest.findMany({
      where: {
        id: { in: requestIds },
      },
    });

    if (remaining.length === 0) {
      console.log('✅ 验证：所有指定记录已成功删除');
    } else {
      console.log(`⚠️  警告：仍有 ${remaining.length} 条记录未删除`);
    }
  } catch (error) {
    console.error('❌ 删除失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteRequestRecords();

