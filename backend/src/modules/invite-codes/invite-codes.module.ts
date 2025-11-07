import { Module } from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';
import { InviteCodesController, PublicInviteCodesController } from './invite-codes.controller';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [ContractModule],
  controllers: [InviteCodesController, PublicInviteCodesController],
  providers: [InviteCodesService],
  exports: [InviteCodesService],
})
export class InviteCodesModule {}

