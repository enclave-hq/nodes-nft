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

    return {
      inviteCodes: {
        total: totalInviteCodes,
        active: activeInviteCodes,
      },
      nfts: {
        total: totalNFTs,
      },
      whitelist: {
        total: totalWhitelisted,
      },
      batches: {
        total: totalBatches,
        active: activeBatches,
      },
    };
  }

  /**
   * Get invite code statistics
   */
  async getInviteCodeStats() {
    const stats = await this.prisma.inviteCode.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      byStatus: stats.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
    };
  }
}

