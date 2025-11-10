import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

export class SetupTotpDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class EnableTotpDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  totpCode: string;

  @IsString()
  @IsNotEmpty()
  secret: string;
}

export class DisableTotpDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password, loginDto.totpCode);
  }

  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  async setupTotp(@Body() dto: SetupTotpDto) {
    return this.authService.setupTotp(dto.username, dto.password);
  }

  @Post('totp/enable')
  @HttpCode(HttpStatus.OK)
  async enableTotp(@Body() dto: EnableTotpDto) {
    return this.authService.enableTotp(dto.username, dto.password, dto.totpCode, dto.secret);
  }

  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  async disableTotp(@Body() dto: DisableTotpDto) {
    return this.authService.disableTotp(dto.username, dto.password);
  }
}

