import { Module } from '@nestjs/common';
import { NftsService } from './nfts.service';
import { NftsController } from './nfts.controller';
import { NftsSchedulerService } from './nfts-scheduler.service';
import { ContractModule } from '../contract/contract.module';
import { InviteCodesModule } from '../invite-codes/invite-codes.module';
import { RevenueModule } from '../revenue/revenue.module';

@Module({
  imports: [ContractModule, InviteCodesModule, RevenueModule],
  controllers: [NftsController],
  providers: [NftsService, NftsSchedulerService],
  exports: [NftsService],
})
export class NftsModule {}

