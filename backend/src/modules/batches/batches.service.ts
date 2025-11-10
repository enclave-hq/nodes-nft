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
   */
  async findAll() {
    // Read directly from contract
    const contractBatches = await this.contractService.getAllBatches();
    
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
    return contractBatches.map(batch => ({
      batchId: batch.batchId.toString(),
      maxMintable: batch.maxMintable.toString(),
      currentMinted: batch.currentMinted.toString(),
      mintPrice: batch.mintPrice.toString(),
      referralReward: referralRewardMap.get(batch.batchId.toString()) || null,
      active: batch.active,
      createdAt: new Date(Number(batch.createdAt) * 1000).toISOString(),
    }));
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

