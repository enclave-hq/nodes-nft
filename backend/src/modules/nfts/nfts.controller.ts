import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { NftsService } from './nfts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/nfts')
@UseGuards(JwtAuthGuard)
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  // More specific routes must come before generic routes
  @Get('root/:rootInviteCodeId')
  async getNFTsByRootInviteCode(@Param('rootInviteCodeId', ParseIntPipe) rootInviteCodeId: number) {
    return this.nftsService.getNFTsByRootInviteCode(rootInviteCodeId);
  }

  @Get('user/:address')
  async getNFTsByUser(@Param('address') address: string) {
    return this.nftsService.getNFTsByUser(address);
  }

  @Get(':id/trace')
  async traceNFT(@Param('id', ParseIntPipe) id: number) {
    return this.nftsService.traceNFT(id);
  }

  /**
   * Check which NFTs need migration (pool not initialized)
   */
  @Get('migration/check')
  async checkNFTsNeedingMigration() {
    return this.nftsService.checkNFTsNeedingMigration();
  }

  /**
   * Migrate a single NFT to pool (set minter)
   */
  @Post('migration/:nftId')
  async migrateNFT(
    @Param('nftId', ParseIntPipe) nftId: number,
    @Body() body?: { minterAddress?: string },
  ) {
    return this.nftsService.migrateNFT(nftId, body?.minterAddress);
  }

  /**
   * Batch migrate multiple NFTs to pool
   */
  @Post('migration/batch')
  async batchMigrateNFTs(
    @Body() body: {
      migrations: Array<{ nftId: number; minterAddress?: string }>;
    },
  ) {
    return this.nftsService.batchMigrateNFTs(body.migrations);
  }
}

