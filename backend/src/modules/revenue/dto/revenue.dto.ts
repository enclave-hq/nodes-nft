import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferUsdtDto {
  @IsString()
  @IsNotEmpty()
  to: string; // Destination address

  @IsString()
  @IsNotEmpty()
  amount: string; // Amount in USDT (human-readable)

  @IsString()
  @IsNotEmpty()
  password: string; // Admin password for verification

  @IsString()
  @IsNotEmpty()
  totpCode: string; // TOTP verification code (6 digits)
}

export class GetRevenueDetailsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class GetReferralRewardDetailsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

