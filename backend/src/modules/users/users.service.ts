import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get direct children of a user (users who used this user's invite code)
   * @param address User address
   * @returns Array of direct children
   */
  async getChildren(address: string) {
    // Find invite codes created by this address
    const inviteCodes = await this.prisma.inviteCode.findMany({
      where: { applicantAddress: address.toLowerCase() },
    });

    // Get all users who used these invite codes
    const inviteCodeIds = inviteCodes.map((ic) => ic.id);
    const usages = await this.prisma.inviteCodeUsage.findMany({
      where: { inviteCodeId: { in: inviteCodeIds } },
      include: { inviteCode: true },
    });

    return usages.map((usage) => ({
      address: usage.userAddress,
      inviteCode: usage.inviteCode.code,
      joinedAt: usage.createdAt,
    }));
  }

  /**
   * Get all descendants of a user (recursive)
   * @param address User address
   * @returns Array of all descendants
   */
  async getDescendants(address: string): Promise<any[]> {
    const descendants = [];
    const visited = new Set<string>();
    const queue = [address.toLowerCase()];

    while (queue.length > 0) {
      const currentAddress = queue.shift();
      if (!currentAddress || visited.has(currentAddress)) continue;
      
      visited.add(currentAddress);
      
      const children = await this.getChildren(currentAddress);
      descendants.push(...children);
      
      // Add children to queue for recursive search
      children.forEach((child) => {
        if (!visited.has(child.address.toLowerCase())) {
          queue.push(child.address.toLowerCase());
        }
      });
    }

    return descendants;
  }

  /**
   * Get user statistics
   * @param address User address
   * @returns User statistics
   */
  async getStats(address: string) {
    const inviteCodes = await this.prisma.inviteCode.findMany({
      where: { applicantAddress: address.toLowerCase() },
    });

    const directChildren = await this.getChildren(address);
    const allDescendants = await this.getDescendants(address);
    
    const nftRecords = await this.prisma.nftRecord.findMany({
      where: { ownerAddress: address.toLowerCase() },
    });

    return {
      address: address.toLowerCase(),
      inviteCodesCount: inviteCodes.length,
      directChildrenCount: directChildren.length,
      totalDescendantsCount: allDescendants.length,
      nftsCount: nftRecords.length,
      maxLevel: Math.max(...inviteCodes.map((ic) => ic.level), 0),
    };
  }
}

