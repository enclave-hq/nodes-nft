import { Controller, Get, Post, Patch, Body, Param, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin/batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  async findAll() {
    try {
      return await this.batchesService.findAll();
    } catch (error: any) {
      console.error('❌ Error in BatchesController.findAll():', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to fetch batches',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Force sync batches from blockchain to database
   */
  @Post('sync')
  async syncFromChain() {
    try {
      const result = await this.batchesService.syncFromChain();
      return {
        success: true,
        message: `成功从链上同步 ${result.synced} 个批次`,
        ...result,
      };
    } catch (error: any) {
      console.error('❌ Error syncing batches from chain:', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to sync batches from chain',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createBatch(
    @Body() body: { maxMintable: string; mintPrice: string; referralReward?: string },
    @CurrentUser() adminAddress: string,
  ) {
    return this.batchesService.createBatch(
      BigInt(body.maxMintable),
      body.mintPrice,
      body.referralReward || null,
      adminAddress,
    );
  }

  @Patch(':batchId/activate')
  async activateBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() adminAddress: string,
  ) {
    return this.batchesService.activateBatch(BigInt(batchId), adminAddress);
  }
}

