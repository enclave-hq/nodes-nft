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
   * Note: Contract doesn't support enumerating whitelist, so we use database history
   * But we verify each address against contract to ensure accuracy
   */
  async getWhitelist(page: number = 1, limit: number = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (search) {
      where.address = { contains: search, mode: 'insensitive' };
    }

    // Get from database history (as index)
    const [historyRecords, total] = await Promise.all([
      this.prisma.whitelistHistory.findMany({
        where: { action: 'add', ...where },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        distinct: ['address'],
      }),
      this.prisma.whitelistHistory.count({ where: { action: 'add', ...where } }),
    ]);

    // Verify each address against contract (filter out removed addresses)
    // Return entries with metadata (address, addedAt, addedBy)
    const verifiedEntries = [];
    for (const record of historyRecords) {
      const isWhitelisted = await this.contractService.isWhitelisted(record.address);
      if (isWhitelisted) {
        verifiedEntries.push({
          address: record.address,
          addedAt: record.createdAt.toISOString(),
          addedBy: record.adminAddress || 'unknown',
        });
      }
    }

    // Calculate total pages
    const totalCount = verifiedEntries.length;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: verifiedEntries,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Batch add addresses to whitelist
   */
  async addToWhitelist(addresses: string[], adminAddress: string) {
    const added: string[] = [];
    const failed: string[] = [];
    
    try {
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

      // All addresses were added successfully
      added.push(...addresses);
      
      return { 
        success: true, 
        txHash,
        added,
        failed,
        message: `成功添加 ${added.length} 个地址到白名单`,
      };
    } catch (error) {
      // If contract call fails, all addresses failed
      failed.push(...addresses);
      
      return { 
        success: false, 
        added,
        failed,
        message: error instanceof Error ? error.message : '添加白名单失败',
      };
    }
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

