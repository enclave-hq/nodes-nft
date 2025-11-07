import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Verify if address is contract owner
   * @param address Address to verify
   * @returns Promise<boolean> True if address is owner
   */
  async verifyContractOwner(address: string): Promise<boolean> {
    try {
      // Read owner from contract
      const owner = await this.contractService.getOwner();
      return owner.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying contract owner:', error);
      // Fallback: check if address exists in admin table
      const admin = await this.prisma.admin.findUnique({
        where: { address: address.toLowerCase() },
      });
      return !!admin;
    }
  }

  /**
   * Login admin and generate JWT token
   * @param address Admin address
   * @param signature Optional signature for verification
   * @returns Promise with JWT token
   */
  async login(address: string, signature?: string) {
    // Verify address is contract owner
    const isOwner = await this.verifyContractOwner(address);
    
    if (!isOwner) {
      throw new UnauthorizedException('Address is not authorized as admin');
    }

    // Ensure admin exists in database
    await this.prisma.admin.upsert({
      where: { address: address.toLowerCase() },
      create: { address: address.toLowerCase() },
      update: {},
    });

    // Generate JWT token
    const payload = { address: address.toLowerCase(), sub: address.toLowerCase() };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      address: address.toLowerCase(),
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

