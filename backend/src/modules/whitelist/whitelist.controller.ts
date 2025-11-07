import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('admin/whitelist')
@UseGuards(JwtAuthGuard)
export class WhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Get()
  async getWhitelist(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string,
  ) {
    return this.whitelistService.getWhitelist(
      parseInt(page),
      parseInt(limit),
      search,
    );
  }

  @Post()
  async addToWhitelist(
    @Body() body: { addresses: string[] },
    @CurrentUser() adminAddress: string,
  ) {
    return this.whitelistService.addToWhitelist(body.addresses, adminAddress);
  }

  @Delete(':address')
  async removeFromWhitelist(
    @Param('address') address: string,
    @CurrentUser() adminAddress: string,
  ) {
    return this.whitelistService.removeFromWhitelist(address, adminAddress);
  }
}

@Controller('whitelist')
export class PublicWhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Get('check')
  @Public()
  async checkWhitelistStatus(@Query('address') address: string) {
    const isWhitelisted = await this.whitelistService.checkWhitelistStatus(address);
    return { isWhitelisted, address };
  }
}

