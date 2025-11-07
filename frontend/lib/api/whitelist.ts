/**
 * Whitelist API
 */

import { apiGet, apiPost, apiDelete } from './client';

export interface WhitelistEntry {
  address: string;
  addedAt: string;
  addedBy: string;
}

export interface WhitelistResponse {
  data: WhitelistEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CheckWhitelistResponse {
  isWhitelisted: boolean;
  address: string;
}

export interface AddToWhitelistRequest {
  addresses: string[];
}

export interface AddToWhitelistResponse {
  success: boolean;
  message: string;
  added: string[];
  failed: string[];
}

/**
 * Get whitelist (admin)
 */
export async function getWhitelist(
  page: number = 1,
  limit: number = 50,
  search?: string
): Promise<WhitelistResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (search) {
    params.append('search', search);
  }
  
  return apiGet<WhitelistResponse>(`/admin/whitelist?${params.toString()}`);
}

/**
 * Add addresses to whitelist (admin)
 */
export async function addToWhitelist(
  addresses: string[]
): Promise<AddToWhitelistResponse> {
  return apiPost<AddToWhitelistResponse>('/admin/whitelist', {
    addresses,
  });
}

/**
 * Remove address from whitelist (admin)
 */
export async function removeFromWhitelist(address: string): Promise<{ success: boolean; message: string }> {
  return apiDelete<{ success: boolean; message: string }>(`/admin/whitelist/${address}`);
}

/**
 * Check if address is whitelisted (public)
 */
export async function checkWhitelistStatus(address: string): Promise<CheckWhitelistResponse> {
  const params = new URLSearchParams({ address });
  return apiGet<CheckWhitelistResponse>(`/whitelist/check?${params.toString()}`);
}

