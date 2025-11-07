import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  async getOverview() {
    return this.statsService.getOverview();
  }

  @Get('invite-codes')
  async getInviteCodeStats() {
    return this.statsService.getInviteCodeStats();
  }
}

