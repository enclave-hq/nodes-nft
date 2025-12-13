import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';
import { InviteCodesService } from '../invite-codes/invite-codes.service';
import { MetricsService } from '../metrics/metrics.service';
import { ethers } from 'ethers';

@Injectable()
export class RevenueService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
    private inviteCodesService: InviteCodesService,
    private metricsService: MetricsService,
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
   * Get referral reward records for a direct referrer (直接邀请者) address.
   * Note: in current schema, ReferralRewardRecord.rootReferrerAddress stores direct referrer address.
   *
   * @param directReferrerAddress Lowercased 0x address
   * @param page Page number (1-based)
   * @param limit Page size
   * @param includeSelf Whether to include self-referral records (minterAddress === rootReferrerAddress)
   */
  async getReferralRecordsForDirectReferrer(
    directReferrerAddress: string,
    page: number = 1,
    limit: number = 20,
    includeSelf: boolean = false,
  ): Promise<{
    records: Array<{
      id: number;
      nftId: number;
      batchId: string;
      minterAddress: string;
      referralReward: string;
      referralRewardWei: string;
      mintTxHash: string | null;
      createdAt: string;
    }>;
    totals: {
      totalRewards: string;
      totalRewardsWei: string;
      recordCount: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const where: any = {
      rootReferrerAddress: directReferrerAddress.toLowerCase(),
    };
    if (!includeSelf) {
      where.NOT = { minterAddress: directReferrerAddress.toLowerCase() };
    }

    const [total, rows] = await Promise.all([
      this.prisma.referralRewardRecord.count({ where }),
      this.prisma.referralRewardRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          nftId: true,
          batchId: true,
          minterAddress: true,
          referralReward: true,
          referralRewardWei: true,
          mintTxHash: true,
          createdAt: true,
        },
      }),
    ]);

    // totals (for this address only)
    const allWei = await this.prisma.referralRewardRecord.findMany({
      where,
      select: { referralRewardWei: true },
    });
    let totalWei = BigInt(0);
    for (const r of allWei) {
      totalWei += BigInt(r.referralRewardWei);
    }

    return {
      records: rows.map((r) => ({
        id: r.id,
        nftId: r.nftId,
        batchId: r.batchId.toString(),
        minterAddress: r.minterAddress,
        referralReward: r.referralReward,
        referralRewardWei: r.referralRewardWei,
        mintTxHash: r.mintTxHash,
        createdAt: r.createdAt.toISOString(),
      })),
      totals: {
        totalRewards: (Number(totalWei) / 1e18).toFixed(2),
        totalRewardsWei: totalWei.toString(),
        recordCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
   * Get total referral rewards (排除自返佣)
   * 根据"直接邀请"的概念：只统计有效的返佣（排除自返佣）
   */
  async getTotalReferralRewards(): Promise<{
    totalRewards: string; // USDT (human-readable)
    totalRewardsWei: string; // wei
    recordCount: number;
  }> {
    const records = await this.prisma.referralRewardRecord.findMany({
      select: {
        minterAddress: true,
        rootReferrerAddress: true, // 实际是直接邀请者地址
        referralRewardWei: true,
      },
    });

    // 排除自返佣：minterAddress === rootReferrerAddress
    const validRecords = records.filter(record => {
      const minter = record.minterAddress.toLowerCase();
      const referrer = record.rootReferrerAddress?.toLowerCase();
      // 排除自返佣
      return referrer && minter !== referrer;
    });

    let totalWei = BigInt(0);
    validRecords.forEach(record => {
      totalWei += BigInt(record.referralRewardWei);
    });

    // Convert to USDT (18 decimals)
    const totalUSDT = Number(totalWei) / 1e18;

    return {
      totalRewards: totalUSDT.toFixed(2),
      totalRewardsWei: totalWei.toString(),
      recordCount: validRecords.length, // 返回有效记录数（排除自返佣）
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
   * Get direct referrer (直接邀请人) for a user
   * This is the person whose invite code was used by the user
   * @param userAddress User address
   * @returns Direct referrer information
   */
  async getDirectReferrer(userAddress: string): Promise<{
    directReferrerAddress: string | null;
    directInviteCodeId: number | null;
    directInviteCode: string | null;
  }> {
    // Find invite code usage for this address (most recent usage)
    const usage = await this.prisma.inviteCodeUsage.findFirst({
      where: {
        userAddress: userAddress.toLowerCase(),
      },
      include: {
        inviteCode: true,
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent usage
      },
    });

    if (!usage || !usage.inviteCode) {
      return {
        directReferrerAddress: null,
        directInviteCodeId: null,
        directInviteCode: null,
      };
    }

    // Direct referrer is the applicant of the invite code used by the user
    return {
      directReferrerAddress: usage.inviteCode.applicantAddress?.toLowerCase() || null,
      directInviteCodeId: usage.inviteCode.id,
      directInviteCode: usage.inviteCode.code || null,
    };
  }

  /**
   * Calculate and create referral reward record for an NFT
   * This should be called when an NFT is minted
   * Uses direct referrer (直接邀请人) instead of root referrer
   * 
   * 注意：虽然数据库字段名是 rootReferrerAddress，但实际存储的是"直接邀请者"地址
   * - 直接邀请者：用户使用的邀请码的申请人地址
   * - 不是根邀请者：不是邀请链的顶层邀请者
   * 
   * @param nftId NFT ID
   * @param minterAddress Address that minted the NFT
   * @param batchId Batch ID
   * @param mintTxHash Mint transaction hash
   * @param directInviteCodeId Optional: Direct invite code ID used by minter (if provided, skips query)
   * @param mintedAt Optional: Mint timestamp (used to find correct invite code usage at mint time)
   */
  async calculateAndCreateReferralReward(
    nftId: number,
    minterAddress: string,
    batchId: bigint,
    mintTxHash?: string,
    directInviteCodeId?: number | null,
    mintedAt?: Date,
  ): Promise<void> {
    // Check if record already exists
    const existing = await this.prisma.referralRewardRecord.findUnique({
      where: { nftId },
    });

    if (existing) {
      // Already calculated, skip
      return;
    }

    // Get direct referrer (直接邀请人)
    // If directInviteCodeId is provided, use it directly; otherwise query
    let directReferrer: {
      directReferrerAddress: string | null;
      directInviteCodeId: number | null;
      directInviteCode: string | null;
    };

    if (directInviteCodeId !== undefined && directInviteCodeId !== null) {
      // Use provided invite code ID
      const inviteCode = await this.prisma.inviteCode.findUnique({
        where: { id: directInviteCodeId },
      });
      directReferrer = {
        directReferrerAddress: inviteCode?.applicantAddress?.toLowerCase() || null,
        directInviteCodeId: directInviteCodeId,
        directInviteCode: inviteCode?.code || null,
      };
    } else if (mintedAt) {
      // Find invite code used at mint time (most accurate)
      const usage = await this.prisma.inviteCodeUsage.findFirst({
        where: {
          userAddress: minterAddress.toLowerCase(),
          createdAt: { lte: mintedAt }, // Before or at mint time
        },
        include: { inviteCode: true },
        orderBy: { createdAt: 'asc' }, // Get first usage (earliest)
      });
      directReferrer = usage && usage.inviteCode
        ? {
            directReferrerAddress: usage.inviteCode.applicantAddress?.toLowerCase() || null,
            directInviteCodeId: usage.inviteCode.id,
            directInviteCode: usage.inviteCode.code || null,
          }
        : await this.getDirectReferrer(minterAddress);
    } else {
      // Fallback: use most recent invite code usage
      directReferrer = await this.getDirectReferrer(minterAddress);
    }

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

    // If no direct referrer, reward goes to the minter (self-reward)
    // 注意：rootReferrerAddress 字段名虽然叫"root"，但实际存储的是"直接邀请者"地址（direct referrer）
    // 这是历史遗留命名问题，为了向后兼容暂时保留字段名
    const finalReferrerAddress = directReferrer.directReferrerAddress 
      ? directReferrer.directReferrerAddress.toLowerCase()
      : minterAddress.toLowerCase();
    const finalInviteCodeId = directReferrer.directReferrerAddress 
      ? directReferrer.directInviteCodeId 
      : null;

    // Create referral reward record
    // 注意：rootReferrerAddress 存储的是直接邀请者地址，不是根邀请者
    // rootInviteCodeId 存储的是直接邀请码ID，不是根邀请码ID
    await this.prisma.referralRewardRecord.create({
      data: {
        nftId,
        batchId,
        minterAddress: minterAddress.toLowerCase(),
        rootReferrerAddress: finalReferrerAddress, // 实际是直接邀请者地址
        rootInviteCodeId: finalInviteCodeId, // 实际是直接邀请码ID
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
   * Idempotent sync: Recalculate referral rewards from chain data and local invite code info
   * This ensures that re-reading NFTs from chain and invite codes from database
   * produces the same referral reward data (幂等性)
   * 
   * Process:
   * 1. Read all NFTs from chain (via totalMinted)
   * 2. For each NFT, get minter address from chain
   * 3. Get invite code usage from database for the minter
   * 4. Calculate direct referrer
   * 5. Get batch info from RevenueRecord or infer from chain
   * 6. Calculate expected referral reward record
   * 7. Compare with existing record, fix if incorrect
   * 
   * @param fullSync If true, recalculate all NFTs. If false, only process missing/incorrect records
   * @returns Statistics about the sync operation
   */
  async syncReferralRewardsFromChain(fullSync: boolean = false): Promise<{
    totalNfts: number;
    processed: number;
    created: number;
    updated: number;
    correct: number;
    skipped: number;
    errors: number;
  }> {
    try {
      console.log('🔄 Starting idempotent referral reward sync from chain...\n');

      // 1. Get total minted NFTs from chain
      const totalMinted = await this.contractService.getTotalMinted();
      const totalNfts = Number(totalMinted);
      console.log(`📊 Total NFTs on chain: ${totalNfts}\n`);

      let processed = 0;
      let created = 0;
      let updated = 0;
      let correct = 0;
      let skipped = 0;
      let errors = 0;

      // 2. Pre-fetch batch data to avoid repeated queries
      const allBatches = await this.prisma.batch.findMany({
        orderBy: { createdAt: 'desc' },
      });
      const batchMap = new Map<string, { batchId: bigint; referralReward: string }>();
      allBatches.forEach(batch => {
        if (batch.referralReward) {
          batchMap.set(batch.batchId.toString(), {
            batchId: batch.batchId,
            referralReward: batch.referralReward,
          });
        }
      });
      const defaultBatch = allBatches.length > 0 ? allBatches[0] : null;

      // 3. Pre-fetch all revenue records
      const allRevenueRecords = await this.prisma.revenueRecord.findMany();
      const revenueRecordMap = new Map<number, typeof allRevenueRecords[0]>();
      allRevenueRecords.forEach(record => {
        revenueRecordMap.set(record.nftId, record);
      });

      // 4. Pre-fetch all existing referral reward records
      const allReferralRewardRecords = await this.prisma.referralRewardRecord.findMany();
      const referralRewardRecordMap = new Map<number, typeof allReferralRewardRecords[0]>();
      allReferralRewardRecords.forEach(record => {
        referralRewardRecordMap.set(record.nftId, record);
      });

      // 5. Process NFTs in concurrent batches
      const batchSize = 20; // Increased batch size for better concurrency
      const rpcBatchSize = 5; // Smaller batch for RPC calls to avoid rate limits
      
      for (let i = 1; i <= totalNfts; i += batchSize) {
        const nftIds = Array.from({ length: Math.min(batchSize, totalNfts - i + 1) }, (_, idx) => i + idx);
        
        // Process RPC calls in smaller batches to avoid rate limits
        const minterPromises: Promise<{ nftId: number; minter: string | null }>[] = [];
        for (let j = 0; j < nftIds.length; j += rpcBatchSize) {
          const rpcBatch = nftIds.slice(j, j + rpcBatchSize);
          const batchPromises = rpcBatch.map(async (nftId) => {
            try {
              const minter = await this.contractService.getMinter(nftId);
              return { nftId, minter };
            } catch (error: any) {
              console.error(`❌ NFT #${nftId}: Error getting minter - ${error.message}`);
              return { nftId, minter: null };
            }
          });
          minterPromises.push(...batchPromises);
          
          // Small delay between RPC batches
          if (j + rpcBatchSize < nftIds.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        const minterResults = await Promise.all(minterPromises);
        const minterMap = new Map<number, string>();
        minterResults.forEach(({ nftId, minter }) => {
          if (minter) {
            minterMap.set(nftId, minter.toLowerCase());
          }
        });

        // Batch fetch direct referrers for all unique minter addresses
        const uniqueMinters = Array.from(new Set(minterMap.values()));
        const directReferrerPromises = uniqueMinters.map(async (minterAddress) => {
          const referrer = await this.getDirectReferrer(minterAddress);
          return { minterAddress, referrer };
        });
        const directReferrerResults = await Promise.all(directReferrerPromises);
        const directReferrerMap = new Map<string, typeof directReferrerResults[0]['referrer']>();
        directReferrerResults.forEach(({ minterAddress, referrer }) => {
          directReferrerMap.set(minterAddress, referrer);
        });

        // Process all NFTs in this batch concurrently
        const processPromises = nftIds.map(async (nftId) => {
          try {
            const minterAddress = minterMap.get(nftId);
            if (!minterAddress) {
              skipped++;
              return;
            }

            const directReferrer = directReferrerMap.get(minterAddress);
            const expectedReferrerAddress = directReferrer?.directReferrerAddress 
              ? directReferrer.directReferrerAddress.toLowerCase()
              : minterAddress.toLowerCase();
            const expectedInviteCodeId = directReferrer?.directReferrerAddress 
              ? directReferrer.directInviteCodeId 
              : null;

            // Get batch info from pre-fetched data
            let batchId: bigint | null = null;
            let referralReward: string | null = null;
            let referralRewardWei: string | null = null;

            const revenueRecord = revenueRecordMap.get(nftId);
            if (revenueRecord) {
              batchId = revenueRecord.batchId;
              const batchData = batchMap.get(batchId.toString());
              if (batchData?.referralReward) {
                referralReward = batchData.referralReward;
                referralRewardWei = ethers.parseUnits(
                  parseFloat(referralReward).toFixed(18),
                  18
                ).toString();
              }
            } else if (defaultBatch?.referralReward) {
              batchId = defaultBatch.batchId;
              referralReward = defaultBatch.referralReward;
              referralRewardWei = ethers.parseUnits(
                parseFloat(referralReward).toFixed(18),
                18
              ).toString();
            }

            if (!batchId || !referralReward) {
              skipped++;
              return;
            }

            const existingRecord = referralRewardRecordMap.get(nftId);
            if (existingRecord) {
              const isCorrect = 
                existingRecord.rootReferrerAddress.toLowerCase() === expectedReferrerAddress &&
                existingRecord.rootInviteCodeId === expectedInviteCodeId &&
                existingRecord.batchId === batchId &&
                existingRecord.referralReward === referralReward &&
                existingRecord.referralRewardWei === referralRewardWei;

              if (isCorrect) {
                correct++;
              } else {
                console.log(`🔧 NFT #${nftId}: Fixing incorrect record`);
                console.log(`   Current: referrer=${existingRecord.rootReferrerAddress}, inviteCodeId=${existingRecord.rootInviteCodeId}`);
                console.log(`   Expected: referrer=${expectedReferrerAddress}, inviteCodeId=${expectedInviteCodeId}`);

                await this.prisma.referralRewardRecord.update({
                  where: { nftId },
                  data: {
                    minterAddress: minterAddress.toLowerCase(),
                    rootReferrerAddress: expectedReferrerAddress,
                    rootInviteCodeId: expectedInviteCodeId,
                    batchId,
                    referralReward,
                    referralRewardWei,
                  },
                });
                updated++;
              }
            } else {
              console.log(`➕ NFT #${nftId}: Creating new record (referrer=${expectedReferrerAddress})`);

              await this.prisma.referralRewardRecord.create({
                data: {
                  nftId,
                  batchId,
                  minterAddress: minterAddress.toLowerCase(),
                  rootReferrerAddress: expectedReferrerAddress,
                  rootInviteCodeId: expectedInviteCodeId,
                  referralReward,
                  referralRewardWei,
                },
              });
              created++;
            }

            processed++;
          } catch (error: any) {
            console.error(`❌ NFT #${nftId}: Error - ${error.message}`);
            errors++;
          }
        });

        await Promise.all(processPromises);

        // Log progress
        if (processed % 100 === 0 || i + batchSize > totalNfts) {
          console.log(`📊 Progress: ${processed}/${totalNfts} NFTs processed`);
        }

        // Small delay between batches to avoid overwhelming database
        if (i + batchSize <= totalNfts) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log('\n📊 Sync completed:');
      console.log(`   ✅ Processed: ${processed} NFTs`);
      console.log(`   ➕ Created: ${created} records`);
      console.log(`   🔧 Updated: ${updated} records`);
      console.log(`   ✓ Correct: ${correct} records`);
      console.log(`   ⏭️  Skipped: ${skipped} NFTs`);
      console.log(`   ❌ Errors: ${errors} NFTs\n`);

      return {
        totalNfts,
        processed,
        created,
        updated,
        correct,
        skipped,
        errors,
      };

    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  /**
   * Get distributable referral rewards by direct referrer address (直接邀请者)
   * 根据"直接邀请"的概念重新设计：
   * 1. 排除自返佣（minterAddress === rootReferrerAddress）
   * 2. 只统计直接邀请者的返佣（rootReferrerAddress 存储的是直接邀请人地址）
   * 3. 确保总数正确
   * 
   * 注意：虽然字段名是 rootReferrerAddress，但实际存储的是"直接邀请者"地址，不是根邀请者
   * 
   * @returns List of direct referrer addresses with their total rewards and distributed amounts
   */
  async getDistributableReferralRewards(): Promise<{
    rootAddress: string; // 注意：虽然字段名是 rootAddress，但实际是直接邀请者地址
    totalRewards: string;
    totalRewardsWei: string;
    distributedRewards: string;
    distributedRewardsWei: string;
    distributableRewards: string;
    distributableRewardsWei: string;
    recordCount: number;
  }[]> {
    // Get all referral reward records
    // 注意：rootReferrerAddress 字段名虽然叫"root"，但实际存储的是"直接邀请者"地址（direct referrer）
    const records = await this.prisma.referralRewardRecord.findMany({
      select: {
        nftId: true,
        minterAddress: true,
        rootReferrerAddress: true, // 实际是直接邀请者地址
        referralRewardWei: true,
      },
    });

    // Group by direct referrer address (排除自返佣)
    // 自返佣：minterAddress === rootReferrerAddress（自己给自己返佣，不应该统计）
    const rewardsByAddress = new Map<string, {
      totalWei: bigint;
      recordCount: number;
    }>();

    for (const record of records) {
      const minter = record.minterAddress.toLowerCase();
      const directReferrer = record.rootReferrerAddress?.toLowerCase(); // 实际是直接邀请者地址
      
      // 排除自返佣：如果 minterAddress === rootReferrerAddress，跳过
      if (!directReferrer || minter === directReferrer) {
        // 自返佣，不统计
        continue;
      }
      
      const rewardWei = BigInt(record.referralRewardWei);
      
      const existing = rewardsByAddress.get(directReferrer);
      if (existing) {
        existing.totalWei += rewardWei;
        existing.recordCount++;
      } else {
        rewardsByAddress.set(directReferrer, {
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
    referralRewardCreated: boolean;
    inviteCodeActivated: boolean;
  }> {
    const normalizedMinterAddress = minterAddress.toLowerCase();
    let nftRecordCreated = false;
    let referralRewardCreated = false;
    let inviteCodeActivated = false;

    const startTime = Date.now();
    try {
      // 1. Read contract Manager information and create/update NftRecord
      // Note: RevenueRecord is no longer used - revenue is calculated from NftRecord and Batch
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
        
        // Find invite code used by minter (at mint time)
        // Note: We use the most recent usage before mint, but ideally should use mint timestamp
        const inviteCodeUsage = await this.prisma.inviteCodeUsage.findFirst({
          where: { userAddress: normalizedMinterAddress },
          include: { inviteCode: true },
          orderBy: { createdAt: 'asc' }, // Get first usage (earliest)
        });

        await this.prisma.nftRecord.create({
          data: {
            nftId,
            ownerAddress: ownerAddress?.toLowerCase() || normalizedMinterAddress,
            minterAddress: normalizedMinterAddress,
            mintTxHash,
            inviteCodeId: inviteCodeUsage?.inviteCodeId || null,
            // Removed rootInviteCodeId and rootApplicantAddress - can be calculated recursively from inviteCodeId
            // This avoids data redundancy and inconsistency issues
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

      // Removed RevenueRecord creation - revenue is calculated from NftRecord and Batch
      // Revenue can be calculated by: NftRecord.minterAddress -> Batch.mintPrice

      // 2. Generate referral reward record
      // Use direct invite code ID from NftRecord
      try {
        const nftRecord = existingNftRecord || await this.prisma.nftRecord.findUnique({
          where: { nftId },
        });
        const directInviteCodeId = nftRecord?.inviteCodeId || null;
        
        await this.calculateAndCreateReferralReward(
          nftId,
          normalizedMinterAddress,
          finalBatchId,
          mintTxHash,
          directInviteCodeId, // Direct invite code ID used at mint time
          undefined, // mintedAt not available in callback
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

      // 3. Activate invite code or auto-create if doesn't exist
      try {
        await this.inviteCodesService.activateInviteCodeForApplicant(normalizedMinterAddress);
        inviteCodeActivated = true;
        console.log(`✅ Activated invite code for ${normalizedMinterAddress}`);
      } catch (error: any) {
        // If no pending invite code, try to auto-create one
        if (error.message?.includes('No pending invite code') || error.message?.includes('not found')) {
          try {
            // Check if user already has an invite code
            const existingCode = await this.inviteCodesService.getUserInviteCodes(normalizedMinterAddress);
            
            // If user doesn't have an invite code, auto-create one
            if (existingCode.inviteCodeStatus === 'none' || (existingCode.ownedInviteCodes.length === 0 && existingCode.pendingInviteCodes.length === 0)) {
              console.log(`🔄 Auto-creating invite code for ${normalizedMinterAddress}...`);
              
              // Create invite code request and auto-approve it
              const request = await this.inviteCodesService.createRequest(normalizedMinterAddress);
              
              // Auto-approve the request (system-generated)
              if (request.status === 'pending') {
                await this.inviteCodesService.approveRequest(request.id, null);
              }
              
              // Activate the invite code
              await this.inviteCodesService.activateInviteCodeForApplicant(normalizedMinterAddress);
              inviteCodeActivated = true;
              console.log(`✅ Auto-created and activated invite code for ${normalizedMinterAddress}`);
            } else {
              console.log(`ℹ️ User already has invite code(s) for ${normalizedMinterAddress}`);
            }
          } catch (autoCreateError: any) {
            // If auto-create fails, log but don't fail the mint callback
            console.error(`⚠️ Failed to auto-create invite code for ${normalizedMinterAddress}:`, autoCreateError.message);
          }
        } else {
          // Other errors, just log
          console.log(`ℹ️ No pending invite code to activate for ${normalizedMinterAddress}`);
        }
      }

      // 记录 metrics
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.nftMintSuccess.inc();
      this.metricsService.nftMintDuration.observe(duration);
      
      // 更新总铸造数
      const totalMinted = await this.prisma.nftRecord.count();
      this.metricsService.nftTotalMinted.set(totalMinted);

      return {
        success: true,
        nftRecordCreated,
        referralRewardCreated,
        inviteCodeActivated,
      };
    } catch (error: any) {
      console.error(`❌ Error handling NFT mint callback for NFT ${nftId}:`, error);
      
      // 记录 metrics
      const errorType = error.message?.substring(0, 50) || 'unknown';
      this.metricsService.nftMintFailed.inc({ error_type: errorType });
      this.metricsService.errorsTotal.inc();
      this.metricsService.errorsByType.inc({ error_type: errorType });
      
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
   * Sync "total allocated" referral rewards to RewardVault (on-chain).
   *
   * - Uses "direct invite" concept: ReferralRewardRecord.rootReferrerAddress is the direct referrer.
   * - Excludes self-referral rewards: minterAddress === rootReferrerAddress
   * - Only updates on-chain totals when the newly computed total is greater than current on-chain total.
   *
   * This is safe & idempotent because the contract enforces "only increase".
   */
  async syncReferralRewardsToVault(options?: {
    readChunkSize?: number;
    writeChunkSize?: number;
    confirmations?: number;
  }): Promise<{
    processedUsers: number;
    updatedUsers: number;
    skippedUsers: number;
    txCount: number;
    updatedDetails: Array<{ user: string; oldTotalWei: string; newTotalWei: string }>;
    skippedDetails: Array<{ user: string; oldTotalWei: string; newTotalWei: string; reason: 'equal' | 'decreased' }>;
  }> {
    const readChunkSize = options?.readChunkSize ?? 200;
    const writeChunkSize = options?.writeChunkSize ?? 50;
    const confirmations = options?.confirmations ?? 1;

    // 1) Aggregate totals in DB (fast): group by direct referrer, exclude self-referral.
    // Note: referralRewardWei is stored as varchar; cast to numeric for safe summation.
    // IMPORTANT: force SUM result to text to avoid scientific notation / precision loss (e.g. "2.1e+21").
    // We need an exact integer string to safely convert to BigInt.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ address: string; totalWei: string }>
    >(
      `
      SELECT
        lower("rootReferrerAddress") as "address",
        (SUM(("referralRewardWei")::numeric))::text as "totalWei"
      FROM "referral_reward_records"
      WHERE lower("minterAddress") <> lower("rootReferrerAddress")
      GROUP BY lower("rootReferrerAddress")
      `
    );

    const entitledMap = new Map<string, bigint>();
    for (const r of rows) {
      const addr = (r.address || '').toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(addr)) continue;
      const totalWeiStr = (r.totalWei ?? '0').toString();
      // numeric might theoretically include decimals; we only expect integer strings here.
      const integerPart = totalWeiStr.includes('.') ? totalWeiStr.split('.')[0] : totalWeiStr;
      entitledMap.set(addr, BigInt(integerPart || '0'));
    }

    const allUsers = Array.from(entitledMap.keys());
    if (allUsers.length === 0) {
      return {
        processedUsers: 0,
        updatedUsers: 0,
        skippedUsers: 0,
        txCount: 0,
        updatedDetails: [],
        skippedDetails: [],
      };
    }

    // Debug: show which addresses are being processed (helps validate DB aggregation scope)
    console.log(`📊 RewardVault sync candidates (direct referrers) count=${allUsers.length}`);
    if (allUsers.length <= 50) {
      console.log(`📊 Candidates: ${allUsers.join(', ')}`);
    }

    // 2) Batch read on-chain totals and build update list (only increases).
    const usersToUpdate: string[] = [];
    const totalsToUpdate: string[] = [];
    const updatedDetails: Array<{ user: string; oldTotalWei: string; newTotalWei: string }> = [];
    const skippedDetails: Array<{ user: string; oldTotalWei: string; newTotalWei: string; reason: 'equal' | 'decreased' }> = [];

    let processedUsers = 0;
    let skippedUsers = 0;

    for (let i = 0; i < allUsers.length; i += readChunkSize) {
      const chunkUsers = allUsers.slice(i, i + readChunkSize);
      const onchainTotals = await this.contractService.getRewardVaultTotalAllocatedBatch(chunkUsers);

      for (let j = 0; j < chunkUsers.length; j++) {
        const user = chunkUsers[j];
        processedUsers++;

        const newTotal = entitledMap.get(user) ?? BigInt(0);
        const oldTotal = BigInt(onchainTotals[j] || '0');

        if (newTotal > oldTotal) {
          usersToUpdate.push(user);
          totalsToUpdate.push(newTotal.toString());
          updatedDetails.push({
            user,
            oldTotalWei: oldTotal.toString(),
            newTotalWei: newTotal.toString(),
          });
        } else {
          skippedUsers++;
          skippedDetails.push({
            user,
            oldTotalWei: oldTotal.toString(),
            newTotalWei: newTotal.toString(),
            reason: newTotal === oldTotal ? 'equal' : 'decreased',
          });
        }
      }
    }

    // 3) Batch write updates (chunked) + wait confirmations.
    let txCount = 0;
    for (let i = 0; i < usersToUpdate.length; i += writeChunkSize) {
      const u = usersToUpdate.slice(i, i + writeChunkSize);
      const t = totalsToUpdate.slice(i, i + writeChunkSize);
      const txHash = await this.contractService.batchSetRewardVaultTotalAllocated(u, t);
      txCount++;
      await this.contractService.waitForTransaction(txHash, confirmations);
    }

    return {
      processedUsers,
      updatedUsers: usersToUpdate.length,
      skippedUsers,
      txCount,
      updatedDetails,
      skippedDetails,
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

