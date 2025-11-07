import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ContractModule } from './modules/contract/contract.module';
import { AuthModule } from './modules/auth/auth.module';
import { InviteCodesModule } from './modules/invite-codes/invite-codes.module';
import { UsersModule } from './modules/users/users.module';
import { NftsModule } from './modules/nfts/nfts.module';
import { WhitelistModule } from './modules/whitelist/whitelist.module';
import { BatchesModule } from './modules/batches/batches.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Database module
    PrismaModule,
    
    // Contract module (for blockchain interactions)
    ContractModule,
    
    // Feature modules
    AuthModule,
    InviteCodesModule,
    UsersModule,
    NftsModule,
    WhitelistModule,
    BatchesModule,
    StatsModule,
  ],
})
export class AppModule {}

