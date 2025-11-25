import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class BatchesService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Get all batches (from contract + database for referralReward)
   * Automatically syncs batches from contract to database
   */
  async findAll() {
    try {
      // Read directly from contract (source of truth)
      const contractBatches = await this.contractService.getAllBatches();
      
      // Sync batches to database (ensure database has all batches)
      await this.syncBatchesFromContract(contractBatches);
      
      // Get referral rewards from database
      const dbBatches = await this.prisma.batch.findMany({
        select: {
          batchId: true,
          referralReward: true,
        },
      });
      
      // Create a map of batchId -> referralReward
      const referralRewardMap = new Map<string, string | null>();
      dbBatches.forEach(dbBatch => {
        referralRewardMap.set(dbBatch.batchId.toString(), dbBatch.referralReward);
      });
      
      // Convert BigInt fields to strings for JSON serialization
      return contractBatches.map(batch => {
        // Defensive checks for undefined values
        if (!batch || typeof batch.batchId === 'undefined') {
          console.warn('⚠️ Invalid batch data received, skipping:', batch);
          return null;
        }

        // Safely convert BigInt fields to strings
        const batchId = (batch.batchId !== undefined && batch.batchId !== null) 
          ? batch.batchId.toString() 
          : '0';
        const maxMintable = (batch.maxMintable !== undefined && batch.maxMintable !== null)
          ? batch.maxMintable.toString()
          : '0';
        const currentMinted = (batch.currentMinted !== undefined && batch.currentMinted !== null)
          ? batch.currentMinted.toString()
          : '0';
        const mintPrice = (batch.mintPrice !== undefined && batch.mintPrice !== null)
          ? batch.mintPrice.toString()
          : '0';
        const createdAt = (batch.createdAt !== undefined && batch.createdAt !== null)
          ? new Date(Number(batch.createdAt) * 1000).toISOString()
          : new Date().toISOString(); // Fallback to current time if undefined

        return {
          batchId,
          maxMintable,
          currentMinted,
          mintPrice,
          referralReward: referralRewardMap.get(batchId) || null,
          active: batch.active !== undefined ? batch.active : false,
          createdAt,
        };
      }).filter((batch): batch is NonNullable<typeof batch> => batch !== null); // Remove any null entries
    } catch (error: any) {
      console.error('❌ Error in BatchesService.findAll():', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      throw new Error(`Failed to fetch batches: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Force sync batches from blockchain to database
   * Returns sync statistics
   */
  async syncFromChain(): Promise<{ synced: number; chainBatches: number; dbBatches: number }> {
    try {
      console.log('🔄 Starting manual sync from blockchain...');
      
      // Get current batch ID from contract
      const currentBatchId = await this.contractService.getCurrentBatchId();
      console.log(`   Current batch ID on chain: ${currentBatchId}`);
      
      // Read all batches from contract
      const contractBatches = await this.contractService.getAllBatches();
      console.log(`   Found ${contractBatches.length} batches on chain`);
      
      // Sync to database
      let syncedCount = 0;
      for (const batch of contractBatches) {
        if (!batch || typeof batch.batchId === 'undefined') {
          continue;
        }

        const batchId = batch.batchId;
        const createdAt = batch.createdAt 
          ? new Date(Number(batch.createdAt) * 1000)
          : new Date();

        // Upsert batch to database
        await this.prisma.batch.upsert({
          where: { batchId },
          update: {
            maxMintable: batch.maxMintable,
            mintPrice: batch.mintPrice.toString(),
            currentMinted: batch.currentMinted,
            active: batch.active !== undefined ? batch.active : false,
            createdAt,
            activatedAt: batch.active ? createdAt : null,
          },
          create: {
            batchId,
            maxMintable: batch.maxMintable,
            mintPrice: batch.mintPrice.toString(),
            currentMinted: batch.currentMinted,
            active: batch.active !== undefined ? batch.active : false,
            createdAt,
            activatedAt: batch.active ? createdAt : null,
            referralReward: null,
          },
        });
        syncedCount++;
      }

      // Get count from database after sync
      const dbCount = await this.prisma.batch.count();
      
      console.log(`✅ Sync complete: ${syncedCount} batches synced, ${dbCount} total in database`);
      
      return {
        synced: syncedCount,
        chainBatches: contractBatches.length,
        dbBatches: dbCount,
      };
    } catch (error: any) {
      console.error('❌ Error syncing from chain:', error);
      throw new Error(`Failed to sync from chain: ${error.message}`);
    }
  }

  /**
   * Sync batches from contract to database
   * Ensures database has all batches from contract (for referralReward storage)
   */
  private async syncBatchesFromContract(contractBatches: any[]) {
    try {
      for (const batch of contractBatches) {
        if (!batch || typeof batch.batchId === 'undefined') {
          continue;
        }

        const batchId = batch.batchId;
        const createdAt = batch.createdAt 
          ? new Date(Number(batch.createdAt) * 1000)
          : new Date();

        // Upsert batch to database (preserve referralReward if exists)
        await this.prisma.batch.upsert({
          where: { batchId },
          update: {
            maxMintable: batch.maxMintable,
            mintPrice: batch.mintPrice.toString(),
            currentMinted: batch.currentMinted,
            active: batch.active !== undefined ? batch.active : false,
            createdAt,
            activatedAt: batch.active ? createdAt : null,
            // Don't update referralReward (it's only in database)
          },
          create: {
            batchId,
            maxMintable: batch.maxMintable,
            mintPrice: batch.mintPrice.toString(),
            currentMinted: batch.currentMinted,
            active: batch.active !== undefined ? batch.active : false,
            createdAt,
            activatedAt: batch.active ? createdAt : null,
            referralReward: null, // Will be set when batch is created via API
          },
        });
      }
    } catch (error: any) {
      // Log error but don't fail the request
      console.warn('⚠️ Failed to sync batches to database:', error.message);
    }
  }

  /**
   * Create new batch (call contract)
   */
  async createBatch(
    maxMintable: bigint,
    mintPrice: string,
    referralReward: string | null,
    adminAddress: string,
  ) {
    // Validate and log mintPrice
    const mintPriceBigInt = BigInt(mintPrice);
    console.log(`📝 Creating batch with:`);
    console.log(`   - maxMintable: ${maxMintable.toString()}`);
    console.log(`   - mintPrice (wei): ${mintPriceBigInt.toString()}`);
    console.log(`   - mintPrice (USDT, 18 decimals): ${Number(mintPriceBigInt) / 1e18}`);
    
    // Call contract createBatch
    const txHash = await this.contractService.createBatch(maxMintable, mintPriceBigInt);

    // Get batch ID from contract (read after transaction)
    const currentBatchId = await this.contractService.getCurrentBatchId();
    const batchId = currentBatchId - 1n; // The created batch ID

    // Read batch from contract to get actual state
    const contractBatch = await this.contractService.getBatch(batchId);

    // Save to database as history record (not as source of truth)
    // referralReward is only stored in database, not on-chain
    const batch = await this.prisma.batch.create({
      data: {
        batchId: batchId,
        maxMintable: contractBatch.maxMintable,
        mintPrice: contractBatch.mintPrice.toString(),
        referralReward: referralReward || null, // Store referral reward in USDT (only in database)
        currentMinted: contractBatch.currentMinted,
        active: contractBatch.active,
        createdAt: new Date(Number(contractBatch.createdAt) * 1000),
        activatedAt: contractBatch.active ? new Date(Number(contractBatch.createdAt) * 1000) : null,
      },
    });

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress,
        actionType: 'batch_create',
        actionData: { 
          batchId: batchId.toString(), 
          maxMintable: maxMintable.toString(), 
          mintPrice 
        },
        txHash,
      },
    });

    // Convert BigInt fields to strings for JSON serialization
    return {
      batchId: batch.batchId.toString(),
      maxMintable: batch.maxMintable.toString(),
      currentMinted: batch.currentMinted.toString(),
      mintPrice: batch.mintPrice,
      referralReward: batch.referralReward,
      active: batch.active,
      createdAt: batch.createdAt.toISOString(),
    };
  }

  /**
   * Activate batch (call contract)
   */
  async activateBatch(batchId: bigint, adminAddress: string) {
    // Call contract activateBatch
    const txHash = await this.contractService.activateBatch(batchId);

    // Read batch from contract to get actual state
    const contractBatch = await this.contractService.getBatch(batchId);

    // Update database as history record
    await this.prisma.batch.updateMany({
      where: { batchId },
      data: {
        active: contractBatch.active,
        activatedAt: contractBatch.active ? new Date() : null,
      },
    });

    // Log admin operation
    // adminAddress can be username (for username/password auth) or address (for wallet auth)
    await this.prisma.adminLog.create({
      data: {
        adminAddress: adminAddress || 'unknown',
        actionType: 'batch_activate',
        actionData: { batchId: batchId.toString() },
        txHash,
      },
    });

    return { success: true, txHash };
  }
}

