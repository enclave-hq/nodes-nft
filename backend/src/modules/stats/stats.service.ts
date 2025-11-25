import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Get or update stats cache
   * @param key Cache key
   * @param value Cache value
   */
  private async updateStatsCache(key: string, value: number): Promise<void> {
    try {
      await this.prisma.statsCache.upsert({
        where: { key },
        update: { 
          value: JSON.stringify(value), 
          updatedAt: new Date() 
        },
        create: { 
          key, 
          value: JSON.stringify(value) 
        },
      });
    } catch (error: any) {
      // Silently fail, don't block main flow
      console.warn(`⚠️ Failed to update stats cache for ${key}:`, error.message);
    }
  }

  /**
   * Get stats cache
   * @param key Cache key
   * @returns Cached value or null
   */
  private async getStatsCache(key: string): Promise<number | null> {
    try {
      const cached = await this.prisma.statsCache.findUnique({
        where: { key },
      });
      if (cached) {
        return JSON.parse(cached.value as string);
      }
      return null;
    } catch (error: any) {
      console.warn(`⚠️ Failed to get stats cache for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Get overview statistics
   * @description 
   * - totalNFTs: Queries from contract (real-time, accurate)
   * - totalWhitelisted: Queries from contract (real-time, accurate)
   * - totalBatches/activeBatches: Queries from contract (real-time, accurate)
   * - Other stats: From database (metadata, history)
   */
  async getOverview() {
    try {
      // Query state data from contract (real-time, accurate)
      let totalNFTs = 0;
      let totalWhitelisted = 0;
      let totalBatches = 0;
      let activeBatches = 0;

      try {
        // Query totalNFTs from contract (real-time, accurate)
        totalNFTs = await this.contractService.getTotalMinted();
        // Update cache asynchronously (don't block response)
        this.updateStatsCache('totalNFTs', totalNFTs).catch(() => {});
      } catch (error: any) {
        console.warn('⚠️ Failed to query totalNFTs from contract, trying cache:', error.message);
        // Try cache first (more reliable than database)
        const cached = await this.getStatsCache('totalNFTs');
        if (cached !== null) {
          totalNFTs = cached;
          console.log('✅ Using cached totalNFTs:', totalNFTs);
        } else {
          // Last resort: database (may be outdated)
          console.warn('⚠️ No cache available, falling back to database (may be outdated)');
          totalNFTs = await this.prisma.nftRecord.count();
        }
      }

      try {
        // Query whitelist count from contract (real-time, accurate)
        const whitelistCount = await this.contractService.getWhitelistCount();
        totalWhitelisted = Number(whitelistCount);
        // Update cache asynchronously (don't block response)
        this.updateStatsCache('totalWhitelisted', totalWhitelisted).catch(() => {});
      } catch (error: any) {
        console.warn('⚠️ Failed to query whitelist count from contract, trying cache:', error.message);
        // Try cache first (more reliable than database)
        const cached = await this.getStatsCache('totalWhitelisted');
        if (cached !== null) {
          totalWhitelisted = cached;
          console.log('✅ Using cached totalWhitelisted:', totalWhitelisted);
        } else {
          // Last resort: database (may be outdated)
          console.warn('⚠️ No cache available, falling back to database (may be outdated)');
          totalWhitelisted = await this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT address) as count FROM whitelist_history WHERE action = 'add'
          `.then((result) => Number(result[0].count));
        }
      }

      try {
        // Query batches from contract (real-time, accurate)
        const contractBatches = await this.contractService.getAllBatches();
        totalBatches = contractBatches.length;
        activeBatches = contractBatches.filter(b => b.active).length;
        // Update cache asynchronously (don't block response)
        this.updateStatsCache('totalBatches', totalBatches).catch(() => {});
        this.updateStatsCache('activeBatches', activeBatches).catch(() => {});
      } catch (error: any) {
        console.warn('⚠️ Failed to query batches from contract, trying cache:', error.message);
        // Try cache first (more reliable than database)
        const cachedTotal = await this.getStatsCache('totalBatches');
        const cachedActive = await this.getStatsCache('activeBatches');
        if (cachedTotal !== null && cachedActive !== null) {
          totalBatches = cachedTotal;
          activeBatches = cachedActive;
          console.log('✅ Using cached batches:', { totalBatches, activeBatches });
        } else {
          // Last resort: database (may be outdated)
          console.warn('⚠️ No cache available, falling back to database (may be outdated)');
          totalBatches = await this.prisma.batch.count();
          activeBatches = await this.prisma.batch.count({ where: { active: true } });
        }
      }

      // Query metadata from database
      const [
        totalInviteCodes,
        activeInviteCodes,
      ] = await Promise.all([
        this.prisma.inviteCode.count(),
        this.prisma.inviteCode.count({ where: { status: 'active' } }),
      ]);

      // Return format matching frontend expectations
      return {
        totalUsers: totalWhitelisted, // Total users = whitelisted users
        totalNFTs: totalNFTs, // From contract (real-time)
        totalInviteCodes: totalInviteCodes,
        activeInviteCodes: activeInviteCodes,
        totalWhitelisted: totalWhitelisted, // From contract (real-time)
        whitelistedUsers: totalWhitelisted, // Alias for frontend compatibility
        totalBatches: totalBatches, // From contract (real-time)
        activeBatches: activeBatches, // From contract (real-time)
      };
    } catch (error: any) {
      console.error('❌ Error in StatsService.getOverview():', error);
      throw error;
    }
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

