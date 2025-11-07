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
   * Get all batches
   */
  async findAll() {
    return this.prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create new batch (call contract)
   */
  async createBatch(
    maxMintable: bigint,
    mintPrice: string,
    adminAddress: string,
  ) {
    // Call contract createBatch
    const mintPriceBigInt = BigInt(mintPrice);
    const txHash = await this.contractService.createBatch(maxMintable, mintPriceBigInt);

    // Get batch ID from contract event or return value
    const batchId = await this.getLatestBatchId();

    // Save to database
    const batch = await this.prisma.batch.create({
      data: {
        batchId: BigInt(batchId),
        maxMintable,
        mintPrice,
        active: false,
      },
    });

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress,
        actionType: 'batch_create',
        actionData: { batchId, maxMintable: maxMintable.toString(), mintPrice },
        txHash,
      },
    });

    return batch;
  }

  /**
   * Activate batch (call contract)
   */
  async activateBatch(batchId: bigint, adminAddress: string) {
    // Call contract activateBatch
    const txHash = await this.contractService.activateBatch(batchId);

    // Update database
    await this.prisma.batch.updateMany({
      where: { batchId },
      data: {
        active: true,
        activatedAt: new Date(),
      },
    });

    // Deactivate other batches
    await this.prisma.batch.updateMany({
      where: {
        batchId: { not: batchId },
        active: true,
      },
      data: {
        active: false,
        deactivatedAt: new Date(),
      },
    });

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress,
        actionType: 'batch_activate',
        actionData: { batchId: batchId.toString() },
        txHash,
      },
    });

    return { success: true, txHash };
  }

  private async getLatestBatchId(): Promise<number> {
    // Get from contract or database
    const latest = await this.prisma.batch.findFirst({
      orderBy: { batchId: 'desc' },
    });
    return latest ? Number(latest.batchId) + 1 : 1;
  }
}

