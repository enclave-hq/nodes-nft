import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicateAddresses() {
  try {
    console.log('🔍 检查重复地址问题...\n');

    // 获取所有邀请码
    const allCodes = await prisma.inviteCode.findMany({
      select: {
        id: true,
        code: true,
        applicantAddress: true,
      },
    });

    // 获取所有使用记录
    const allUsages = await prisma.inviteCodeUsage.findMany({
      select: {
        id: true,
        inviteCodeId: true,
        userAddress: true,
      },
    });

    console.log(`📊 统计信息:`);
    console.log(`  邀请码总数: ${allCodes.length}`);
    console.log(`  使用记录总数: ${allUsages.length}\n`);

    // 检查是否有地址既在邀请码表中，又在使用记录中
    const applicantAddresses = new Set(
      allCodes.map(code => code.applicantAddress.toLowerCase().trim())
    );

    const duplicates: Array<{
      address: string;
      inviteCode: string;
      inviteCodeId: number;
      usageInviteCodeId: number;
    }> = [];

    for (const usage of allUsages) {
      const normalizedUserAddress = usage.userAddress.toLowerCase().trim();
      if (applicantAddresses.has(normalizedUserAddress)) {
        // 找到对应的邀请码
        const inviteCode = allCodes.find(
          code => code.applicantAddress.toLowerCase().trim() === normalizedUserAddress
        );
        if (inviteCode) {
          duplicates.push({
            address: normalizedUserAddress,
            inviteCode: inviteCode.code,
            inviteCodeId: inviteCode.id,
            usageInviteCodeId: usage.inviteCodeId,
          });
        }
      }
    }

    console.log(`⚠️  发现 ${duplicates.length} 个重复地址:\n`);
    duplicates.forEach((dup, index) => {
      console.log(`${index + 1}. 地址: ${dup.address}`);
      console.log(`   作为邀请码所有者: ${dup.inviteCode} (ID: ${dup.inviteCodeId})`);
      console.log(`   作为用户使用了邀请码: ID ${dup.usageInviteCodeId}`);
      console.log('');
    });

    // 检查地址格式问题
    console.log('\n📋 检查地址格式问题...\n');
    const formatIssues: Array<{
      type: 'inviteCode' | 'usage';
      id: number;
      address: string;
      normalized: string;
      hasSpaces: boolean;
      hasMixedCase: boolean;
    }> = [];

    allCodes.forEach(code => {
      const normalized = code.applicantAddress.toLowerCase().trim();
      const hasSpaces = code.applicantAddress !== code.applicantAddress.trim();
      const hasMixedCase = code.applicantAddress !== code.applicantAddress.toLowerCase() && 
                          code.applicantAddress !== code.applicantAddress.toUpperCase();
      if (hasSpaces || hasMixedCase) {
        formatIssues.push({
          type: 'inviteCode',
          id: code.id,
          address: code.applicantAddress,
          normalized,
          hasSpaces,
          hasMixedCase,
        });
      }
    });

    allUsages.forEach(usage => {
      const normalized = usage.userAddress.toLowerCase().trim();
      const hasSpaces = usage.userAddress !== usage.userAddress.trim();
      const hasMixedCase = usage.userAddress !== usage.userAddress.toLowerCase() && 
                          usage.userAddress !== usage.userAddress.toUpperCase();
      if (hasSpaces || hasMixedCase) {
        formatIssues.push({
          type: 'usage',
          id: usage.id,
          address: usage.userAddress,
          normalized,
          hasSpaces,
          hasMixedCase,
        });
      }
    });

    if (formatIssues.length > 0) {
      console.log(`⚠️  发现 ${formatIssues.length} 个地址格式问题:\n`);
      formatIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type === 'inviteCode' ? '邀请码' : '使用记录'} ID: ${issue.id}`);
        console.log(`   原始地址: "${issue.address}"`);
        console.log(`   规范化后: "${issue.normalized}"`);
        console.log(`   有空格: ${issue.hasSpaces}`);
        console.log(`   大小写混合: ${issue.hasMixedCase}`);
        console.log('');
      });
    } else {
      console.log('✅ 所有地址格式正常\n');
    }

    console.log('\n✨ 检查完成！');
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateAddresses();





