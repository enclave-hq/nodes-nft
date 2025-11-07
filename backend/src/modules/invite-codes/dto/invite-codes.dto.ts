import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class UseInviteCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}

export class ApproveRequestDto {
  @IsNumber()
  @IsOptional()
  maxUses?: number;

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

