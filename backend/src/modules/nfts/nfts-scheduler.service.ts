import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NftsService } from './nfts.service';

/**
 * NFT Scheduler Service
 * Handles scheduled tasks for NFT synchronization from The Graph subgraph
 */
@Injectable()
export class NftsSchedulerService {
  private readonly logger = new Logger(NftsSchedulerService.name);
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private lastSyncResult: {
    totalEvents: number;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  } | null = null;

  constructor(private nftsService: NftsService) {}

  /**
   * Get sync status (last sync time and result)
   */
  getSyncStatus() {
    return {
      lastSyncTime: this.lastSyncTime ? this.lastSyncTime.toISOString() : null,
      lastSyncResult: this.lastSyncResult,
      nextSyncInSeconds: this.lastSyncTime 
        ? Math.max(0, 120 - Math.floor((Date.now() - this.lastSyncTime.getTime()) / 1000))
        : null,
    };
  }

  /**
   * Periodic sync: Sync NFTs from The Graph subgraph
   * Runs every 2 minutes
   * 
   * Since we're reading directly from The Graph subgraph (no RPC calls),
   * we can sync very frequently to keep data up-to-date
   */
  @Cron('*/2 * * * *', {
    name: 'syncNFTsFromSubgraph',
    timeZone: 'Asia/Shanghai',
  })
  async handlePeriodicSync() {
    if (this.isRunning) {
      this.logger.warn('⏸️  Previous NFT sync is still running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting periodic NFT sync from subgraph...');

      const result = await this.nftsService.syncNFTsFromSubgraph();

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();
      this.lastSyncResult = result;
      this.logger.log(
        `✅ Periodic NFT sync completed in ${duration}ms: ` +
        `totalEvents=${result.totalEvents}, ` +
        `synced=${result.synced}, ` +
        `created=${result.created}, ` +
        `updated=${result.updated}, ` +
        `errors=${result.errors}`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Periodic NFT sync failed after ${duration}ms: ${error.message}`,
        error.stack
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Daily sync: Full sync of all NFTs from subgraph
   * Runs every day at 3:00 AM
   * 
   * This performs a full sync to ensure all NFT records are correct
   */
  @Cron('0 3 * * *', {
    name: 'dailyFullSyncNFTs',
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyFullSync() {
    if (this.isRunning) {
      this.logger.warn('⏸️  Previous NFT sync is still running, skipping daily full sync');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('🔄 Starting daily full NFT sync from subgraph...');

      const result = await this.nftsService.syncNFTsFromSubgraph();

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Daily full NFT sync completed in ${duration}ms: ` +
        `totalEvents=${result.totalEvents}, ` +
        `synced=${result.synced}, ` +
        `created=${result.created}, ` +
        `updated=${result.updated}, ` +
        `errors=${result.errors}`
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Daily full NFT sync failed after ${duration}ms: ${error.message}`,
        error.stack
      );
    } finally {
      this.isRunning = false;
    }
  }
}

