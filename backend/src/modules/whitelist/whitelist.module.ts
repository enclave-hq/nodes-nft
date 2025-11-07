import { Module } from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { WhitelistController, PublicWhitelistController } from './whitelist.controller';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [ContractModule],
  controllers: [WhitelistController, PublicWhitelistController],
  providers: [WhitelistService],
  exports: [WhitelistService],
})
export class WhitelistModule {}

