import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ContractModule } from '../contract/contract.module';
import { AuthModule } from '../auth/auth.module';
import { InviteCodesModule } from '../invite-codes/invite-codes.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [PrismaModule, ContractModule, AuthModule, InviteCodesModule, MetricsModule],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}

