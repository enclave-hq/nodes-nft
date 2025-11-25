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
   * Now uses getAllWhitelistedAddresses() from contract for real-time accuracy
   */
  async getWhitelist(page: number = 1, limit: number = 50, search?: string) {
    try {
      // Get all whitelisted addresses from contract (real-time, accurate)
      const allAddresses = await this.contractService.getAllWhitelistedAddresses();
      
      // Filter by search if provided
      let filteredAddresses = allAddresses;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredAddresses = allAddresses.filter(addr => 
          addr.toLowerCase().includes(searchLower)
        );
      }

      // Get metadata from database (addedAt, addedBy)
      const historyRecords = await this.prisma.whitelistHistory.findMany({
        where: { 
          action: 'add',
          address: { in: filteredAddresses },
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['address'],
      });

      // Create a map of address -> metadata
      const metadataMap = new Map<string, { addedAt: Date; addedBy: string }>();
      historyRecords.forEach(record => {
        metadataMap.set(record.address.toLowerCase(), {
          addedAt: record.createdAt,
          addedBy: record.adminAddress || 'unknown',
        });
      });

      // Build entries with metadata
      const entries = filteredAddresses.map(address => {
        const metadata = metadataMap.get(address.toLowerCase());
        return {
          address,
          addedAt: metadata?.addedAt.toISOString() || new Date().toISOString(),
          addedBy: metadata?.addedBy || 'unknown',
        };
      });

      // Sort by addedAt (newest first)
      entries.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

      // Paginate
      const totalCount = entries.length;
      const totalPages = Math.ceil(totalCount / limit);
      const skip = (page - 1) * limit;
      const paginatedEntries = entries.slice(skip, skip + limit);

      return {
        data: paginatedEntries,
        total: totalCount,
        page,
        limit,
        totalPages,
      };
    } catch (error: any) {
      console.error('❌ Error in WhitelistService.getWhitelist():', error);
      // Fallback to old method if contract query fails
      console.warn('⚠️ Falling back to database history method');
      return this.getWhitelistFromDatabase(page, limit, search);
    }
  }

  /**
   * Fallback method: Get whitelist from database history
   * Used when contract query fails
   */
  private async getWhitelistFromDatabase(page: number = 1, limit: number = 50, search?: string) {
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

