import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { TransferUsdtDto, GetRevenueDetailsDto, GetReferralRewardDetailsDto } from './dto/revenue.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/revenue')
@UseGuards(JwtAuthGuard)
export class RevenueController {
  constructor(
    private revenueService: RevenueService,
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get total revenue
   */
  @Get('total')
  async getTotalRevenue() {
    return await this.revenueService.getTotalRevenue();
  }

  /**
   * Get revenue details (paginated)
   */
  @Get('details')
  async getRevenueDetails(@Query() query: GetRevenueDetailsDto) {
    return await this.revenueService.getRevenueDetails(
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get total referral rewards
   */
  @Get('referral-rewards/total')
  async getTotalReferralRewards() {
    return await this.revenueService.getTotalReferralRewards();
  }

  /**
   * Get referral reward details (paginated)
   */
  @Get('referral-rewards/details')
  async getReferralRewardDetails(@Query() query: GetReferralRewardDetailsDto) {
    return await this.revenueService.getReferralRewardDetails(
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Get Treasury USDT balance
   */
  @Get('treasury-balance')
  async getTreasuryBalance() {
    return await this.revenueService.getTreasuryBalance();
  }

  /**
   * Get original minter address for an NFT
   * This address never changes, even if the NFT is transferred or sold
   */
  @Get('nft/:nftId/original-minter')
  async getOriginalMinter(@Param('nftId') nftId: string) {
    const nftIdNum = parseInt(nftId, 10);
    if (isNaN(nftIdNum)) {
      throw new BadRequestException('Invalid NFT ID');
    }

    const minterAddress = await this.revenueService.getOriginalMinter(nftIdNum);
    
    if (!minterAddress) {
      throw new NotFoundException(`Original minter not found for NFT ID ${nftId}`);
    }

    return {
      nftId: nftIdNum,
      originalMinterAddress: minterAddress,
      note: 'This is the address that originally minted the NFT. It never changes, even if the NFT is transferred or sold.',
    };
  }

  /**
   * Get revenue statistics (total, withdrawn, available)
   */
  @Get('revenue-statistics')
  async getRevenueStatistics() {
    return await this.revenueService.getRevenueStatistics();
  }

  /**
   * Get referral reward statistics (total, distributed, distributable)
   */
  @Get('referral-reward-statistics')
  async getReferralRewardStatistics() {
    return await this.revenueService.getReferralRewardStatistics();
  }

  /**
   * Transfer USDT from Treasury to destination address
   * Requires password and TOTP verification
   * @deprecated Use transferReferralReward or transferRevenue instead
   */
  @Post('transfer')
  async transferUsdt(
    @Body() dto: TransferUsdtDto,
    @CurrentUser() username: string,
  ) {
    // Verify password
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Verify password
    const isPasswordValid = await this.authService.verifyPassword(
      dto.password,
      admin.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    // Verify TOTP if enabled
    if (admin.totpEnabled) {
      if (!admin.totpSecret) {
        throw new BadRequestException('TOTP not configured');
      }

      const isTotpValid = await this.authService.verifyTotp(
        dto.totpCode,
        admin.totpSecret,
      );

      if (!isTotpValid) {
        throw new BadRequestException('Invalid TOTP code');
      }
    }

    // Transfer USDT
    const txHash = await this.revenueService.transferUsdt(dto.to, dto.amount);

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress: username,
        actionType: 'revenue_transfer',
        actionData: {
          to: dto.to,
          amount: dto.amount,
        },
        txHash,
      },
    });

    return {
      success: true,
      txHash,
      message: 'USDT transferred successfully',
    };
  }

  /**
   * Transfer referral reward (发放返佣)
   * Requires password and TOTP verification
   */
  @Post('transfer-referral-reward')
  async transferReferralReward(
    @Body() dto: TransferUsdtDto & { rootReferrerAddress: string; note?: string },
    @CurrentUser() username: string,
  ) {
    // Verify password
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Verify password
    const isPasswordValid = await this.authService.verifyPassword(
      dto.password,
      admin.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    // Verify TOTP if enabled
    if (admin.totpEnabled) {
      if (!admin.totpSecret) {
        throw new BadRequestException('TOTP not configured');
      }

      const isTotpValid = await this.authService.verifyTotp(
        dto.totpCode,
        admin.totpSecret,
      );

      if (!isTotpValid) {
        throw new BadRequestException('Invalid TOTP code');
      }
    }

    if (!dto.rootReferrerAddress) {
      throw new BadRequestException('rootReferrerAddress is required');
    }

    // Transfer USDT
    const txHash = await this.revenueService.transferUsdt(dto.to, dto.amount);

    // Record referral reward distribution
    await this.revenueService.recordReferralRewardDistribution(
      dto.rootReferrerAddress,
      dto.amount,
      dto.to,
      txHash,
      username,
      dto.note,
    );

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress: username,
        actionType: 'referral_reward_distribution',
        actionData: {
          rootReferrerAddress: dto.rootReferrerAddress,
          to: dto.to,
          amount: dto.amount,
          note: dto.note,
        },
        txHash,
      },
    });

    return {
      success: true,
      txHash,
      message: 'Referral reward distributed successfully',
    };
  }

  /**
   * Transfer revenue/profit (提取收益)
   * Requires password and TOTP verification
   */
  @Post('transfer-revenue')
  async transferRevenue(
    @Body() dto: TransferUsdtDto & { note?: string },
    @CurrentUser() username: string,
  ) {
    // Verify password
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found');
    }

    // Verify password
    const isPasswordValid = await this.authService.verifyPassword(
      dto.password,
      admin.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    // Verify TOTP if enabled
    if (admin.totpEnabled) {
      if (!admin.totpSecret) {
        throw new BadRequestException('TOTP not configured');
      }

      const isTotpValid = await this.authService.verifyTotp(
        dto.totpCode,
        admin.totpSecret,
      );

      if (!isTotpValid) {
        throw new BadRequestException('Invalid TOTP code');
      }
    }

    // Transfer USDT
    const txHash = await this.revenueService.transferUsdt(dto.to, dto.amount);

    // Record revenue withdrawal
    await this.revenueService.recordRevenueWithdrawal(
      dto.amount,
      dto.to,
      txHash,
      username,
      dto.note,
    );

    // Log admin operation
    await this.prisma.adminLog.create({
      data: {
        adminAddress: username,
        actionType: 'revenue_withdrawal',
        actionData: {
          to: dto.to,
          amount: dto.amount,
          note: dto.note,
        },
        txHash,
      },
    });

    return {
      success: true,
      txHash,
      message: 'Revenue withdrawn successfully',
    };
  }

  /**
   * Refresh NFT records from chain
   * @param fullRefresh If true, re-read all NFTs; if false, only read new ones
   */
  @Post('refresh-nfts')
  async refreshNftRecords(@Body() body: { fullRefresh?: boolean }) {
    const result = await this.revenueService.refreshNftRecords(body.fullRefresh || false);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get NFTs that don't have referral reward records yet
   */
  @Get('nfts-without-referral-rewards')
  async getNftsWithoutReferralRewards(@Query() query: GetRevenueDetailsDto) {
    return await this.revenueService.getNftsWithoutReferralRewards(
      query.page || 1,
      query.limit || 20,
    );
  }

  /**
   * Create referral reward record for a specific NFT
   */
  @Post('create-referral-reward/:nftId')
  async createReferralRewardForNft(@Param('nftId') nftId: string) {
    const nftIdNum = parseInt(nftId, 10);
    if (isNaN(nftIdNum)) {
      throw new BadRequestException('Invalid NFT ID');
    }

    await this.revenueService.createReferralRewardForNft(nftIdNum);
    return {
      success: true,
      message: `Referral reward record created for NFT ${nftIdNum}`,
    };
  }

  /**
   * Batch create referral reward records for all NFTs without them
   */
  @Post('batch-create-referral-rewards')
  async batchCreateReferralRewards() {
    const result = await this.revenueService.batchCreateReferralRewards();
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get distributable referral rewards by root address
   */
  @Get('distributable-referral-rewards')
  async getDistributableReferralRewards() {
    const rewards = await this.revenueService.getDistributableReferralRewards();
    return {
      success: true,
      rewards,
    };
  }

  /**
   * Handle NFT mint callback from frontend (public endpoint)
   * Called after NFT is successfully minted to:
   * 1. Read contract Manager information
   * 2. Generate referral reward records
   * 3. Activate invite codes
   */
  @Post('nft-mint-callback')
  @Public()
  async handleNftMintCallback(
    @Body() body: {
      nftId: number;
      minterAddress: string;
      mintTxHash: string;
      batchId?: string; // Optional, will be inferred if not provided
    },
  ) {
    const { nftId, minterAddress, mintTxHash, batchId } = body;

    if (!nftId || !minterAddress || !mintTxHash) {
      throw new BadRequestException('Missing required fields: nftId, minterAddress, mintTxHash');
    }

    const batchIdBigInt = batchId ? BigInt(batchId) : undefined;

    const result = await this.revenueService.handleNftMintCallback(
      nftId,
      minterAddress,
      mintTxHash,
      batchIdBigInt,
    );

    return {
      success: true,
      ...result,
    };
  }
}

