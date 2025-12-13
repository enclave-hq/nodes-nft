import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InviteCodeRelation {
  id: number;
  code: string;
  applicantAddress: string;
  level: number;
  parentInviteCodeId: number | null;
  parentCode: string | null;
  rootInviteCodeId: number | null;
  rootCode: string | null;
  status: string;
  usageCount: number;
  createdAt: Date;
  children?: InviteCodeRelation[];
}

async function queryInviteRelations() {
  try {
    console.log('🔍 查询邀请码层级关系...\n');

    // 1. 查询所有邀请码及其层级信息
    const inviteCodes = await prisma.inviteCode.findMany({
      include: {
        parentInviteCode: {
          select: { id: true, code: true },
        },
        rootInviteCode: {
          select: { id: true, code: true },
        },
      },
      orderBy: [
        { level: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    console.log('📊 邀请码列表（按层级排序）：');
    console.log('='.repeat(100));
    console.log(
      'ID'.padEnd(6),
      'Code'.padEnd(15),
      '申请人地址'.padEnd(44),
      'Level'.padEnd(6),
      '父邀请码'.padEnd(15),
      '根邀请码'.padEnd(15),
      'Status'.padEnd(10),
      '使用次数'.padEnd(8),
      '创建时间'
    );
    console.log('-'.repeat(100));

    for (const ic of inviteCodes) {
      console.log(
        String(ic.id).padEnd(6),
        ic.code.padEnd(15),
        ic.applicantAddress.padEnd(44),
        String(ic.level).padEnd(6),
        (ic.parentInviteCode?.code || '-').padEnd(15),
        (ic.rootInviteCode?.code || '-').padEnd(15),
        ic.status.padEnd(10),
        String(ic.usageCount).padEnd(8),
        ic.createdAt.toISOString().split('T')[0]
      );
    }

    console.log('\n');

    // 2. 查询邀请码使用记录
    const usages = await prisma.inviteCodeUsage.findMany({
      include: {
        inviteCode: {
          select: { id: true, code: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('📝 邀请码使用记录：');
    console.log('='.repeat(80));
    console.log(
      'ID'.padEnd(6),
      '用户地址'.padEnd(44),
      '使用的邀请码'.padEnd(15),
      '使用时间'
    );
    console.log('-'.repeat(80));

    for (const usage of usages) {
      console.log(
        String(usage.id).padEnd(6),
        usage.userAddress.padEnd(44),
        usage.inviteCode.code.padEnd(15),
        usage.createdAt.toISOString().split('T')[0]
      );
    }

    console.log('\n');

    // 3. 查询邀请码申请记录
    const requests = await prisma.inviteCodeRequest.findMany({
      include: {
        referrerInviteCode: {
          select: { id: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    console.log('📋 邀请码申请记录（最近50条）：');
    console.log('='.repeat(100));
    console.log(
      'ID'.padEnd(6),
      '申请人地址'.padEnd(44),
      '推荐人邀请码'.padEnd(15),
      'Status'.padEnd(15),
      '自动审核'.padEnd(8),
      '创建时间'
    );
    console.log('-'.repeat(100));

    for (const req of requests) {
      console.log(
        String(req.id).padEnd(6),
        req.applicantAddress.padEnd(44),
        (req.referrerInviteCode?.code || '-').padEnd(15),
        req.status.padEnd(15),
        (req.autoApproved ? '是' : '否').padEnd(8),
        req.createdAt.toISOString().split('T')[0]
      );
    }

    console.log('\n');

    // 4. 构建邀请码树状结构
    console.log('🌳 邀请码树状结构：');
    console.log('='.repeat(80));

    // 找出所有根邀请码（level=1 或没有父邀请码）
    const rootCodes = inviteCodes.filter(
      (ic) => ic.level === 1 || !ic.parentInviteCodeId
    );

    function buildTree(parentId: number | null, level: number = 0): void {
      const children = inviteCodes.filter(
        (ic) => ic.parentInviteCodeId === parentId
      );

      for (const child of children) {
        const indent = '  '.repeat(level);
        const statusIcon =
          child.status === 'active'
            ? '✅'
            : child.status === 'pending'
            ? '⏳'
            : '❌';
        console.log(
          `${indent}${statusIcon} [${child.code}] (ID:${child.id}, Level:${child.level}) - ${child.applicantAddress.slice(0, 10)}... (使用:${child.usageCount}次)`
        );
        buildTree(child.id, level + 1);
      }
    }

    for (const root of rootCodes) {
      const statusIcon =
        root.status === 'active'
          ? '✅'
          : root.status === 'pending'
          ? '⏳'
          : '❌';
      console.log(
        `${statusIcon} [${root.code}] (ID:${root.id}, Level:${root.level}) - ${root.applicantAddress.slice(0, 10)}... (使用:${root.usageCount}次)`
      );
      buildTree(root.id, 1);
    }

    console.log('\n');

    // 5. 统计信息
    const stats = {
      total: inviteCodes.length,
      active: inviteCodes.filter((ic) => ic.status === 'active').length,
      pending: inviteCodes.filter((ic) => ic.status === 'pending').length,
      revoked: inviteCodes.filter((ic) => ic.status === 'revoked').length,
      level1: inviteCodes.filter((ic) => ic.level === 1).length,
      level2: inviteCodes.filter((ic) => ic.level === 2).length,
      level3Plus: inviteCodes.filter((ic) => ic.level >= 3).length,
      totalUsage: usages.length,
    };

    console.log('📈 统计信息：');
    console.log('='.repeat(50));
    console.log(`总邀请码数: ${stats.total}`);
    console.log(`  激活: ${stats.active}`);
    console.log(`  待激活: ${stats.pending}`);
    console.log(`  已撤销: ${stats.revoked}`);
    console.log(`层级分布:`);
    console.log(`  Level 1 (顶号): ${stats.level1}`);
    console.log(`  Level 2: ${stats.level2}`);
    console.log(`  Level 3+: ${stats.level3Plus}`);
    console.log(`总使用次数: ${stats.totalUsage}`);
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryInviteRelations();

