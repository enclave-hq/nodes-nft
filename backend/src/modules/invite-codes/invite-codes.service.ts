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
   * @param applicantAddress Address that applies for invite code
   * @param referrerInviteCodeId Optional referrer invite code ID
   * @param note Optional note/remark from applicant for admin review
   * @returns Created request
   */
  async createRequest(applicantAddress: string, referrerInviteCodeId?: number, note?: string) {
    // Check if address already has a pending or approved request
    const existing = await this.prisma.inviteCodeRequest.findFirst({
      where: {
        applicantAddress: applicantAddress.toLowerCase(),
        status: { in: ['pending', 'approved'] },
      },
    });

    if (existing) {
      throw new BadRequestException('Request already exists for this address');
    }

    // Check if user has minted NFT (for subsequent-level auto-approval)
    const hasMintedNFT = await this.checkHasMintedNFT(applicantAddress);
    const shouldAutoApprove = !!(hasMintedNFT && referrerInviteCodeId);

    const request = await this.prisma.inviteCodeRequest.create({
      data: {
        applicantAddress: applicantAddress.toLowerCase(),
        referrerInviteCodeId,
        note: note?.trim() || null, // Store note if provided, otherwise null
        status: shouldAutoApprove ? 'auto_approved' : 'pending',
        autoApproved: shouldAutoApprove,
      },
    });

    // If auto-approve, generate invite code immediately
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

    // Generate invite code
    const code = this.generateInviteCode(request.applicantAddress);
    
    // Check uniqueness
    let uniqueCode = code;
    let counter = 1;
    while (await this.prisma.inviteCode.findUnique({ where: { code: uniqueCode } })) {
      uniqueCode = `${code}-${counter}`;
      counter++;
    }

    // Get parent invite code info if exists
    let parentInviteCode = null;
    let level = 1;
    let rootInviteCodeId = null;
    let rootApplicantAddress = null;

    if (request.referrerInviteCodeId) {
      parentInviteCode = await this.prisma.inviteCode.findUnique({
        where: { id: request.referrerInviteCodeId },
      });
      
      if (parentInviteCode) {
        level = parentInviteCode.level + 1;
        rootInviteCodeId = parentInviteCode.rootInviteCodeId || parentInviteCode.id;
        rootApplicantAddress = parentInviteCode.rootApplicantAddress || parentInviteCode.applicantAddress;
      }
    }

    // Create invite code
    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        code: uniqueCode,
        applicantAddress: request.applicantAddress.toLowerCase(),
        parentInviteCodeId: request.referrerInviteCodeId,
        creator: adminAddress || 'system',
        level,
        rootInviteCodeId: rootInviteCodeId,
        rootApplicantAddress: rootApplicantAddress,
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

    return {
      success: true,
      txHash,
      message: 'Successfully added to whitelist',
    };
  }

  /**
   * Get user's invite codes (used and owned)
   * @param address User address
   * @returns User's invite code status: none, pending, or approved with invite codes
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Determine status
    let inviteCodeStatus: 'none' | 'pending' | 'approved';
    if (activeInviteCodes.length > 0) {
      inviteCodeStatus = 'approved';
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
      inviteCodeStatus, // 'none' | 'pending' | 'approved'
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
      })),
    };
  }

  /**
   * Activate invite code when applicant mints NFT
   * @param applicantAddress Applicant address
   */
  async activateInviteCodeForApplicant(applicantAddress: string) {
    const inviteCode = await this.prisma.inviteCode.findFirst({
      where: {
        applicantAddress: applicantAddress.toLowerCase(),
        status: 'pending',
      },
    });

    if (inviteCode) {
      await this.prisma.inviteCode.update({
        where: { id: inviteCode.id },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get invite code by ID
   */
  async findOne(id: number) {
    return this.prisma.inviteCode.findUnique({
      where: { id },
      include: {
        parentInviteCode: true,
        children: true,
        usage: true,
      },
    });
  }

  /**
   * Get invite code list with pagination
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

    return {
      data,
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

