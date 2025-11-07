/**
 * Users API
 */

import { apiGet } from './client';

export interface User {
  address: string;
  createdAt: string;
  nftCount?: number;
  childrenCount?: number;
  descendantsCount?: number;
}

export interface UserStats {
  address: string;
  nftCount: number;
  childrenCount: number;
  descendantsCount: number;
  maxDepth: number;
  totalInviteCodes: number;
  activeInviteCodes: number;
}

/**
 * Get user's children (direct referrals) (admin)
 */
export async function getUserChildren(address: string): Promise<User[]> {
  return apiGet<User[]>(`/admin/users/${address}/children`);
}

/**
 * Get user's descendants (all referrals) (admin)
 */
export async function getUserDescendants(address: string): Promise<User[]> {
  return apiGet<User[]>(`/admin/users/${address}/descendants`);
}

/**
 * Get user statistics (admin)
 */
export async function getUserStats(address: string): Promise<UserStats> {
  return apiGet<UserStats>(`/admin/users/${address}/stats`);
}

