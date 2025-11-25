import { Controller, Get, Post, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ContractService } from './contract.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin/contract')
@UseGuards(JwtAuthGuard)
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get transfers enabled status
   */
  @Get('transfers-enabled')
  async getTransfersEnabled() {
    try {
      const enabled = await this.contractService.transfersEnabled();
      return {
        enabled,
      };
    } catch (error: any) {
      console.error('Error getting transfers enabled status:', error);
      throw new HttpException(
        `Failed to get transfers enabled status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set transfers enabled/disabled (only master can call)
   */
  @Post('transfers-enabled')
  async setTransfersEnabled(
    @Body() body: { enabled: boolean },
    @CurrentUser() adminAddress: string,
  ) {
    try {
      const txHash = await this.contractService.setTransfersEnabled(body.enabled);
      
      // Log admin operation
      await this.prisma.adminLog.create({
        data: {
          adminAddress: adminAddress || 'unknown',
          actionType: 'set_transfers_enabled',
          actionData: { enabled: body.enabled },
          txHash,
        },
      });

      // Wait for transaction confirmation
      await this.contractService.waitForTransaction(txHash);

      // Get updated status
      const enabled = await this.contractService.transfersEnabled();

      return {
        success: true,
        txHash,
        enabled,
      };
    } catch (error: any) {
      console.error('Error setting transfers enabled:', error);
      throw new HttpException(
        `Failed to set transfers enabled: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

