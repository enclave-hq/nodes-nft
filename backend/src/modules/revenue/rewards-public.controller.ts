import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RevenueService } from './revenue.service';
import { ContractService } from '../contract/contract.service';

function normalizeAddress(addr: string): string {
  const a = (addr || '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) {
    throw new BadRequestException('Invalid address');
  }
  return a;
}

@Controller('rewards')
export class RewardsPublicController {
  constructor(
    private readonly revenueService: RevenueService,
    private readonly contractService: ContractService,
  ) {}

  /**
   * Referral reward records for a direct referrer (直接邀请者)
   * Note: in current schema, ReferralRewardRecord.rootReferrerAddress stores direct referrer address.
   */
  @Public()
  @Get('referral/records')
  async getReferralRecords(
    @Query('address') address: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeSelf') includeSelf?: string,
  ) {
    const normalized = normalizeAddress(address);
    const p = page ? Math.max(1, parseInt(page, 10)) : 1;
    const l = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;
    const includeSelfBool = includeSelf === 'true';
    return await this.revenueService.getReferralRecordsForDirectReferrer(normalized, p, l, includeSelfBool);
  }

  /**
   * On-chain RewardVault state for a user address.
   * Returns allocated/withdrawn/available in wei strings.
   */
  @Public()
  @Get('referral/vault-state')
  async getVaultState(@Query('address') address: string) {
    const normalized = normalizeAddress(address);
    return await this.contractService.getRewardVaultState(normalized);
  }
}


