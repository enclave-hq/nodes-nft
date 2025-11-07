import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':address/children')
  async getChildren(@Param('address') address: string) {
    return this.usersService.getChildren(address);
  }

  @Get(':address/descendants')
  async getDescendants(@Param('address') address: string) {
    return this.usersService.getDescendants(address);
  }

  @Get(':address/stats')
  async getStats(@Param('address') address: string) {
    return this.usersService.getStats(address);
  }
}

