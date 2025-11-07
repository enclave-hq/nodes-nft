import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class WhitelistService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Get whitelist with pagination
   */
  async getWhitelist(page: number = 1, limit: number = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (search) {
      where.address = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.whitelistHistory.findMany({
        where: { action: 'add', ...where },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        distinct: ['address'],
      }),
      this.prisma.whitelistHistory.count({ where: { action: 'add', ...where } }),
    ]);

    return {
      data: data.map((item) => item.address),
      total,
      page,
      limit,
    };
  }

  /**
   * Batch add addresses to whitelist
   */
  async addToWhitelist(addresses: string[], adminAddress: string) {
    // Call contract
    const txHash = await this.contractService.addToWhitelist(addresses);

    // Record to database
    await Promise.all(
      addresses.map((address) =>
        this.prisma.whitelistHistory.create({
          data: {
            address: address.toLowerCase(),
            action: 'add',
            adminAddress,
            txHash,
          },
        }),
      ),
    );

    return { success: true, txHash };
  }

  /**
   * Remove address from whitelist
   */
  async removeFromWhitelist(address: string, adminAddress: string) {
    // Call contract
    const txHash = await this.contractService.removeFromWhitelist(address);

    // Record to database
    await this.prisma.whitelistHistory.create({
      data: {
        address: address.toLowerCase(),
        action: 'remove',
        adminAddress,
        txHash,
      },
    });

    return { success: true, txHash };
  }

  /**
   * Check whitelist status
   */
  async checkWhitelistStatus(address: string): Promise<boolean> {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('checkWhitelistStatus called with invalid address:', address);
      return false;
    }
    
    // Validate address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      console.warn('checkWhitelistStatus called with invalid address format:', address);
      return false;
    }
    
    return await this.contractService.isWhitelisted(address.trim());
  }
}

