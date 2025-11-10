import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';
import { InviteCodesService } from '../invite-codes/invite-codes.service';
import { ethers } from 'ethers';

@Injectable()
export class RevenueService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
    private inviteCodesService: InviteCodesService,
  ) {}

  /**
   * Get total revenue (sum of all mint prices)
   */
  async getTotalRevenue(): Promise<{
    totalRevenue: string; // USDT (human-readable)
    totalRevenueWei: string; // wei
    recordCount: number;
  }> {
    const records = await this.prisma.revenueRecord.findMany({
      select: {
        mintPrice: true,
      },
    });

    let totalWei = BigInt(0);
    records.forEach(record => {
      totalWei += BigInt(record.mintPrice);
    });

    // Convert to USDT (18 decimals)
    const totalUSDT = Number(totalWei) / 1e18;

    return {
      totalRevenue: totalUSDT.toFixed(2),
      totalRevenueWei: totalWei.toString(),
      recordCount: records.length,
    };
  }

  /**
   * Get revenue details (paginated)
   */
  async getRevenueDetails(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.revenueRecord.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.revenueRecord.count(),
    ]);

    return {
      records: records.map(record => ({
        id: record.id,
        nftId: record.nftId,
        batchId: record.batchId.toString(),
        minterAddress: record.minterAddress,
        mintPrice: record.mintPriceUSDT,
        mintPriceWei: record.mintPrice,
        mintTxHash: record.mintTxHash,
        createdAt: record.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get total referral rewards
   */
  async getTotalReferralRewards(): Promise<{
    totalRewards: string; // USDT (human-readable)
    totalRewardsWei: string; // wei
    recordCount: number;
  }> {
    const records = await this.prisma.referralRewardRecord.findMany({
      select: {
        referralRewardWei: true,
      },
    });

    let totalWei = BigInt(0);
    records.forEach(record => {
      totalWei += BigInt(record.referralRewardWei);
    });

    // Convert to USDT (18 decimals)
    const totalUSDT = Number(totalWei) / 1e18;

    return {
      totalRewards: totalUSDT.toFixed(2),
      totalRewardsWei: totalWei.toString(),
      recordCount: records.length,
    };
  }

  /**
   * Get referral reward details (paginated)
   */
  async getReferralRewardDetails(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.referralRewardRecord.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          rootInviteCode: {
            select: {
              id: true,
              code: true,
              applicantAddress: true,
            },
          },
        },
      }),
      this.prisma.referralRewardRecord.count(),
    ]);

    return {
      records: records.map(record => ({
        id: record.id,
        nftId: record.nftId,
        batchId: record.batchId.toString(),
        minterAddress: record.minterAddress,
        rootReferrerAddress: record.rootReferrerAddress,
        rootInviteCode: record.rootInviteCode ? {
          id: record.rootInviteCode.id,
          code: record.rootInviteCode.code,
          applicantAddress: record.rootInviteCode.applicantAddress,
        } : null,
        referralReward: record.referralReward,
        referralRewardWei: record.referralRewardWei,
        mintTxHash: record.mintTxHash,
        createdAt: record.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Trace root referrer from minter address
   * @param minterAddress Address that minted the NFT
   * @returns Root referrer address and invite code info, or null if no referrer
   */
  async traceRootReferrer(minterAddress: string): Promise<{
    rootReferrerAddress: string | null;
    rootInviteCodeId: number | null;
    rootInviteCode: string | null;
  }> {
    // Find invite code usage for this address
    const usage = await this.prisma.inviteCodeUsage.findFirst({
      where: {
        userAddress: minterAddress.toLowerCase(),
      },
      include: {
        inviteCode: {
          include: {
            parentInviteCode: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent usage
      },
    });

    if (!usage || !usage.inviteCode) {
      return {
        rootReferrerAddress: null,
        rootInviteCodeId: null,
        rootInviteCode: null,
      };
    }

    // Trace up the invite code chain to find root
    let currentInviteCode = usage.inviteCode;
    
    while (currentInviteCode.parentInviteCodeId) {
      const parent = await this.prisma.inviteCode.findUnique({
        where: { id: currentInviteCode.parentInviteCodeId },
        include: {
          parentInviteCode: true,
        },
      });
      
      if (!parent) {
        break;
      }
      
      currentInviteCode = parent;
    }

    // If rootInviteCodeId is set, use it; otherwise use current invite code
    const rootInviteCodeId = currentInviteCode.rootInviteCodeId || currentInviteCode.id;
    const rootInviteCode = await this.prisma.inviteCode.findUnique({
      where: { id: rootInviteCodeId },
    });

    return {
      rootReferrerAddress: rootInviteCode?.applicantAddress || null,
      rootInviteCodeId: rootInviteCodeId,
      rootInviteCode: rootInviteCode?.code || null,
    };
  }

  /**
   * Calculate and create referral reward record for an NFT
   * This should be called when an NFT is minted
   * @param nftId NFT ID
   * @param minterAddress Address that minted the NFT
   * @param batchId Batch ID
   * @param mintTxHash Mint transaction hash
   */
  async calculateAndCreateReferralReward(
    nftId: number,
    minterAddress: string,
    batchId: bigint,
    mintTxHash?: string,
  ): Promise<void> {
    // Check if record already exists
    const existing = await this.prisma.referralRewardRecord.findUnique({
      where: { nftId },
    });

    if (existing) {
      // Already calculated, skip
      return;
    }

    // Trace root referrer
    const rootReferrer = await this.traceRootReferrer(minterAddress);

    // Get batch referral reward from database
    const batch = await this.prisma.batch.findFirst({
      where: {
        batchId: batchId,
      },
    });

    if (!batch || !batch.referralReward) {
      // No referral reward configured for this batch
      return;
    }

    // Convert referral reward to wei (assuming USDT has 18 decimals)
    const referralRewardUSDT = parseFloat(batch.referralReward);
    const referralRewardWei = ethers.parseUnits(referralRewardUSDT.toFixed(18), 18).toString();

    // If no root referrer, reward goes to the minter (self-reward)
    const finalRootReferrerAddress = rootReferrer.rootReferrerAddress 
      ? rootReferrer.rootReferrerAddress.toLowerCase()
      : minterAddress.toLowerCase();
    const finalRootInviteCodeId = rootReferrer.rootReferrerAddress 
      ? rootReferrer.rootInviteCodeId 
      : null;

    // Create referral reward record
    await this.prisma.referralRewardRecord.create({
      data: {
        nftId,
        batchId,
        minterAddress: minterAddress.toLowerCase(),
        rootReferrerAddress: finalRootReferrerAddress,
        rootInviteCodeId: finalRootInviteCodeId,
        referralReward: batch.referralReward,
        referralRewardWei,
        mintTxHash,
      },
    });
  }

  /**
   * Get original minter address for an NFT
   * This is the address that originally minted the NFT (never changes, even if NFT is transferred)
   * 
   * Query order (priority):
   * 1. Chain query (getMinter) - fastest, O(1) complexity, no event scanning needed
   * 2. RevenueRecord (database) - fallback for NFTs minted before contract upgrade
   * 3. ReferralRewardRecord (database) - fallback
   * 4. NftRecord (database) - fallback
   * 
   * @param nftId NFT ID
   * @returns Original minter address, or null if not found
   */
  async getOriginalMinter(nftId: number): Promise<string | null> {
    // Priority 1: Query from chain (O(1), fastest, no event scanning)
    // This works for NFTs minted after contract upgrade
    try {
      const chainMinter = await this.contractService.getMinter(nftId);
      if (chainMinter) {
        return chainMinter;
      }
    } catch (error: any) {
      // If contract doesn't have getMinter function yet (not upgraded), continue to database fallback
      console.debug(`Chain query failed for NFT ${nftId}, falling back to database:`, error.message);
    }

    // Priority 2: Fallback to database (for NFTs minted before contract upgrade)
    // Try to get from RevenueRecord first (most reliable, fastest)
    const revenueRecord = await this.prisma.revenueRecord.findUnique({
      where: { nftId },
      select: { minterAddress: true },
    });

    if (revenueRecord) {
      return revenueRecord.minterAddress;
    }

    // Fallback to ReferralRewardRecord
    const referralRecord = await this.prisma.referralRewardRecord.findUnique({
      where: { nftId },
      select: { minterAddress: true },
    });

    if (referralRecord) {
      return referralRecord.minterAddress;
    }

    // Fallback to NftRecord (if minterAddress is stored)
    const nftRecord = await this.prisma.nftRecord.findUnique({
      where: { nftId },
      select: { minterAddress: true },
    });

    if (nftRecord?.minterAddress) {
      return nftRecord.minterAddress;
    }

    // Not found in chain or database
    return null;
  }

  /**
   * Get Treasury USDT balance
   * Treasury is the address that receives mint payments from users
   */
  async getTreasuryBalance(): Promise<{
    treasuryAddress: string;
    balance: string; // USDT (human-readable)
    balanceWei: string; // wei
  }> {
    try {
      // Get Treasury address from NFTManager contract
      const treasuryAddress = await this.contractService.getTreasury();
      
      if (!treasuryAddress || treasuryAddress === '0x0000000000000000000000000000000000000000') {
        throw new BadRequestException('Treasury address not set in contract');
      }
      
      // Get USDT balance of Treasury address
      const balanceWei = await this.contractService.getUsdtBalance(treasuryAddress);
      const balanceUSDT = Number(balanceWei) / 1e18;

      return {
        treasuryAddress,
        balance: balanceUSDT.toFixed(2),
        balanceWei: balanceWei.toString(),
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get treasury balance: ${error.message}`);
    }
  }

  /**
   * Transfer USDT from Treasury to destination address
   * Note: This requires Treasury to have approved the backend signer address to spend USDT
   * If Treasury is the signer address itself, it can transfer directly
   * 
   * @param to Destination address
   * @param amount Amount in USDT (human-readable)
   * @returns Transaction hash
   */
  async transferUsdt(to: string, amount: string): Promise<string> {
    try {
      // Validate destination address
      if (!ethers.isAddress(to)) {
        throw new BadRequestException('Invalid destination address');
      }

      // Convert amount to wei (18 decimals for BSC USDT)
      const amountWei = ethers.parseUnits(amount, 18);

      // Get treasury address from contract
      const treasuryAddress = await this.contractService.getTreasury();
      
      if (!treasuryAddress || treasuryAddress === '0x0000000000000000000000000000000000000000') {
        throw new BadRequestException('Treasury address not set in contract');
      }

      // Check Treasury balance
      const treasuryBalance = await this.contractService.getUsdtBalance(treasuryAddress);
      if (BigInt(treasuryBalance.toString()) < amountWei) {
        throw new BadRequestException(
          `Insufficient Treasury balance. Available: ${(Number(treasuryBalance) / 1e18).toFixed(2)} USDT, Required: ${amount} USDT`
        );
      }

      // Transfer USDT from Treasury to destination
      // The transferUsdt method will handle:
      // - If Treasury is the signer: use transfer()
      // - If Treasury is not the signer: use transferFrom() (requires approval)
      const txHash = await this.contractService.transferUsdt(treasuryAddress, to, amountWei);

      return txHash;
    } catch (error: any) {
      throw new BadRequestException(`Failed to transfer USDT: ${error.message}`);
    }
  }

  /**
   * Refresh NFT records from chain
   * @param fullRefresh If true, re-read all NFTs; if false, only read new ones
   * @returns Statistics about the refresh operation
   */
  async refreshNftRecords(fullRefresh: boolean = false): Promise<{
    totalNfts: number;
    newRecords: number;
    updatedRecords: number;
    errors: number;
  }> {
    try {
      // Get total minted NFTs from chain
      const totalMinted = await this.contractService.getTotalMinted();
      const totalNfts = Number(totalMinted);

      let newRecords = 0;
      let updatedRecords = 0;
      let errors = 0;

      // Determine which NFTs to process
      let nftIdsToProcess: number[] = [];
      
      if (fullRefresh) {
        // Process all NFTs
        nftIdsToProcess = Array.from({ length: totalNfts }, (_, i) => i + 1);
      } else {
        // Only process NFTs that don't have RevenueRecord
        const existingRecords = await this.prisma.revenueRecord.findMany({
          select: { nftId: true },
        });
        const existingNftIds = new Set(existingRecords.map(r => r.nftId));
        
        // Find NFTs that exist on chain but not in database
        for (let i = 1; i <= totalNfts; i++) {
          if (!existingNftIds.has(i)) {
            nftIdsToProcess.push(i);
          }
        }
      }

      console.log(`🔄 Refreshing ${nftIdsToProcess.length} NFTs (${fullRefresh ? 'full' : 'quick'} refresh)`);

      // Process NFTs in batches to avoid overwhelming the RPC
      const batchSize = 10;
      for (let i = 0; i < nftIdsToProcess.length; i += batchSize) {
        const batch = nftIdsToProcess.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (nftId) => {
          try {
            // Get minter address from chain
            const minterAddress = await this.contractService.getMinter(nftId);
            
            if (!minterAddress) {
              console.warn(`⚠️ NFT ${nftId}: No minter address found on chain`);
              errors++;
              return;
            }

            // Check if RevenueRecord exists
            const existingRecord = await this.prisma.revenueRecord.findUnique({
              where: { nftId },
            });

            // Try to get batchId from existing record or from NftRecord
            let batchId: bigint | null = null;
            let mintPrice: string | null = null;
            let mintPriceUSDT: string | null = null;
            let mintTxHash: string | null = null;

            if (existingRecord) {
              batchId = existingRecord.batchId;
              mintPrice = existingRecord.mintPrice;
              mintPriceUSDT = existingRecord.mintPriceUSDT;
              mintTxHash = existingRecord.mintTxHash;
            } else {
              // Try to get from NftRecord
              const nftRecord = await this.prisma.nftRecord.findUnique({
                where: { nftId },
              });
              
              if (nftRecord) {
                mintTxHash = nftRecord.mintTxHash || null;
                
                // Try to infer batchId from mint time or other sources
                // For now, we'll need to get it from batch information
                // This is a limitation - we may need to scan events to get accurate batchId
              }
            }

            // If we don't have batchId, try to get it from batch information
            // We'll use the active batch at mint time, or try to infer from other sources
            if (!batchId) {
              // Try to get batchId from batch that was active around mint time
              // This is a simplified approach - ideally we'd scan mint events
              const batches = await this.prisma.batch.findMany({
                orderBy: { createdAt: 'desc' },
              });
              
              // Use the most recent batch as a fallback
              // In production, you'd want to scan mint events to get accurate batchId
              if (batches.length > 0) {
                batchId = batches[0].batchId;
                mintPrice = batches[0].mintPrice;
                mintPriceUSDT = (Number(batches[0].mintPrice) / 1e18).toFixed(2);
              } else {
                console.warn(`⚠️ NFT ${nftId}: No batch found, skipping`);
                errors++;
                return;
              }
            }

            // Create or update RevenueRecord
            if (existingRecord) {
              // Update existing record if minter address changed (shouldn't happen, but just in case)
              if (existingRecord.minterAddress.toLowerCase() !== minterAddress.toLowerCase()) {
                await this.prisma.revenueRecord.update({
                  where: { nftId },
                  data: {
                    minterAddress: minterAddress.toLowerCase(),
                  },
                });
                updatedRecords++;
              }
            } else {
              // Create new record
              await this.prisma.revenueRecord.create({
                data: {
                  nftId,
                  batchId: batchId!,
                  minterAddress: minterAddress.toLowerCase(),
                  mintPrice: mintPrice!,
                  mintPriceUSDT: mintPriceUSDT!,
                  mintTxHash,
                },
              });
              newRecords++;
            }
          } catch (error: any) {
            console.error(`❌ Error processing NFT ${nftId}:`, error.message);
            errors++;
          }
        }));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < nftIdsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        totalNfts,
        newRecords,
        updatedRecords,
        errors,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to refresh NFT records: ${error.message}`);
    }
  }

  /**
   * Get NFTs that don't have referral reward records yet
   * @param page Page number
   * @param limit Page size
   * @returns List of NFTs without referral reward records
   */
  async getNftsWithoutReferralRewards(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Get all NFT IDs that have referral reward records (more efficient)
    const referralRewardNftIds = await this.prisma.referralRewardRecord.findMany({
      select: { nftId: true },
    });
    const referralRewardNftIdSet = new Set(referralRewardNftIds.map(r => r.nftId));

    // Get all revenue records
    const allRecords = await this.prisma.revenueRecord.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter out records that already have referral rewards
    const filteredRecords = allRecords.filter(r => !referralRewardNftIdSet.has(r.nftId));
    const total = filteredRecords.length;
    
    // Apply pagination
    const paginatedRecords = filteredRecords.slice(skip, skip + limit);

    return {
      records: paginatedRecords.map(record => ({
        id: record.id,
        nftId: record.nftId,
        batchId: record.batchId.toString(),
        minterAddress: record.minterAddress,
        mintPrice: record.mintPriceUSDT,
        mintPriceWei: record.mintPrice,
        mintTxHash: record.mintTxHash,
        createdAt: record.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create referral reward record for a specific NFT
   * @param nftId NFT ID
   * @returns Created referral reward record
   */
  async createReferralRewardForNft(nftId: number): Promise<void> {
    // Check if record already exists
    const existing = await this.prisma.referralRewardRecord.findUnique({
      where: { nftId },
    });

    if (existing) {
      throw new BadRequestException(`Referral reward record already exists for NFT ${nftId}`);
    }

    // Get RevenueRecord
    const revenueRecord = await this.prisma.revenueRecord.findUnique({
      where: { nftId },
    });

    if (!revenueRecord) {
      throw new NotFoundException(`Revenue record not found for NFT ${nftId}`);
    }

    // Calculate and create referral reward
    await this.calculateAndCreateReferralReward(
      nftId,
      revenueRecord.minterAddress,
      revenueRecord.batchId,
      revenueRecord.mintTxHash || undefined,
    );
  }

  /**
   * Batch create referral reward records for all NFTs without them
   * @returns Statistics about the batch creation
   */
  async batchCreateReferralRewards(): Promise<{
    processed: number;
    created: number;
    skipped: number;
    errors: number;
  }> {
    // Get all RevenueRecords and ReferralRewardRecords
    const [revenueRecords, referralRewardRecords] = await Promise.all([
      this.prisma.revenueRecord.findMany(),
      this.prisma.referralRewardRecord.findMany({
        select: { nftId: true },
      }),
    ]);

    // Filter out NFTs that already have referral reward records
    const referralRewardNftIdSet = new Set(referralRewardRecords.map(r => r.nftId));
    const recordsToProcess = revenueRecords.filter(r => !referralRewardNftIdSet.has(r.nftId));

    let created = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`🔄 Processing ${recordsToProcess.length} NFTs for referral rewards...`);

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < recordsToProcess.length; i += batchSize) {
      const batch = recordsToProcess.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (record) => {
        try {
          await this.calculateAndCreateReferralReward(
            record.nftId,
            record.minterAddress,
            record.batchId,
            record.mintTxHash || undefined,
          );
          created++;
        } catch (error: any) {
          // If no batch referral reward configured, skip
          if (error.message?.includes('No referral reward')) {
            skipped++;
          } else {
            console.error(`❌ Error creating referral reward for NFT ${record.nftId}:`, error.message);
            errors++;
          }
        }
      }));

      // Small delay between batches
      if (i + batchSize < recordsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      processed: recordsToProcess.length,
      created,
      skipped,
      errors,
    };
  }

  /**
   * Get distributable referral rewards by root address
   * @returns List of root addresses with their total rewards and distributed amounts
   */
  async getDistributableReferralRewards(): Promise<{
    rootAddress: string;
    totalRewards: string;
    totalRewardsWei: string;
    distributedRewards: string;
    distributedRewardsWei: string;
    distributableRewards: string;
    distributableRewardsWei: string;
    recordCount: number;
  }[]> {
    // Get all referral reward records grouped by rootReferrerAddress
    const records = await this.prisma.referralRewardRecord.findMany({
      select: {
        rootReferrerAddress: true,
        referralRewardWei: true,
      },
    });

    // Group by root address and calculate totals
    const rewardsByAddress = new Map<string, {
      totalWei: bigint;
      recordCount: number;
    }>();

    for (const record of records) {
      const address = record.rootReferrerAddress.toLowerCase();
      const rewardWei = BigInt(record.referralRewardWei);
      
      const existing = rewardsByAddress.get(address);
      if (existing) {
        existing.totalWei += rewardWei;
        existing.recordCount++;
      } else {
        rewardsByAddress.set(address, {
          totalWei: rewardWei,
          recordCount: 1,
        });
      }
    }

    // Get distributed rewards from ReferralRewardDistribution table
    const distributionRecords = await this.prisma.referralRewardDistribution.findMany({
      select: {
        rootReferrerAddress: true,
        amountWei: true,
      },
    });

    const distributedRewards = new Map<string, bigint>();
    for (const record of distributionRecords) {
      const address = record.rootReferrerAddress.toLowerCase();
      const amountWei = BigInt(record.amountWei);
      const existing = distributedRewards.get(address) || BigInt(0);
      distributedRewards.set(address, existing + amountWei);
    }

    // Build result
    const result = Array.from(rewardsByAddress.entries()).map(([address, data]) => {
      const distributedWei = distributedRewards.get(address) || BigInt(0);
      const distributableWei = data.totalWei - distributedWei;
      
      return {
        rootAddress: address,
        totalRewards: (Number(data.totalWei) / 1e18).toFixed(2),
        totalRewardsWei: data.totalWei.toString(),
        distributedRewards: (Number(distributedWei) / 1e18).toFixed(2),
        distributedRewardsWei: distributedWei.toString(),
        distributableRewards: (Number(distributableWei) / 1e18).toFixed(2),
        distributableRewardsWei: distributableWei.toString(),
        recordCount: data.recordCount,
      };
    });

    // Sort by distributable rewards (descending)
    result.sort((a, b) => {
      const aWei = BigInt(a.distributableRewardsWei);
      const bWei = BigInt(b.distributableRewardsWei);
      return aWei > bWei ? -1 : aWei < bWei ? 1 : 0;
    });

    return result;
  }

  /**
   * Handle NFT mint callback from frontend
   * This method:
   * 1. Reads contract Manager information (creates/updates NftRecord and RevenueRecord)
   * 2. Generates referral reward records
   * 3. Activates invite codes
   * @param nftId NFT ID
   * @param minterAddress Address that minted the NFT
   * @param mintTxHash Mint transaction hash
   * @param batchId Batch ID (optional, will be inferred if not provided)
   */
  async handleNftMintCallback(
    nftId: number,
    minterAddress: string,
    mintTxHash: string,
    batchId?: bigint,
  ): Promise<{
    success: boolean;
    nftRecordCreated: boolean;
    revenueRecordCreated: boolean;
    referralRewardCreated: boolean;
    inviteCodeActivated: boolean;
  }> {
    const normalizedMinterAddress = minterAddress.toLowerCase();
    let nftRecordCreated = false;
    let revenueRecordCreated = false;
    let referralRewardCreated = false;
    let inviteCodeActivated = false;

    try {
      // 1. Read contract Manager information and create/update NftRecord and RevenueRecord
      console.log(`🔄 Processing NFT mint callback for NFT ${nftId}...`);

      // Get minter address from chain (verify)
      // If chain query fails (NFT pool not initialized yet), use provided minterAddress
      const chainMinter = await this.contractService.getMinter(nftId);
      
      if (chainMinter) {
        // Verify minter address matches
        if (chainMinter.toLowerCase() !== normalizedMinterAddress) {
          throw new BadRequestException(
            `Minter address mismatch: expected ${normalizedMinterAddress}, got ${chainMinter}`,
          );
        }
        console.log(`✅ Verified minter address from chain: ${chainMinter}`);
      } else {
        // Chain query failed or returned null (NFT pool may not be initialized yet)
        // Use provided minterAddress but log a warning
        console.warn(
          `⚠️ Could not verify minter from chain for NFT ${nftId}, using provided minterAddress: ${normalizedMinterAddress}`,
        );
        console.warn(
          `⚠️ This may happen if the NFT was just minted and the pool hasn't been initialized yet, or if the NFT was minted before the upgrade`,
        );
      }

      // Get batchId if not provided
      let finalBatchId: bigint;
      let mintPrice: string;
      let mintPriceUSDT: string;

      if (batchId) {
        finalBatchId = batchId;
        // Get batch info to get mint price
        const batch = await this.prisma.batch.findFirst({
          where: { batchId: finalBatchId },
        });
        if (!batch) {
          throw new NotFoundException(`Batch ${finalBatchId} not found`);
        }
        mintPrice = batch.mintPrice;
        mintPriceUSDT = (Number(mintPrice) / 1e18).toFixed(2);
      } else {
        // Try to infer batchId from active batch or recent batches
        const batches = await this.prisma.batch.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        if (batches.length === 0) {
          throw new NotFoundException('No batches found');
        }
        // Use the most recent active batch, or the most recent batch
        const activeBatch = batches.find(b => b.active) || batches[0];
        finalBatchId = activeBatch.batchId;
        mintPrice = activeBatch.mintPrice;
        mintPriceUSDT = (Number(mintPrice) / 1e18).toFixed(2);
      }

      // Create or update NftRecord
      const existingNftRecord = await this.prisma.nftRecord.findUnique({
        where: { nftId },
      });

      if (!existingNftRecord) {
        // Get owner address from chain (current owner, may change on transfer)
        // For now, use minter address as owner (NFT is minted to minter)
        // In the future, we can query NodeNFT contract's ownerOf method
        const ownerAddress = normalizedMinterAddress;
        
        // Trace invite code chain
        const rootReferrer = await this.traceRootReferrer(normalizedMinterAddress);
        
        // Find invite code used by minter
        const inviteCodeUsage = await this.prisma.inviteCodeUsage.findFirst({
          where: { userAddress: normalizedMinterAddress },
          include: { inviteCode: true },
          orderBy: { createdAt: 'asc' },
        });

        await this.prisma.nftRecord.create({
          data: {
            nftId,
            ownerAddress: ownerAddress?.toLowerCase() || normalizedMinterAddress,
            minterAddress: normalizedMinterAddress,
            mintTxHash,
            inviteCodeId: inviteCodeUsage?.inviteCodeId || null,
            rootInviteCodeId: rootReferrer.rootInviteCodeId || null,
            rootApplicantAddress: rootReferrer.rootReferrerAddress || null,
          },
        });
        nftRecordCreated = true;
        console.log(`✅ Created NftRecord for NFT ${nftId}`);
      } else {
        // Update existing record if needed
        if (!existingNftRecord.mintTxHash) {
          await this.prisma.nftRecord.update({
            where: { nftId },
            data: { mintTxHash },
          });
        }
      }

      // Create or update RevenueRecord
      const existingRevenueRecord = await this.prisma.revenueRecord.findUnique({
        where: { nftId },
      });

      if (!existingRevenueRecord) {
        await this.prisma.revenueRecord.create({
          data: {
            nftId,
            batchId: finalBatchId,
            minterAddress: normalizedMinterAddress,
            mintPrice,
            mintPriceUSDT,
            mintTxHash,
          },
        });
        revenueRecordCreated = true;
        console.log(`✅ Created RevenueRecord for NFT ${nftId}`);
      } else {
        // Update if batchId or mintTxHash is missing
        const updates: any = {};
        if (existingRevenueRecord.batchId !== finalBatchId) {
          updates.batchId = finalBatchId;
        }
        if (!existingRevenueRecord.mintTxHash && mintTxHash) {
          updates.mintTxHash = mintTxHash;
        }
        if (Object.keys(updates).length > 0) {
          await this.prisma.revenueRecord.update({
            where: { nftId },
            data: updates,
          });
        }
      }

      // 2. Generate referral reward record
      try {
        await this.calculateAndCreateReferralReward(
          nftId,
          normalizedMinterAddress,
          finalBatchId,
          mintTxHash,
        );
        referralRewardCreated = true;
        console.log(`✅ Created ReferralRewardRecord for NFT ${nftId}`);
      } catch (error: any) {
        // If referral reward already exists, that's okay
        if (error.message?.includes('already exists')) {
          console.log(`ℹ️ Skipping referral reward for NFT ${nftId}: ${error.message}`);
        } else {
          throw error;
        }
      }

      // 3. Activate invite code
      try {
        await this.inviteCodesService.activateInviteCodeForApplicant(normalizedMinterAddress);
        inviteCodeActivated = true;
        console.log(`✅ Activated invite code for ${normalizedMinterAddress}`);
      } catch (error: any) {
        // If no pending invite code, that's okay
        console.log(`ℹ️ No pending invite code to activate for ${normalizedMinterAddress}`);
      }

      return {
        success: true,
        nftRecordCreated,
        revenueRecordCreated,
        referralRewardCreated,
        inviteCodeActivated,
      };
    } catch (error: any) {
      console.error(`❌ Error handling NFT mint callback for NFT ${nftId}:`, error);
      throw new BadRequestException(`Failed to process NFT mint callback: ${error.message}`);
    }
  }

  /**
   * Get revenue statistics (total, withdrawn, available)
   */
  async getRevenueStatistics(): Promise<{
    totalRevenue: string;
    totalRevenueWei: string;
    withdrawnRevenue: string;
    withdrawnRevenueWei: string;
    availableRevenue: string;
    availableRevenueWei: string;
  }> {
    // Get total revenue from RevenueRecord
    const totalRevenueResult = await this.getTotalRevenue();
    const totalRevenueWei = BigInt(totalRevenueResult.totalRevenueWei);

    // Get total withdrawn from RevenueWithdrawal table
    const withdrawals = await this.prisma.revenueWithdrawal.findMany({
      select: {
        amountWei: true,
      },
    });

    let withdrawnWei = BigInt(0);
    for (const withdrawal of withdrawals) {
      withdrawnWei += BigInt(withdrawal.amountWei);
    }

    const availableWei = totalRevenueWei - withdrawnWei;

    return {
      totalRevenue: totalRevenueResult.totalRevenue,
      totalRevenueWei: totalRevenueWei.toString(),
      withdrawnRevenue: (Number(withdrawnWei) / 1e18).toFixed(2),
      withdrawnRevenueWei: withdrawnWei.toString(),
      availableRevenue: (Number(availableWei) / 1e18).toFixed(2),
      availableRevenueWei: availableWei.toString(),
    };
  }

  /**
   * Get referral reward statistics (total, distributed, distributable)
   */
  async getReferralRewardStatistics(): Promise<{
    totalRewards: string;
    totalRewardsWei: string;
    distributedRewards: string;
    distributedRewardsWei: string;
    distributableRewards: string;
    distributableRewardsWei: string;
  }> {
    // Get total referral rewards
    const totalResult = await this.getTotalReferralRewards();
    const totalRewardsWei = BigInt(totalResult.totalRewardsWei);

    // Get total distributed from ReferralRewardDistribution table
    const distributions = await this.prisma.referralRewardDistribution.findMany({
      select: {
        amountWei: true,
      },
    });

    let distributedWei = BigInt(0);
    for (const distribution of distributions) {
      distributedWei += BigInt(distribution.amountWei);
    }

    const distributableWei = totalRewardsWei - distributedWei;

    return {
      totalRewards: totalResult.totalRewards,
      totalRewardsWei: totalRewardsWei.toString(),
      distributedRewards: (Number(distributedWei) / 1e18).toFixed(2),
      distributedRewardsWei: distributedWei.toString(),
      distributableRewards: (Number(distributableWei) / 1e18).toFixed(2),
      distributableRewardsWei: distributableWei.toString(),
    };
  }

  /**
   * Record referral reward distribution
   */
  async recordReferralRewardDistribution(
    rootReferrerAddress: string,
    amount: string,
    toAddress: string,
    txHash: string,
    adminAddress: string,
    note?: string,
  ): Promise<void> {
    const amountWei = ethers.parseUnits(amount, 18).toString();

    await this.prisma.referralRewardDistribution.create({
      data: {
        rootReferrerAddress: rootReferrerAddress.toLowerCase(),
        amount,
        amountWei,
        toAddress: toAddress.toLowerCase(),
        txHash,
        adminAddress,
        note,
      },
    });
  }

  /**
   * Record revenue withdrawal
   */
  async recordRevenueWithdrawal(
    amount: string,
    toAddress: string,
    txHash: string,
    adminAddress: string,
    note?: string,
  ): Promise<void> {
    const amountWei = ethers.parseUnits(amount, 18).toString();

    await this.prisma.revenueWithdrawal.create({
      data: {
        amount,
        amountWei,
        toAddress: toAddress.toLowerCase(),
        txHash,
        adminAddress,
        note,
      },
    });
  }
}

