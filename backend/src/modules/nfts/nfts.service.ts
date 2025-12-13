import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';
import { InviteCodesService } from '../invite-codes/invite-codes.service';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class NftsService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
    private inviteCodesService: InviteCodesService,
    private revenueService: RevenueService,
    private configService: ConfigService,
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
        // Removed rootInviteCode - can be calculated recursively from inviteCode
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
   * @description 
   * - Queries NFTs by recursively finding root invite code from inviteCodeId
   * - No longer uses NftRecord.rootInviteCodeId (removed for data consistency)
   */
  async getNFTsByRootInviteCode(rootInviteCodeId: number) {
    // Get all NFT records with invite codes
    const allRecords = await this.prisma.nftRecord.findMany({
      where: { inviteCodeId: { not: null } },
      include: {
        inviteCode: {
          select: {
            id: true,
            code: true,
            parentInviteCodeId: true,
          },
        },
      },
    });

    // Helper function to find root invite code ID
    const findRootInviteCodeId = async (inviteCodeId: number): Promise<number | null> => {
      let currentId = inviteCodeId;
      const visited = new Set<number>();

      while (currentId) {
        if (visited.has(currentId)) {
          break; // Prevent infinite loop
        }
        visited.add(currentId);

        const code = await this.prisma.inviteCode.findUnique({
          where: { id: currentId },
          select: { id: true, parentInviteCodeId: true },
        });

        if (!code) {
          break;
        }

        if (!code.parentInviteCodeId) {
          // This is the root
          return code.id;
        }

        currentId = code.parentInviteCodeId;
      }

      return null;
    };

    // Filter records where root invite code matches
    const matchingRecords = [];
    for (const record of allRecords) {
      if (!record.inviteCode) {
        continue;
      }

      const rootId = await findRootInviteCodeId(record.inviteCode.id);
      if (rootId === rootInviteCodeId) {
        matchingRecords.push(record);
      }
    }

    // Transform to match frontend NFT interface
    return matchingRecords.map(record => ({
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

  /**
   * Sync NFTs from The Graph subgraph to database
   * This is the recommended method as it's faster and more reliable than scanning blocks
   * @returns Sync statistics
   */
  async syncNFTsFromSubgraph(): Promise<{
    totalEvents: number;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  }> {
    try {
      const subgraphUrl = this.configService.get<string>('SUBGRAPH_URL');
      if (!subgraphUrl) {
        throw new Error('SUBGRAPH_URL is not configured in environment variables');
      }

      const subgraphApiKey = this.configService.get<string>('SUBGRAPH_API_KEY');

      console.log('🔄 Starting NFT sync from The Graph subgraph...\n');
      console.log(`📡 Subgraph URL: ${subgraphUrl}`);
      if (subgraphApiKey) {
        console.log(`🔑 Using API Key: ${subgraphApiKey.substring(0, 8)}...`);
      } else {
        console.log(`⚠️  No API Key configured (may hit rate limits)`);
      }
      console.log();

      // Query all NFT mint events from subgraph
      const query = `
        {
          nftmints(orderBy: timestamp, orderDirection: asc) {
            id
            nftId
            minter
            batchId
            mintPrice
            timestamp
            txHash
            blockNumber
          }
        }
      `;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API Key if configured
      if (subgraphApiKey) {
        headers['Authorization'] = `Bearer ${subgraphApiKey}`;
      }

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph query failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`Subgraph query errors: ${JSON.stringify(result.errors)}`);
      }

      const events = result.data?.nftmints || [];
      console.log(`   Found ${events.length} NFTMinted events from subgraph\n`);

      if (events.length === 0) {
        console.log('ℹ️  No NFTMinted events found in subgraph');
        return {
          totalEvents: 0,
          synced: 0,
          created: 0,
          updated: 0,
          errors: 0,
        };
      }

      let synced = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      // Process events in batches to avoid overwhelming the database
      const batchSize = 50; // Can use larger batch size since we're not querying RPC

      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (event: any) => {
            try {

              const nftId = parseInt(event.nftId);
              const minter = event.minter.toLowerCase();
              const batchId = BigInt(event.batchId);
              const timestamp = BigInt(event.timestamp);
              const txHash = event.txHash;
              const blockNumber = parseInt(event.blockNumber);

              // Use minter as owner (no need to query from chain)
              // This avoids RPC rate limits and is sufficient for minting statistics
              const ownerAddress = minter;

              // Find invite code used by minter (at the time of minting)
              const inviteCodeUsage = await this.prisma.inviteCodeUsage.findFirst({
                where: {
                  userAddress: minter,
                  createdAt: { lte: new Date(Number(timestamp) * 1000) }, // Before or at mint time
                },
                include: { inviteCode: true },
                orderBy: { createdAt: 'asc' },
              });

              // Check if NftRecord exists
              const existing = await this.prisma.nftRecord.findUnique({
                where: { nftId },
              });

              const mintedAt = new Date(Number(timestamp) * 1000);

              if (existing) {
                // Update existing record only when changed (keep sync truly idempotent and avoid write amplification)
                const nextOwner = ownerAddress.toLowerCase();
                const nextInviteCodeId = inviteCodeUsage?.inviteCodeId ?? existing.inviteCodeId;
                const needsUpdate =
                  existing.ownerAddress !== nextOwner ||
                  existing.minterAddress !== minter ||
                  existing.batchId?.toString() !== batchId.toString() ||
                  (existing.mintTxHash || null) !== (txHash || null) ||
                  (existing.mintedAt?.getTime() || 0) !== mintedAt.getTime() ||
                  (existing.inviteCodeId ?? null) !== (nextInviteCodeId ?? null);

                if (needsUpdate) {
                  await this.prisma.nftRecord.update({
                    where: { nftId },
                    data: {
                      ownerAddress: nextOwner,
                      minterAddress: minter,
                      batchId: batchId,
                      mintTxHash: txHash,
                      mintedAt: mintedAt,
                      inviteCodeId: nextInviteCodeId,
                    },
                  });
                  updated++;
                }
              } else {
                // Create new record
                await this.prisma.nftRecord.create({
                  data: {
                    nftId,
                    ownerAddress: ownerAddress.toLowerCase(),
                    minterAddress: minter,
                    batchId: batchId,
                    mintTxHash: txHash,
                    mintedAt: mintedAt,
                    inviteCodeId: inviteCodeUsage?.inviteCodeId || null,
                  },
                });
                created++;
              }

              // Activate invite code for applicant if they minted NFT
              try {
                await this.inviteCodesService.activateInviteCodeForApplicant(minter);
              } catch (error: any) {
                // Log but don't fail - activation is best effort
                console.log(`ℹ️ Could not activate invite code for ${minter}: ${error.message}`);
              }

              // Create referral reward record if batchId is available
              // Use the invite code ID found at mint time (direct invite code)
              if (batchId) {
                try {
                  await this.revenueService.calculateAndCreateReferralReward(
                    nftId,
                    minter,
                    batchId,
                    txHash,
                    inviteCodeUsage?.inviteCodeId || null, // Direct invite code ID used at mint time
                    mintedAt, // Mint timestamp for accurate invite code lookup
                  );
                } catch (error: any) {
                  // Log but don't fail - referral reward creation is best effort
                  console.log(`ℹ️ Could not create referral reward for NFT ${nftId}: ${error.message}`);
                }
              }

              synced++;
              return { nftId, success: true };
            } catch (error: any) {
              console.error(`❌ Error syncing NFT from subgraph event:`, error.message);
              return { nftId: parseInt(event.nftId), success: false, error: error.message };
            }
          })
        );

        // Count errors
        results.forEach((result) => {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
            errors++;
          }
        });

        console.log(`   Progress: ${Math.min(i + batchSize, events.length)}/${events.length} events processed`);
      }

      console.log(`\n✅ Sync complete:`);
      console.log(`   Total events: ${events.length}`);
      console.log(`   Synced: ${synced}`);
      console.log(`   Created: ${created}`);
      console.log(`   Updated: ${updated}`);
      console.log(`   Errors: ${errors}`);

      // Best-effort: sync referral rewards totals to RewardVault (on-chain).
      // This updates only when totals increase, and contract enforces only-increase.
      // Always compare DB totals with vault totals; only changed increases will be written on-chain.
      try {
        console.log('\n🔄 Syncing referral reward totals to RewardVault...');
        const vaultResult = await this.revenueService.syncReferralRewardsToVault();
        if (vaultResult.updatedDetails?.length) {
          console.log('📌 RewardVault updated users (old -> new):');
          for (const d of vaultResult.updatedDetails) {
            console.log(`   - ${d.user}: ${d.oldTotalWei} -> ${d.newTotalWei}`);
          }
        } else {
          console.log('📌 RewardVault updated users: (none)');
        }

        if (vaultResult.skippedDetails?.length) {
          console.log('📌 RewardVault skipped users (old vs new):');
          for (const d of vaultResult.skippedDetails) {
            console.log(`   - ${d.user}: old=${d.oldTotalWei}, new=${d.newTotalWei}, reason=${d.reason}`);
          }
        } else {
          console.log('📌 RewardVault skipped users: (none)');
        }
        console.log(
          `✅ RewardVault sync done: processed=${vaultResult.processedUsers}, ` +
            `updated=${vaultResult.updatedUsers}, skipped=${vaultResult.skippedUsers}, txCount=${vaultResult.txCount}`
        );
      } catch (e: any) {
        console.warn(`⚠️ RewardVault sync skipped/failed: ${e?.message || e}`);
      }

      return {
        totalEvents: events.length,
        synced,
        created,
        updated,
        errors,
      };
    } catch (error: any) {
      console.error('❌ Error syncing NFTs from subgraph:', error);
      throw error;
    }
  }

  /**
   * Sync NFTs from chain to database by scanning NFTMinted events
   * This is more efficient than querying each NFT individually
   * @deprecated Use syncNFTsFromSubgraph() instead for better performance
   * @param fromBlock Optional starting block number (defaults to 0)
   * @param toBlock Optional ending block number (defaults to 'latest')
   * @returns Sync statistics
   */
  async syncNFTsFromChain(
    fromBlock?: number,
    toBlock?: number | 'latest',
  ): Promise<{
    totalEvents: number;
    synced: number;
    created: number;
    updated: number;
    errors: number;
  }> {
    try {
      console.log('🔄 Starting NFT sync from chain by scanning NFTMinted events...\n');

      // 1. Try BSCScan API first (faster and more reliable, if paid plan)
      console.log('📡 Attempting to fetch events from Etherscan API V2...');
      let events = await this.contractService.getNFTMintedEventsFromBSCScan(fromBlock, toBlock);
      
      // 2. Try direct RPC eth_getLogs (optimized for DRPC and high-performance RPC nodes)
      if (events === null) {
        console.log('📡 Attempting to fetch events via RPC eth_getLogs (optimized for DRPC)...');
        events = await this.contractService.getNFTMintedEventsViaRPC(fromBlock, toBlock);
      }
      
      // 3. Fallback to ethers queryFilter if RPC method fails
      if (events === null) {
        console.log('⚠️  RPC eth_getLogs unavailable, falling back to ethers queryFilter...');
        events = await this.contractService.scanNFTMintedEvents(fromBlock, toBlock);
      } else {
        console.log('✅ Using events from RPC query');
      }
      
      console.log(`   Found ${events.length} NFTMinted events\n`);

      if (events.length === 0) {
        console.log('ℹ️  No NFTMinted events found');
        return {
          totalEvents: 0,
          synced: 0,
          created: 0,
          updated: 0,
          errors: 0,
        };
      }

      let synced = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      // 2. Process events in batches to avoid overwhelming the database
      const batchSize = 50;
      
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async (event) => {
            try {
              const { nftId, minter, batchId, mintPrice, timestamp, txHash } = event;

              // Get current owner from chain (may have changed due to transfer)
              let ownerAddress: string;
              try {
                ownerAddress = await this.contractService.getNFTOwner(nftId);
              } catch (error: any) {
                // If ownerOf fails, use minter as owner (NFT was just minted to minter)
                console.warn(`⚠️ NFT #${nftId}: Could not get owner, using minter: ${minter}`);
                ownerAddress = minter;
              }

              // Find invite code used by minter (at the time of minting)
              const inviteCodeUsage = await this.prisma.inviteCodeUsage.findFirst({
                where: { 
                  userAddress: minter.toLowerCase(),
                  createdAt: { lte: new Date(Number(timestamp) * 1000) }, // Before or at mint time
                },
                include: { inviteCode: true },
                orderBy: { createdAt: 'asc' },
              });

              // Check if NftRecord exists
              const existing = await this.prisma.nftRecord.findUnique({
                where: { nftId },
              });

              const mintedAt = new Date(Number(timestamp) * 1000);

              if (existing) {
                // Update existing record (idempotent - can be called multiple times)
                await this.prisma.nftRecord.update({
                  where: { nftId },
                  data: {
                    ownerAddress: ownerAddress.toLowerCase(),
                    minterAddress: minter.toLowerCase(),
                    batchId: batchId,
                    mintTxHash: txHash,
                    mintedAt: mintedAt,
                    inviteCodeId: inviteCodeUsage?.inviteCodeId || existing.inviteCodeId,
                  },
                });
                updated++;
              } else {
                // Create new record
                await this.prisma.nftRecord.create({
                  data: {
                    nftId,
                    ownerAddress: ownerAddress.toLowerCase(),
                    minterAddress: minter.toLowerCase(),
                    batchId: batchId,
                    mintTxHash: txHash,
                    mintedAt: mintedAt,
                    inviteCodeId: inviteCodeUsage?.inviteCodeId || null,
                  },
                });
                created++;
              }

              synced++;
              return { nftId, success: true };
            } catch (error: any) {
              console.error(`❌ Error syncing NFT from event:`, error.message);
              return { nftId: event.nftId, success: false, error: error.message };
            }
          })
        );

        // Count errors
        results.forEach((result) => {
          if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)) {
            errors++;
          }
        });

        console.log(`   Progress: ${Math.min(i + batchSize, events.length)}/${events.length} events processed`);
      }

      console.log(`\n✅ Sync complete:`);
      console.log(`   Total events: ${events.length}`);
      console.log(`   Synced: ${synced}`);
      console.log(`   Created: ${created}`);
      console.log(`   Updated: ${updated}`);
      console.log(`   Errors: ${errors}`);

      return {
        totalEvents: events.length,
        synced,
        created,
        updated,
        errors,
      };
    } catch (error: any) {
      console.error('❌ Error syncing NFTs from chain:', error);
      throw error;
    }
  }
}

