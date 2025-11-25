import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';

@Injectable()
export class NftsService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Check which NFTs need migration (pool not initialized or minter not set)
   * @returns Array of NFT IDs that need migration
   */
  async checkNFTsNeedingMigration(): Promise<{
    totalChecked: number;
    needsMigration: Array<{
      nftId: number;
      reason: 'pool_not_initialized' | 'minter_not_set';
      currentMinter: string | null;
    }>;
    alreadyMigrated: number;
  }> {
    try {
      const totalMinted = await this.contractService.getTotalMinted();
      const needsMigration: Array<{
        nftId: number;
        reason: 'pool_not_initialized' | 'minter_not_set';
        currentMinter: string | null;
      }> = [];
      let alreadyMigrated = 0;

      for (let nftId = 1; nftId <= totalMinted; nftId++) {
        try {
          const minter = await this.contractService.getMinter(nftId);
          
          if (!minter) {
            // Pool not initialized or minter not set (both return null)
            needsMigration.push({
              nftId,
              reason: 'pool_not_initialized', // Most likely pool not initialized
              currentMinter: null,
            });
          } else {
            alreadyMigrated++;
          }
        } catch (error: any) {
          // If getMinter reverts, pool is definitely not initialized
          needsMigration.push({
            nftId,
            reason: 'pool_not_initialized',
            currentMinter: null,
          });
        }
      }

      return {
        totalChecked: totalMinted,
        needsMigration,
        alreadyMigrated,
      };
    } catch (error: any) {
      console.error('Error checking NFTs needing migration:', error);
      throw error;
    }
  }

  /**
   * Set minter for a single NFT (migrates NFT to pool)
   * @param nftId NFT ID
   * @param minterAddress Minter address (if not provided, will try to get from database)
   * @returns Transaction hash
   */
  async migrateNFT(nftId: number, minterAddress?: string): Promise<{ txHash: string; nftId: number; minterAddress: string }> {
    // If minterAddress not provided, try to get from database
    if (!minterAddress) {
      const nftRecord = await this.prisma.nftRecord.findUnique({
        where: { nftId },
      });

      if (!nftRecord || !nftRecord.minterAddress) {
        throw new NotFoundException(
          `NFT ${nftId} not found in database or minter address not available. Please provide minterAddress.`,
        );
      }

      minterAddress = nftRecord.minterAddress;
    }

    // Validate minter address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(minterAddress)) {
      throw new BadRequestException('Invalid minter address format');
    }

    try {
      const txHash = await this.contractService.setMinter(nftId, minterAddress);
      return { txHash, nftId, minterAddress };
    } catch (error: any) {
      console.error(`Error migrating NFT ${nftId}:`, error);
      throw error;
    }
  }

  /**
   * Batch migrate multiple NFTs to pool
   * @param migrations Array of { nftId, minterAddress } pairs
   * @returns Transaction hash
   */
  async batchMigrateNFTs(
    migrations: Array<{ nftId: number; minterAddress?: string }>,
  ): Promise<{ txHash: string; migrated: number }> {
    if (migrations.length === 0) {
      throw new BadRequestException('No NFTs to migrate');
    }

    // Fetch minter addresses from database if not provided
    const nftIds = migrations.map(m => m.nftId);
    const nftRecords = await this.prisma.nftRecord.findMany({
      where: { nftId: { in: nftIds } },
    });

    const nftRecordMap = new Map(nftRecords.map(r => [r.nftId, r]));

    const nftIdsToMigrate: number[] = [];
    const minterAddresses: string[] = [];

    for (const migration of migrations) {
      let minterAddress = migration.minterAddress;

      if (!minterAddress) {
        const record = nftRecordMap.get(migration.nftId);
        if (!record || !record.minterAddress) {
          throw new NotFoundException(
            `NFT ${migration.nftId} not found in database or minter address not available. Please provide minterAddress.`,
          );
        }
        minterAddress = record.minterAddress;
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(minterAddress)) {
        throw new BadRequestException(`Invalid minter address format for NFT ${migration.nftId}: ${minterAddress}`);
      }

      nftIdsToMigrate.push(migration.nftId);
      minterAddresses.push(minterAddress);
    }

    try {
      const txHash = await this.contractService.batchSetMinters(nftIdsToMigrate, minterAddresses);
      return { txHash, migrated: nftIdsToMigrate.length };
    } catch (error: any) {
      console.error('Error batch migrating NFTs:', error);
      throw error;
    }
  }

  /**
   * @param nftId NFT ID
   * @returns Tracing information
   */
  async traceNFT(nftId: number) {
    const record = await this.prisma.nftRecord.findUnique({
      where: { nftId },
      include: {
        inviteCode: {
          include: {
            parentInviteCode: true,
          },
        },
        rootInviteCode: true,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `NFT ID ${nftId} 的记录未找到。可能原因：1) NFT 尚未被铸造；2) 数据尚未同步到数据库。`
      );
    }

    // Build invite code chain
    const chain = [];
    let currentInviteCode = record.inviteCode;
    
    while (currentInviteCode) {
      chain.push({
        id: currentInviteCode.id,
        code: currentInviteCode.code,
        ownerAddress: currentInviteCode.applicantAddress, // Use applicantAddress as ownerAddress
      });
      
      if (currentInviteCode.parentInviteCodeId) {
        currentInviteCode = await this.prisma.inviteCode.findUnique({
          where: { id: currentInviteCode.parentInviteCodeId },
          include: { parentInviteCode: true },
        });
      } else {
        break;
      }
    }

    // Return data matching frontend NFTTrace interface
    return {
      nft: {
        id: record.nftId,
        tokenId: record.nftId.toString(), // Use nftId as tokenId if not available
        ownerAddress: record.ownerAddress,
        inviteCodeId: record.inviteCodeId || 0,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.createdAt.toISOString(), // Use createdAt if updatedAt not available
      },
      inviteCodeChain: chain.reverse(), // From root to current
    };
  }

  /**
   * Get all NFTs generated by root invite code
   * @param rootInviteCodeId Root invite code ID
   * @returns Array of NFTs
   */
  async getNFTsByRootInviteCode(rootInviteCodeId: number) {
    const records = await this.prisma.nftRecord.findMany({
      where: { rootInviteCodeId },
      include: {
        inviteCode: true,
      },
    });

    // Transform to match frontend NFT interface
    return records.map(record => ({
      id: record.nftId,
      tokenId: record.nftId.toString(),
      ownerAddress: record.ownerAddress,
      inviteCodeId: record.inviteCodeId || 0,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.createdAt.toISOString(),
    }));
  }

  /**
   * Get all NFTs of a user
   * @param address User address
   * @returns Array of NFTs
   * @description 
   * - Queries NFT IDs from contract (real-time, accurate)
   * - Fetches metadata from database (invite code associations, etc.)
   * - Combines both for complete NFT information
   */
  async getNFTsByUser(address: string) {
    try {
      // Step 1: Get NFT IDs from contract (real-time, accurate)
      const nftIds = await this.contractService.getUserNFTs(address);
      
      if (nftIds.length === 0) {
        return [];
      }

      // Step 2: Get metadata from database for these NFTs
      const records = await this.prisma.nftRecord.findMany({
        where: { 
          nftId: { in: nftIds }
        },
        include: {
          inviteCode: true,
          rootInviteCode: true,
        },
      });

      // Step 3: Create a map for quick lookup
      const recordMap = new Map(records.map(r => [r.nftId, r]));

      // Step 4: Combine contract data with database metadata
      // Return NFTs in the order returned by contract, with metadata if available
      return nftIds.map(nftId => {
        const record = recordMap.get(nftId);
        
        if (record) {
          // NFT has metadata in database
          return {
            id: record.nftId,
            tokenId: record.nftId.toString(),
            ownerAddress: address, // Use address from parameter (current owner from contract)
            inviteCodeId: record.inviteCodeId || 0,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.createdAt.toISOString(),
          };
        } else {
          // NFT exists in contract but not in database (newly minted or not synced)
          // Return basic info from contract
          return {
            id: nftId,
            tokenId: nftId.toString(),
            ownerAddress: address, // Current owner from contract
            inviteCodeId: 0, // No metadata available
            createdAt: new Date().toISOString(), // Fallback timestamp
            updatedAt: new Date().toISOString(),
          };
        }
      });
    } catch (error: any) {
      console.error(`Error getting NFTs for user ${address}:`, error);
      
      // Fallback: If contract query fails, try database (may be outdated)
      console.warn('⚠️ Falling back to database query (may be outdated)');
      const records = await this.prisma.nftRecord.findMany({
        where: { ownerAddress: address.toLowerCase() },
        include: {
          inviteCode: true,
          rootInviteCode: true,
        },
      });

      return records.map(record => ({
        id: record.nftId,
        tokenId: record.nftId.toString(),
        ownerAddress: record.ownerAddress,
        inviteCodeId: record.inviteCodeId || 0,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.createdAt.toISOString(),
      }));
    }
  }
}

