import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin/batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  async findAll() {
    return this.batchesService.findAll();
  }

  @Post()
  async createBatch(
    @Body() body: { maxMintable: string; mintPrice: string },
    @CurrentUser() adminAddress: string,
  ) {
    return this.batchesService.createBatch(
      BigInt(body.maxMintable),
      body.mintPrice,
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

