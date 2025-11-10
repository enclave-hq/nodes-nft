/**
 * Stats API
 */

import { apiGet } from './client';

export interface OverviewStats {
  totalUsers: number;
  totalNFTs: number;
  totalInviteCodes: number;
  activeInviteCodes: number;
  totalWhitelisted: number;
  whitelistedUsers?: number; // Alias for totalWhitelisted
  totalBatches: number;
  activeBatches: number;
}

export interface InviteCodeStats {
  total: number;
  active: number;
  used: number;
  pending: number;
  expired: number;
  byStatus: Record<string, number>;
  // Frontend-specific fields
  pendingCount?: number;
  activeCount?: number;
  totalUsageCount?: number;
}

/**
 * Get overview statistics (admin)
 */
export async function getOverviewStats(): Promise<OverviewStats> {
  return apiGet<OverviewStats>('/admin/stats/overview');
}

/**
 * Get invite code statistics (admin)
 */
export async function getInviteCodeStats(): Promise<InviteCodeStats> {
  return apiGet<InviteCodeStats>('/admin/stats/invite-codes');
}

