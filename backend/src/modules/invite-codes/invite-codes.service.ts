import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContractService } from '../contract/contract.service';
// Base32 encoding utility
// Note: Install base32.js or use alternative: npm install base32.js
// For now, using a simple implementation
const base32Encode = (bytes: Buffer): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  
  return output;
};

@Injectable()
export class InviteCodesService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  /**
   * Get referrer invite code ID from InviteCodeUsage table
   * This replaces the redundant referrerInviteCodeId field in InviteCodeRequest
   */
  private async getReferrerInviteCodeId(applicantAddress: string): Promise<number | null> {
    const usage = await this.prisma.inviteCodeUsage.findFirst({
      where: {
        userAddress: applicantAddress.toLowerCase(),
      },
      include: {
        inviteCode: true,
      },
      orderBy: {
        createdAt: 'asc', // Get the first one (earliest usage)
      },
    });

    return usage?.inviteCode?.id || null;
  }

  /**
   * Calculate level, rootInviteCodeId, and rootApplicantAddress from parentInviteCodeId
   * This replaces the redundant fields in InviteCode table
   */
  private async calculateInviteCodeHierarchy(
    parentInviteCodeId: number | null
  ): Promise<{
    level: number;
    rootInviteCodeId: number | null;
    rootApplicantAddress: string | null;
  }> {
    if (!parentInviteCodeId) {
      return {
        level: 1,
        rootInviteCodeId: null,
        rootApplicantAddress: null,
      };
    }

    // Recursively find root invite code
    let currentInviteCodeId = parentInviteCodeId;
    let level = 2; // Start from level 2 (child of level 1)
    let rootInviteCodeId: number | null = null;
    let rootApplicantAddress: string | null = null;

    while (currentInviteCodeId) {
      const currentCode = await this.prisma.inviteCode.findUnique({
        where: { id: currentInviteCodeId },
        select: {
          id: true,
          parentInviteCodeId: true,
          applicantAddress: true,
        },
      });

      if (!currentCode) {
        break;
      }

      if (!currentCode.parentInviteCodeId) {
        // This is the root
        rootInviteCodeId = currentCode.id;
        rootApplicantAddress = currentCode.applicantAddress;
        break;
      }

      // Move up to parent
      currentInviteCodeId = currentCode.parentInviteCodeId;
      level++;
    }

    // If we didn't find a root (shouldn't happen), use parent as root
    if (!rootInviteCodeId) {
      const parentCode = await this.prisma.inviteCode.findUnique({
        where: { id: parentInviteCodeId },
        select: { id: true, applicantAddress: true },
      });
      rootInviteCodeId = parentCode?.id || null;
      rootApplicantAddress = parentCode?.applicantAddress || null;
    }

    return {
      level,
      rootInviteCodeId,
      rootApplicantAddress,
    };
  }

  /**
   * Generate invite code from address (last 3 bytes, Base32 encoded)
   * @param address Ethereum address
   * @returns Base32 encoded invite code
   */
  private generateInviteCode(address: string): string {
    // Extract last 6 hex characters (3 bytes)
    const last6Hex = address.slice(-6);
    const bytes = Buffer.from(last6Hex, 'hex');
    
    // Base32 encode (case-insensitive, A-Z and 2-7 only)
    const base32Code = base32Encode(bytes).toUpperCase();
    
    // Ensure uniqueness - if exists, add random suffix
    return base32Code;
  }

  /**
   * Create invite code request (user applies)
   * - Top-level requests (no referrer) require manual review
   * - Non-top-level requests (with referrer) are auto-approved
   * @param applicantAddress Address that applies for invite code
   * @param referrerInviteCodeId Optional referrer invite code ID
   * @param note Optional note/remark from applicant for admin review
   * @returns Created request (pending for top-level, auto-approved for non-top-level)
   */
  async createRequest(applicantAddress: string, referrerInviteCodeId?: number, note?: string) {
    // Check if address already has a pending, auto_approved, or approved request
    const existing = await this.prisma.inviteCodeRequest.findFirst({
      where: {
        applicantAddress: applicantAddress.toLowerCase(),
        status: { in: ['pending', 'auto_approved', 'approved'] },
      },
    });

    if (existing) {
      throw new BadRequestException('Request already exists for this address');
    }

    // Check if address already has an invite code (active or pending)
    const existingCode = await this.prisma.inviteCode.findFirst({
      where: {
        applicantAddress: applicantAddress.toLowerCase(),
        status: { in: ['pending', 'active'] },
      },
    });

    if (existingCode) {
      throw new BadRequestException('User already has an invite code');
    }

    // Auto-detect referrer invite code if not provided
    // Get from InviteCodeUsage table (no longer stored in request)
    // 如果用户已经使用了邀请码，应该自动审核通过
    let finalReferrerInviteCodeId = referrerInviteCodeId;
    
    if (!finalReferrerInviteCodeId) {
      finalReferrerInviteCodeId = await this.getReferrerInviteCodeId(applicantAddress);
      if (finalReferrerInviteCodeId) {
        console.log(`✅ Auto-detected referrer invite code ${finalReferrerInviteCodeId} for user ${applicantAddress}`);
      }
    }

    // Validate referrer invite code if provided or auto-detected
    let isValidReferrer = false;
    if (finalReferrerInviteCodeId) {
      const referrerCode = await this.prisma.inviteCode.findUnique({
        where: { id: finalReferrerInviteCodeId },
      });

      if (!referrerCode) {
        console.warn(`⚠️ Referrer invite code ${finalReferrerInviteCodeId} not found, treating as top-level request`);
        finalReferrerInviteCodeId = null; // Reset to null if not found
      } else {
        // Check if referrer code is active (pending or active status)
        if (referrerCode.status === 'active' || referrerCode.status === 'pending') {
          isValidReferrer = true;
          console.log(`✅ Referrer invite code ${referrerCode.code} is valid (status: ${referrerCode.status}), will auto-approve`);
        } else {
          console.warn(`⚠️ Referrer invite code ${referrerCode.code} is not active (status: ${referrerCode.status}), will require manual approval`);
          // Don't throw error, just don't auto-approve
          finalReferrerInviteCodeId = null; // Reset to null so it requires manual approval
        }
      }
    }

    // Determine if this is a top-level request (no referrer) or non-top-level (with referrer)
    // 只有有效的推荐人邀请码才会自动审核
    const isTopLevel = !finalReferrerInviteCodeId || !isValidReferrer;
    const shouldAutoApprove = !isTopLevel && isValidReferrer; // Auto-approve only if has valid referrer

    // Create request (no longer store referrerInviteCodeId - get from InviteCodeUsage when needed)
    const request = await this.prisma.inviteCodeRequest.create({
      data: {
        applicantAddress: applicantAddress.toLowerCase(),
        referrerInviteCodeId: null, // No longer stored - get from InviteCodeUsage dynamically
        note: note?.trim() || null, // Store note if provided, otherwise null
        status: shouldAutoApprove ? 'auto_approved' : 'pending',
        autoApproved: shouldAutoApprove,
      },
    });

    // Auto-approve immediately if has referrer (non-top-level)
    if (shouldAutoApprove) {
      await this.approveRequest(request.id, null);
    }

    return request;
  }

  /**
   * Approve invite code request (admin)
   * @param requestId Request ID
   * @param adminAddress Admin address
   * @returns Created invite code
   */
  async approveRequest(requestId: number, adminAddress: string | null) {
    const request = await this.prisma.inviteCodeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending' && request.status !== 'auto_approved') {
      throw new BadRequestException('Request already processed');
    }

    // Check if address already has an invite code
    const existingCode = await this.prisma.inviteCode.findFirst({
      where: {
        applicantAddress: request.applicantAddress.toLowerCase(),
        status: { in: ['pending', 'active'] },
      },
    });

    if (existingCode) {
      // If code exists, we update the request to rejected (duplicate) or just fail
      // To be safe, we just throw error
      throw new BadRequestException('User already has an invite code');
    }

    // Generate invite code
    const code = this.generateInviteCode(request.applicantAddress);
    
    // Check uniqueness
    let uniqueCode = code;
    let counter = 1;
    while (await this.prisma.inviteCode.findUnique({ where: { code: uniqueCode } })) {
      uniqueCode = `${code}-${counter}`;
      counter++;
    }

    // Get referrer invite code from InviteCodeUsage (no longer stored in request)
    const referrerInviteCodeId = await this.getReferrerInviteCodeId(request.applicantAddress);
    
    let parentInviteCode = null;
    let parentInviteCodeId = null;

    if (referrerInviteCodeId) {
      parentInviteCode = await this.prisma.inviteCode.findUnique({
        where: { id: referrerInviteCodeId },
      });
      
      if (parentInviteCode) {
        // Validate parent invite code is still active
        if (parentInviteCode.status !== 'active' && parentInviteCode.status !== 'pending') {
          throw new BadRequestException('Referrer invite code is not active');
        }
        
        parentInviteCodeId = parentInviteCode.id;
      } else {
        console.warn(`Referrer invite code ${referrerInviteCodeId} not found, creating invite code without parent`);
      }
    }

    // Calculate hierarchy dynamically (no longer stored)
    const hierarchy = await this.calculateInviteCodeHierarchy(parentInviteCodeId);

    // Create invite code with parent relationship (only store parentInviteCodeId, calculate others dynamically)
    // Note: level, rootInviteCodeId, rootApplicantAddress are calculated but still stored for backward compatibility
    // They can be removed in a future migration after all code is updated
    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        code: uniqueCode,
        applicantAddress: request.applicantAddress.toLowerCase(),
        parentInviteCodeId: parentInviteCodeId, // Only store parent relationship
        creator: adminAddress || 'system',
        level: hierarchy.level, // Calculated dynamically, stored for backward compatibility
        rootInviteCodeId: hierarchy.rootInviteCodeId, // Calculated dynamically, stored for backward compatibility
        rootApplicantAddress: hierarchy.rootApplicantAddress, // Calculated dynamically, stored for backward compatibility
        status: 'pending', // Will be activated when applicant mints NFT
      },
    });

    // Add applicant to whitelist via contract
    await this.addToWhitelist([request.applicantAddress]);

    // Update request status
    await this.prisma.inviteCodeRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        adminAddress: adminAddress,
        reviewedAt: new Date(),
      },
    });

    return inviteCode;
  }

  /**
   * Use invite code to join whitelist
   * @param code Invite code
   * @param userAddress User address
   * @returns Transaction hash
   */
  async useInviteCode(code: string, userAddress: string) {
    // Normalize code (uppercase)
    const normalizedCode = code.toUpperCase();

    // Check if address already whitelisted
    const isWhitelisted = await this.checkWhitelistStatus(userAddress);
    if (isWhitelisted) {
      return {
        success: true,
        skipInviteCode: true,
        message: 'Address already in whitelist',
      };
    }

    // Find invite code
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code: normalizedCode },
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    // Check status
    if (inviteCode.status !== 'active') {
      if (inviteCode.status === 'pending') {
        throw new BadRequestException('Invite code is pending activation (applicant must mint at least 1 NFT)');
      }
      if (inviteCode.status === 'revoked') {
        throw new BadRequestException('Invite code has been revoked');
      }
    }

    // Check expiration
    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      throw new BadRequestException('Invite code has expired');
    }

    // Check max uses
    if (inviteCode.maxUses && inviteCode.usageCount >= inviteCode.maxUses) {
      throw new BadRequestException('Invite code usage limit reached');
    }

    // Check if already used
    const existingUsage = await this.prisma.inviteCodeUsage.findFirst({
      where: {
        inviteCodeId: inviteCode.id,
        userAddress: userAddress.toLowerCase(),
      },
    });

    if (existingUsage) {
      throw new BadRequestException('Address already used this invite code');
    }

    // Add to whitelist via contract
    const txHash = await this.addToWhitelist([userAddress]);

    // Record usage
    await this.prisma.inviteCodeUsage.create({
      data: {
        inviteCodeId: inviteCode.id,
        code: normalizedCode,
        userAddress: userAddress.toLowerCase(),
        txHash,
      },
    });

    // Update usage count
    await this.prisma.inviteCode.update({
      where: { id: inviteCode.id },
      data: { usageCount: { increment: 1 } },
    });

    // 重要：如果用户已经创建了自己的邀请码，但 parentInviteCodeId 未设置，现在应该更新
    // 因为用户刚刚使用了邀请码，说明这个邀请码应该是用户创建的邀请码的父级
    const userOwnInviteCode = await this.prisma.inviteCode.findFirst({
      where: {
        applicantAddress: userAddress.toLowerCase(),
        status: { in: ['pending', 'active'] },
      },
    });

    if (userOwnInviteCode && !userOwnInviteCode.parentInviteCodeId) {
      // 用户创建了自己的邀请码，但 parentInviteCodeId 未设置
      // 现在用户使用了邀请码，应该将这个邀请码设置为父级
      console.log(`🔄 更新邀请码 ${userOwnInviteCode.code} 的 parentInviteCodeId 为 ${inviteCode.code} (ID: ${inviteCode.id})`);
      
      const hierarchy = await this.calculateInviteCodeHierarchy(inviteCode.id);
      
      await this.prisma.inviteCode.update({
        where: { id: userOwnInviteCode.id },
        data: {
          parentInviteCodeId: inviteCode.id,
          level: hierarchy.level + 1, // 更新层级
          rootInviteCodeId: hierarchy.rootInviteCodeId || inviteCode.id, // 更新根邀请码
          rootApplicantAddress: hierarchy.rootApplicantAddress || inviteCode.applicantAddress, // 更新根申请人地址
        },
      });
    }

    return {
      success: true,
      txHash,
      message: 'Successfully added to whitelist',
    };
  }

  /**
   * Get user's invite codes (used and owned)
   * @param address User address
   * @returns User's invite code status: none, pending, approved_pending_activation, or approved with invite codes
   */
  async getUserInviteCodes(address: string) {
    const normalizedAddress = address.toLowerCase();

    // Check if user has a pending invite code request
    const pendingRequest = await this.prisma.inviteCodeRequest.findFirst({
      where: {
        applicantAddress: normalizedAddress,
        status: { in: ['pending', 'auto_approved'] },
      },
    });

    // Get pending invite codes (approved but not yet activated - waiting for NFT mint)
    const pendingInviteCodes = await this.prisma.inviteCode.findMany({
      where: {
        applicantAddress: normalizedAddress,
        status: 'pending',
      },
      select: {
        id: true,
        code: true,
        status: true,
        maxUses: true,
        usageCount: true,
        createdAt: true,
        parentInviteCodeId: true,
        parentInviteCode: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Auto-activation check: If user has pending codes, check on-chain if they have minted NFTs
    if (pendingInviteCodes.length > 0) {
      try {
        // We check on-chain data because the database might not be synced yet (if callback failed)
        const nftIds = await this.contractService.getUserNFTs(normalizedAddress);
        
        if (nftIds.length > 0) {
          console.log(`Found ${nftIds.length} NFTs on-chain for ${normalizedAddress}. Activating pending invite code...`);
          await this.activateInviteCodeForApplicant(normalizedAddress);
          
          // Clear pending list as they are now active and will be picked up by the following activeInviteCodes query
          pendingInviteCodes.length = 0;
        }
      } catch (error) {
        console.error(`Error checking on-chain NFTs for user ${normalizedAddress}:`, error);
      }
    }

    // Get active invite codes owned by the user (where applicantAddress matches and status is active)
    const activeInviteCodes = await this.prisma.inviteCode.findMany({
      where: {
        applicantAddress: normalizedAddress,
        status: 'active',
      },
      select: {
        id: true,
        code: true,
        status: true,
        maxUses: true,
        usageCount: true,
        createdAt: true,
        parentInviteCodeId: true,
        parentInviteCode: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Determine status
    let inviteCodeStatus: 'none' | 'pending' | 'approved_pending_activation' | 'approved';
    if (activeInviteCodes.length > 0) {
      inviteCodeStatus = 'approved';
    } else if (pendingInviteCodes.length > 0) {
      inviteCodeStatus = 'approved_pending_activation';
    } else if (pendingRequest) {
      inviteCodeStatus = 'pending';
    } else {
      inviteCodeStatus = 'none';
    }

    // Get invite code used by the user (the one they used to join whitelist)
    const usage = await this.prisma.inviteCodeUsage.findFirst({
      where: {
        userAddress: normalizedAddress,
      },
      include: {
        inviteCode: {
          select: {
            id: true,
            code: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Get the first one (earliest)
      },
    });

    return {
      inviteCodeStatus, // 'none' | 'pending' | 'approved_pending_activation' | 'approved'
      usedInviteCode: usage
        ? {
            id: usage.inviteCode.id,
            code: usage.inviteCode.code,
            status: usage.inviteCode.status,
            createdAt: usage.inviteCode.createdAt.toISOString(),
          }
        : null, // Use null instead of undefined for JSON serialization
      ownedInviteCodes: activeInviteCodes.map((ic) => ({
        id: ic.id,
        code: ic.code,
        status: ic.status,
        maxUses: ic.maxUses ?? null, // Use null instead of undefined for JSON serialization
        usageCount: ic.usageCount,
        createdAt: ic.createdAt.toISOString(),
        parentInviteCodeId: ic.parentInviteCodeId ?? null,
        parentInviteCode: ic.parentInviteCode
          ? { id: ic.parentInviteCode.id, code: ic.parentInviteCode.code }
          : null,
      })),
      pendingInviteCodes: pendingInviteCodes.map((ic) => ({
        id: ic.id,
        code: ic.code,
        status: ic.status,
        maxUses: ic.maxUses ?? null,
        usageCount: ic.usageCount,
        createdAt: ic.createdAt.toISOString(),
        parentInviteCodeId: ic.parentInviteCodeId ?? null,
        parentInviteCode: ic.parentInviteCode
          ? { id: ic.parentInviteCode.id, code: ic.parentInviteCode.code }
          : null,
      })),
    };
  }

  /**
   * Activate all pending invite codes for applicant when they mint NFT
   * @param applicantAddress Applicant address
   */
  async activateInviteCodeForApplicant(applicantAddress: string) {
    // Update ALL pending invite codes for this user to active
    // This handles cases where duplicates might have been created
    const result = await this.prisma.inviteCode.updateMany({
      where: {
        applicantAddress: applicantAddress.toLowerCase(),
        status: 'pending',
      },
      data: {
        status: 'active',
        activatedAt: new Date(),
      },
    });
    
    if (result.count > 0) {
      console.log(`Activated ${result.count} invite codes for ${applicantAddress}`);
    }
  }

  /**
   * Get invite code by ID
   * Note: level, rootInviteCodeId, rootApplicantAddress are now dynamically calculated
   */
  async findOne(id: number) {
    const code = await this.prisma.inviteCode.findUnique({
      where: { id },
      include: {
        parentInviteCode: true,
        children: true,
        usage: true,
      },
    });

    if (!code) {
      return null;
    }

    // Dynamically calculate hierarchy
    const hierarchy = await this.calculateInviteCodeHierarchy(code.parentInviteCodeId);

    return {
      ...code,
      level: hierarchy.level,
      rootInviteCodeId: hierarchy.rootInviteCodeId,
      rootApplicantAddress: hierarchy.rootApplicantAddress,
    };
  }

  /**
   * Get invite code list with pagination
   * Note: level, rootInviteCodeId, rootApplicantAddress are now dynamically calculated
   */
  async findAll(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.inviteCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          parentInviteCode: {
            select: { id: true, code: true },
          },
        },
      }),
      this.prisma.inviteCode.count({ where }),
    ]);

    // Dynamically calculate hierarchy for each invite code
    const transformedData = await Promise.all(
      data.map(async (code) => {
        const hierarchy = await this.calculateInviteCodeHierarchy(code.parentInviteCodeId);
        
        return {
          ...code,
          level: hierarchy.level, // Dynamically calculated
          rootInviteCodeId: hierarchy.rootInviteCodeId, // Dynamically calculated
          rootApplicantAddress: hierarchy.rootApplicantAddress, // Dynamically calculated
          createdAt: code.createdAt.toISOString(),
          updatedAt: code.createdAt.toISOString(), // Use createdAt if updatedAt not available
          activatedAt: code.activatedAt ? code.activatedAt.toISOString() : null,
          expiresAt: code.expiresAt ? code.expiresAt.toISOString() : null,
        };
      })
    );

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get descendants of invite code (recursive)
   */
  async getDescendants(inviteCodeId: number): Promise<any[]> {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { id: inviteCodeId },
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    const descendants: any[] = [];
    const queue: any[] = [inviteCode];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current) {
        descendants.push(current);
        const children = await this.prisma.inviteCode.findMany({
          where: { parentInviteCodeId: current.id },
        });
        queue.push(...children);
      }
    }

    return descendants;
  }

  /**
   * Get all invite code relationships as a tree structure
   * Returns root invite codes (those without parent) with their full descendant trees
   */
  async getInviteRelationsTree(): Promise<any[]> {
    // Get all invite codes with their parent relationships
    const allCodes = await this.prisma.inviteCode.findMany({
      include: {
        parentInviteCode: {
          select: {
            id: true,
            code: true,
            applicantAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get all invite code IDs for batch querying NFT counts
    const inviteCodeIds = allCodes.map(code => code.id);
    const applicantAddresses = allCodes.map(code => code.applicantAddress.toLowerCase());

    // Get all applicant addresses set (for filtering users with own invite codes)
    const applicantAddressesSet = new Set(applicantAddresses);

    // Batch query: count NFTs minted by each applicant address (自身铸造数量)
    // 优化：使用 groupBy 一次性查询所有地址的NFT数量，而不是逐个查询
    const selfMintedRecords = await this.prisma.nftRecord.groupBy({
      by: ['minterAddress'],
      where: {
        minterAddress: { in: applicantAddresses },
      },
      _count: {
        nftId: true,
      },
    });
    const selfMintedMap = new Map<string, number>();
    applicantAddresses.forEach(address => {
      const record = selfMintedRecords.find(r => r.minterAddress.toLowerCase() === address.toLowerCase());
      selfMintedMap.set(address, record?._count.nftId || 0);
    });

    // Batch query: count NFTs minted using each invite code (使用邀请码铸造数量)
    // 只统计没有自己邀请码的用户铸造的NFT（纯用户节点）
    // 这样可以避免重复计算：如果用户有自己的邀请码，他们的NFT会显示在邀请码节点中
    // 优化：先批量获取所有邀请码使用记录，然后批量统计，减少数据库查询次数
    const allUsages = await this.prisma.inviteCodeUsage.findMany({
      where: {
        inviteCodeId: { in: inviteCodeIds },
      },
    });
    
    // 按邀请码ID分组，并过滤出纯用户（没有自己邀请码的用户）
    const pureUsersByInviteCode = new Map<number, string[]>();
    for (const usage of allUsages) {
      const normalizedAddr = usage.userAddress.toLowerCase().trim();
      const hasOwnCode = applicantAddressesSet.has(normalizedAddr);
      if (!hasOwnCode) {
        if (!pureUsersByInviteCode.has(usage.inviteCodeId)) {
          pureUsersByInviteCode.set(usage.inviteCodeId, []);
        }
        pureUsersByInviteCode.get(usage.inviteCodeId)!.push(normalizedAddr);
      }
    }
    
    // 批量统计每个邀请码的NFT数量（只统计纯用户）
    // 优化：先收集所有需要查询的邀请码和地址组合，然后批量查询
    const allPureUserAddresses = Array.from(new Set(
      Array.from(pureUsersByInviteCode.values()).flat()
    ));
    
    // 批量查询所有纯用户的NFT记录（按邀请码和地址分组）
    const nftCountsByInviteCodeAndMinter = allPureUserAddresses.length > 0
      ? await this.prisma.nftRecord.groupBy({
          by: ['inviteCodeId', 'minterAddress'],
          where: {
            inviteCodeId: { in: inviteCodeIds },
            minterAddress: { in: allPureUserAddresses },
          },
          _count: {
            nftId: true,
          },
        })
      : [];
    
    // 按邀请码ID汇总统计
    const inviteCodeMintedMap = new Map<number, number>();
    inviteCodeIds.forEach(id => inviteCodeMintedMap.set(id, 0));
    
    nftCountsByInviteCodeAndMinter.forEach(record => {
      if (record.inviteCodeId) {
        const currentCount = inviteCodeMintedMap.get(record.inviteCodeId) || 0;
        inviteCodeMintedMap.set(record.inviteCodeId, currentCount + (record._count.nftId || 0));
      }
    });

    // Batch query: calculate total referral rewards for each invite code (返佣总量)
    const referralRewardTotals = await Promise.all(
      inviteCodeIds.map(async (inviteCodeId) => {
        const records = await this.prisma.referralRewardRecord.findMany({
          where: {
            rootInviteCodeId: inviteCodeId,
          },
          select: {
            referralReward: true, // USDT format (string)
          },
        });
        // Sum up all referral rewards (convert string to number, then sum)
        const total = records.reduce((sum, record) => {
          const reward = parseFloat(record.referralReward) || 0;
          return sum + reward;
        }, 0);
        return { inviteCodeId, total };
      })
    );
    const referralRewardMap = new Map<number, number>();
    referralRewardTotals.forEach(({ inviteCodeId, total }) => {
      referralRewardMap.set(inviteCodeId, total);
    });

    // Get users who used each invite code (使用邀请码的用户)
    // Note: applicantAddressesSet was already created above for filtering pure users
    const inviteCodeUsages = await this.prisma.inviteCodeUsage.findMany({
      where: {
        inviteCodeId: { in: inviteCodeIds },
      },
      include: {
        inviteCode: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Debug: Log the set size and some sample addresses
    console.log(`[getInviteRelationsTree] Total invite codes: ${allCodes.length}`);
    console.log(`[getInviteRelationsTree] Applicant addresses set size: ${applicantAddressesSet.size}`);
    console.log(`[getInviteRelationsTree] Total invite code usages: ${inviteCodeUsages.length}`);

    // Count NFTs minted by each user using each invite code
    // Only include users who don't have their own invite code (纯用户，没有申请邀请码)
    // This prevents duplicate display: if a user has their own invite code, they should only appear as an invite code node, not as a user node
    const normalizedUsages = inviteCodeUsages.map(usage => ({
      ...usage,
      normalizedUserAddress: usage.userAddress.toLowerCase().trim(),
    }));

    // Filter out users who have their own invite codes
    const filteredUsages = normalizedUsages.filter(usage => {
      const hasOwnInviteCode = applicantAddressesSet.has(usage.normalizedUserAddress);
      if (hasOwnInviteCode) {
        // User has their own invite code, skip showing as user node
        console.log(`[getInviteRelationsTree] Filtering out user ${usage.normalizedUserAddress} (has own invite code)`);
        return false;
      }
      return true;
    });

    console.log(`[getInviteRelationsTree] Filtered usages: ${filteredUsages.length} (removed ${normalizedUsages.length - filteredUsages.length})`);

    const userMintedCounts = await Promise.all(
      filteredUsages.map(async (usage) => {
        const count = await this.prisma.nftRecord.count({
          where: {
            inviteCodeId: usage.inviteCodeId,
            minterAddress: usage.normalizedUserAddress,
          },
        });
        return {
          inviteCodeId: usage.inviteCodeId,
          userAddress: usage.normalizedUserAddress,
          mintedCount: count,
          usedAt: usage.createdAt.toISOString(),
        };
      })
    );

    // Group users by invite code
    const usersByInviteCode = new Map<number, any[]>();
    userMintedCounts.forEach((userInfo) => {
      if (!usersByInviteCode.has(userInfo.inviteCodeId)) {
        usersByInviteCode.set(userInfo.inviteCodeId, []);
      }
      usersByInviteCode.get(userInfo.inviteCodeId)!.push(userInfo);
    });

    // Build a map for quick lookup
    const codeMap = new Map<number, any>();
    allCodes.forEach((code) => {
      const applicantAddressLower = code.applicantAddress.toLowerCase();
      const userNodes = (usersByInviteCode.get(code.id) || []).map((userInfo) => ({
        type: 'user',
        id: `user-${code.id}-${userInfo.userAddress}`,
        userAddress: userInfo.userAddress,
        mintedCount: userInfo.mintedCount,
        usedAt: userInfo.usedAt,
        parentInviteCodeId: code.id,
        children: [],
      }));

      codeMap.set(code.id, {
        type: 'inviteCode',
        id: code.id,
        code: code.code,
        applicantAddress: code.applicantAddress,
        status: code.status,
        usageCount: code.usageCount,
        maxUses: code.maxUses,
        createdAt: code.createdAt.toISOString(),
        parentInviteCodeId: code.parentInviteCodeId,
        parentInviteCode: code.parentInviteCode
          ? {
              id: code.parentInviteCode.id,
              code: code.parentInviteCode.code,
              applicantAddress: code.parentInviteCode.applicantAddress,
            }
          : null,
        selfMintedCount: selfMintedMap.get(applicantAddressLower) || 0,
        inviteCodeMintedCount: inviteCodeMintedMap.get(code.id) || 0,
        totalReferralReward: referralRewardMap.get(code.id) || 0, // 返佣总量 (USDT)
        children: userNodes, // Add user nodes as children
      });
    });

    // Build tree structure (only for invite codes, users are already added as children)
    const roots: any[] = [];
    codeMap.forEach((code) => {
      if (code.parentInviteCodeId) {
        const parent = codeMap.get(code.parentInviteCodeId);
        if (parent) {
          parent.children.push(code);
        } else {
          // Parent not found, treat as root
          roots.push(code);
        }
      } else {
        // No parent, this is a root
        roots.push(code);
      }
    });

    // Recursively calculate level and add hierarchy info
    const addHierarchyInfo = (node: any, level: number = 1): any => {
      if (node.type === 'user') {
        // User nodes don't have children or descendants
        return {
          ...node,
          level,
          descendantCount: 0,
        };
      }

      // Invite code nodes
      const inviteCodeChildren = node.children.filter((child: any) => child.type === 'inviteCode');
      const userChildren = node.children.filter((child: any) => child.type === 'user');

      return {
        ...node,
        level,
        descendantCount: inviteCodeChildren.reduce(
          (count: number, child: any) => {
            const childWithInfo = addHierarchyInfo(child, level + 1);
            return count + 1 + (childWithInfo.descendantCount || 0);
          },
          0,
        ),
        children: [
          ...inviteCodeChildren.map((child: any) => addHierarchyInfo(child, level + 1)),
          ...userChildren.map((child: any) => addHierarchyInfo(child, level + 1)),
        ],
      };
    };

    return roots.map((root) => addHierarchyInfo(root));
  }

  /**
   * Get invite code requests list with pagination
   * Note: referrerInviteCodeId is now dynamically retrieved from InviteCodeUsage
   */
  async findAllRequests(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.inviteCodeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inviteCodeRequest.count({ where }),
    ]);

    // Dynamically get referrer invite code from InviteCodeUsage for each request
    const transformedData = await Promise.all(
      data.map(async (request) => {
        const referrerInviteCodeId = await this.getReferrerInviteCodeId(request.applicantAddress);
        let referrerInviteCode = null;
        
        if (referrerInviteCodeId) {
          const code = await this.prisma.inviteCode.findUnique({
            where: { id: referrerInviteCodeId },
            select: { id: true, code: true },
          });
          referrerInviteCode = code;
        }

        return {
          ...request,
          referrerInviteCodeId, // Dynamically retrieved
          referrerInviteCode, // Dynamically retrieved
          createdAt: request.createdAt.toISOString(),
          reviewedAt: request.reviewedAt ? request.reviewedAt.toISOString() : null,
        };
      })
    );

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Reject invite code request (admin)
   */
  async rejectRequest(requestId: number, adminAddress: string) {
    const request = await this.prisma.inviteCodeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== 'pending' && request.status !== 'auto_approved') {
      throw new BadRequestException('Request already processed');
    }

    await this.prisma.inviteCodeRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        adminAddress: adminAddress,
        reviewedAt: new Date(),
      },
    });

    return { success: true, message: 'Request rejected' };
  }

  /**
   * Check if address has minted NFT
   */
  private async checkHasMintedNFT(address: string): Promise<boolean> {
    const record = await this.prisma.nftRecord.findFirst({
      where: { ownerAddress: address.toLowerCase() },
    });
    return !!record;
  }

  /**
   * Check whitelist status from contract
   */
  private async checkWhitelistStatus(address: string): Promise<boolean> {
    return await this.contractService.isWhitelisted(address);
  }

  /**
   * Add addresses to whitelist via contract
   */
  private async addToWhitelist(addresses: string[]): Promise<string> {
    return await this.contractService.addToWhitelist(addresses);
  }
}

