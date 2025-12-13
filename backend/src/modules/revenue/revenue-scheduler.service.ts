import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RevenueService } from './revenue.service';

/**
 * Revenue Scheduler Service
 * Handles scheduled tasks for revenue and referral reward synchronization
 */
@Injectable()
export class RevenueSchedulerService {
  private readonly logger = new Logger(RevenueSchedulerService.name);
  private isRunning = false;

  constructor(private revenueService: RevenueService) {}

  /**
   * Hourly sync: Recalculate referral rewards from chain data and local invite code info
   * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, ...)
   * 
   * This ensures that re-reading NFTs from chain and invite codes from database
   * produces the same referral reward data (幂等性)
   */
  @Cron('0 * * * *', {
    name: 'syncReferralRewards',
    timeZone: 'Asia/Shanghai', // 可根据需要调整时区
  })
  async handleHourlySync() {
    if (this.isRunning) {
      this.logger.warn('⏸️  Previous sync is still running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting hourly referral reward sync from chain...');

      // Only sync missing/incorrect records (not full sync to avoid performance issues)
      const result = await this.revenueService.syncReferralRewardsFromChain(false);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Hourly sync completed in ${duration}ms: ` +
        `processed=${result.processed}, ` +
        `created=${result.created}, ` +
        `updated=${result.updated}, ` +
        `correct=${result.correct}, ` +
        `skipped=${result.skipped}, ` +
        `errors=${result.errors}`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Hourly sync failed after ${duration}ms: ${error.message}`,
        error.stack
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Daily full sync: Complete recalculation of all referral rewards
   * Runs every day at 2:00 AM
   * 
   * This performs a full sync to ensure all records are correct
   */
  @Cron('0 2 * * *', {
    name: 'fullSyncReferralRewards',
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyFullSync() {
    if (this.isRunning) {
      this.logger.warn('⏸️  Previous sync is still running, skipping daily full sync');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting daily full referral reward sync from chain...');

      // Full sync to ensure all records are correct
      const result = await this.revenueService.syncReferralRewardsFromChain(true);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Daily full sync completed in ${duration}ms: ` +
        `processed=${result.processed}, ` +
        `created=${result.created}, ` +
        `updated=${result.updated}, ` +
        `correct=${result.correct}, ` +
        `skipped=${result.skipped}, ` +
        `errors=${result.errors}`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Daily full sync failed after ${duration}ms: ${error.message}`,
        error.stack
      );
    } finally {
      this.isRunning = false;
    }
  }
}

