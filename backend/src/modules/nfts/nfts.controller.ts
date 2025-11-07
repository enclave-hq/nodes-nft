import { Controller, Get, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { NftsService } from './nfts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/nfts')
@UseGuards(JwtAuthGuard)
export class NftsController {
  constructor(private readonly nftsService: NftsService) {}

  @Get(':id/trace')
  async traceNFT(@Param('id', ParseIntPipe) id: number) {
    return this.nftsService.traceNFT(id);
  }

  @Get('root/:rootInviteCodeId')
  async getNFTsByRootInviteCode(@Param('rootInviteCodeId', ParseIntPipe) rootInviteCodeId: number) {
    return this.nftsService.getNFTsByRootInviteCode(rootInviteCodeId);
  }

  @Get('user/:address')
  async getNFTsByUser(@Param('address') address: string) {
    return this.nftsService.getNFTsByUser(address);
  }
}

