import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    // Verify admin exists by username or userId
    const admin = await this.prisma.admin.findUnique({
      where: payload.username 
        ? { username: payload.username }
        : { id: payload.userId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return { 
      username: admin.username,
      userId: admin.id,
    };
  }
}

