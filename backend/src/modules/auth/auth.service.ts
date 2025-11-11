import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Login admin with username, password and TOTP
   * @param username Admin username
   * @param password Admin password
   * @param totpCode TOTP verification code (6 digits)
   * @returns Promise with JWT token
   */
  async login(username: string, password: string, totpCode?: string) {
    // Find admin by username
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // If TOTP is enabled, verify TOTP code
    if (admin.totpEnabled) {
      if (!totpCode) {
        throw new BadRequestException('TOTP code is required');
      }

      const isValidTotp = speakeasy.totp.verify({
        secret: admin.totpSecret!,
        encoding: 'base32',
        token: totpCode,
        window: 2, // Allow 2 time steps before/after current time
      });

      if (!isValidTotp) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    // Generate JWT token
    if (!admin.username) {
      throw new UnauthorizedException('Admin username not found');
    }
    
    const payload = { 
      username: admin.username, 
      sub: admin.id.toString(),
      userId: admin.id,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      username: admin.username,
    };
  }

  /**
   * Generate TOTP secret and QR code
   * @param username Admin username
   * @param password Admin password (for verification)
   * @returns TOTP secret and QR code data URL
   */
  async setupTotp(username: string, password: string) {
    // Verify username and password first
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `NFT Admin (${username})`,
      issuer: 'NFT Admin Panel',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret temporarily (user needs to verify before enabling)
    // Note: In production, you might want to store this in a temporary cache
    // For now, we'll return it and let the user verify it

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
    };
  }

  /**
   * Enable TOTP for admin after verification
   * @param username Admin username
   * @param password Admin password
   * @param totpCode TOTP code to verify
   * @param secret TOTP secret
   */
  async enableTotp(username: string, password: string, totpCode: string, secret: string) {
    // Verify username and password
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Verify TOTP code
    const isValidTotp = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: totpCode,
      window: 2,
    });

    if (!isValidTotp) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Enable TOTP
    await this.prisma.admin.update({
      where: { username },
      data: {
        totpSecret: secret,
        totpEnabled: true,
      },
    });

    return { success: true, message: 'TOTP enabled successfully' };
  }

  /**
   * Verify password
   * @param password Plain password
   * @param hash Bcrypt hash
   * @returns True if password is valid
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Verify TOTP code
   * @param totpCode TOTP code (6 digits)
   * @param secret TOTP secret (base32)
   * @returns True if TOTP code is valid
   */
  async verifyTotp(totpCode: string, secret: string): Promise<boolean> {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: totpCode,
      window: 2, // Allow 2 time steps before/after current time
    });
  }

  /**
   * Disable TOTP for admin
   * @param username Admin username
   * @param password Admin password
   */
  async disableTotp(username: string, password: string) {
    // Verify username and password
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Disable TOTP
    await this.prisma.admin.update({
      where: { username },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
    });

    return { success: true, message: 'TOTP disabled successfully' };
  }

  /**
   * Check if TOTP is enabled for a username (public endpoint, no authentication required)
   * This is safe because it only returns whether TOTP is enabled, not the secret
   * @param username Admin username
   * @returns Object with totpEnabled boolean
   */
  async checkTotpStatus(username: string): Promise<{ totpEnabled: boolean }> {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      select: {
        totpEnabled: true,
      },
    });

    // Return false if admin doesn't exist (don't reveal if username exists)
    return {
      totpEnabled: admin?.totpEnabled || false,
    };
  }

  /**
   * Verify JWT token
   * @param token JWT token
   * @returns Decoded payload
   */
  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

