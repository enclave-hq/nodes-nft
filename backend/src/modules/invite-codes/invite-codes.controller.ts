import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UseInviteCodeDto, ApproveRequestDto } from './dto/invite-codes.dto';

@Controller('admin/invite-codes')
@UseGuards(JwtAuthGuard)
export class InviteCodesController {
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
  ) {
    return this.inviteCodesService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inviteCodesService.findOne(id);
  }

  @Get(':id/descendants')
  async getDescendants(@Param('id', ParseIntPipe) id: number) {
    return this.inviteCodesService.getDescendants(id);
  }

  @Patch('requests/:id/approve')
  async approveRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveDto: ApproveRequestDto,
    @CurrentUser() adminAddress: string,
  ) {
    return this.inviteCodesService.approveRequest(id, adminAddress);
  }
}

@Controller('invite-codes')
export class PublicInviteCodesController {
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  @Post('request')
  @Public()
  async createRequest(
    @Body() body: { applicantAddress: string; referrerInviteCodeId?: number; note?: string },
  ) {
    return this.inviteCodesService.createRequest(
      body.applicantAddress,
      body.referrerInviteCodeId,
      body.note,
    );
  }

  @Post('use')
  @Public()
  async useInviteCode(@Body() useDto: UseInviteCodeDto) {
    return this.inviteCodesService.useInviteCode(
      useDto.code,
      useDto.address,
    );
  }

  @Post('validate')
  @Public()
  async validateInviteCode(@Body() body: { code: string }) {
    // Implementation for validation
    return { valid: true };
  }

  @Get('user/:address')
  @Public()
  async getUserInviteCodes(@Param('address') address: string) {
    return this.inviteCodesService.getUserInviteCodes(address);
  }
}

