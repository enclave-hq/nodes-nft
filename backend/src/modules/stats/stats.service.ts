import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview statistics
   */
  async getOverview() {
    const [
      totalInviteCodes,
      activeInviteCodes,
      totalNFTs,
      totalWhitelisted,
      totalBatches,
      activeBatches,
    ] = await Promise.all([
      this.prisma.inviteCode.count(),
      this.prisma.inviteCode.count({ where: { status: 'active' } }),
      this.prisma.nftRecord.count(),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT address) as count FROM whitelist_history WHERE action = 'add'
      `.then((result) => Number(result[0].count)),
      this.prisma.batch.count(),
      this.prisma.batch.count({ where: { active: true } }),
    ]);

    // Return format matching frontend expectations
    return {
      totalUsers: totalWhitelisted, // Total users = whitelisted users
      totalNFTs: totalNFTs,
      totalInviteCodes: totalInviteCodes,
      activeInviteCodes: activeInviteCodes,
      totalWhitelisted: totalWhitelisted,
      whitelistedUsers: totalWhitelisted, // Alias for frontend compatibility
      totalBatches: totalBatches,
      activeBatches: activeBatches,
    };
  }

  /**
   * Get invite code statistics
   */
  async getInviteCodeStats() {
    const [
      stats,
      totalUsageCount,
      totalInviteCodes,
      activeInviteCodes,
    ] = await Promise.all([
      this.prisma.inviteCode.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.inviteCodeUsage.count(), // Total usage count
      this.prisma.inviteCode.count(),
      this.prisma.inviteCode.count({ where: { status: 'active' } }),
    ]);

    const byStatus = stats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const pendingCount = byStatus['pending'] || 0;
    const activeCount = byStatus['active'] || 0;
    const revokedCount = byStatus['revoked'] || 0;

    return {
      total: totalInviteCodes,
      active: activeInviteCodes,
      used: totalUsageCount, // Total number of times invite codes have been used
      pending: pendingCount,
      expired: 0, // Can be calculated if expiresAt is set and in the past
      byStatus,
      // Frontend-specific fields
      pendingCount,
      activeCount,
      totalUsageCount,
    };
  }
}

