import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RewardsPublicController } from './rewards-public.controller';
import { RevenueService } from './revenue.service';
import { RevenueSchedulerService } from './revenue-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ContractModule } from '../contract/contract.module';
import { AuthModule } from '../auth/auth.module';
import { InviteCodesModule } from '../invite-codes/invite-codes.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [PrismaModule, ContractModule, AuthModule, InviteCodesModule, MetricsModule],
  controllers: [RevenueController, RewardsPublicController],
  providers: [RevenueService, RevenueSchedulerService],
  exports: [RevenueService],
})
export class RevenueModule {}

