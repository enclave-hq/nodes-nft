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
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return { 
        isWhitelisted: false, 
        address: address || null,
        error: 'Address parameter is required' 
      };
    }
    
    // Validate address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      return { 
        isWhitelisted: false, 
        address: address,
        error: 'Invalid address format' 
      };
    }
    
    const isWhitelisted = await this.whitelistService.checkWhitelistStatus(address.trim());
    return { isWhitelisted, address: address.trim() };
  }
}

