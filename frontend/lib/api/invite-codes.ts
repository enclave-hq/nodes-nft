/**
 * Invite Codes API
 */

import { apiGet, apiPost, apiPatch } from './client';

export interface InviteCode {
  id: number;
  code: string;
  status: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  rootInviteCodeId?: number;
  referrerInviteCodeId?: number;
  ownerAddress: string;
}

export interface InviteCodeRequest {
  id: number;
  applicantAddress: string;
  referrerInviteCodeId?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteCodesListResponse {
  data: InviteCode[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UseInviteCodeRequest {
  code: string;
  address: string;
}

export interface UseInviteCodeResponse {
  success: boolean;
  message: string;
}

export interface ValidateInviteCodeRequest {
  code: string;
}

export interface ValidateInviteCodeResponse {
  valid: boolean;
  message?: string;
}

export interface CreateRequestRequest {
  applicantAddress: string;
  referrerInviteCodeId?: number;
  note?: string;
}

export interface CreateRequestResponse {
  id: number;
  applicantAddress: string;
  status: string;
  createdAt: string;
}

/**
 * Get all invite codes (admin)
 */
export async function getInviteCodes(
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<InviteCodesListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (status) {
    params.append('status', status);
  }
  
  return apiGet<InviteCodesListResponse>(`/admin/invite-codes?${params.toString()}`);
}

/**
 * Get a single invite code by ID (admin)
 */
export async function getInviteCode(id: number): Promise<InviteCode> {
  return apiGet<InviteCode>(`/admin/invite-codes/${id}`);
}

/**
 * Get descendants of an invite code (admin)
 */
export async function getInviteCodeDescendants(id: number): Promise<InviteCode[]> {
  return apiGet<InviteCode[]>(`/admin/invite-codes/${id}/descendants`);
}

/**
 * Approve an invite code request (admin)
 */
export async function approveInviteCodeRequest(
  requestId: number,
  maxUses?: number,
  expiresAt?: string
): Promise<InviteCode> {
  return apiPatch<InviteCode>(`/admin/invite-codes/requests/${requestId}/approve`, {
    maxUses,
    expiresAt,
  });
}

/**
 * Create an invite code request (public)
 */
export async function createInviteCodeRequest(
  applicantAddress: string,
  referrerInviteCodeId?: number,
  note?: string
): Promise<CreateRequestResponse> {
  return apiPost<CreateRequestResponse>('/invite-codes/request', {
    applicantAddress,
    referrerInviteCodeId,
    note,
  });
}

/**
 * Use an invite code (public)
 */
export async function useInviteCode(
  code: string,
  address: string
): Promise<UseInviteCodeResponse> {
  return apiPost<UseInviteCodeResponse>('/invite-codes/use', {
    code,
    address,
  });
}

/**
 * Validate an invite code (public)
 */
export async function validateInviteCode(
  code: string
): Promise<ValidateInviteCodeResponse> {
  return apiPost<ValidateInviteCodeResponse>('/invite-codes/validate', {
    code,
  });
}

/**
 * Get user's invite codes (public)
 * Returns the invite code status, used invite code, and owned invite codes
 */
export interface UserInviteCodesResponse {
  inviteCodeStatus: 'none' | 'pending' | 'approved';
  usedInviteCode?: {
    id: number;
    code: string;
    status: string;
    createdAt: string;
  };
  ownedInviteCodes: Array<{
    id: number;
    code: string;
    status: string;
    maxUses?: number;
    usageCount: number;
    createdAt: string;
  }>;
}

export async function getUserInviteCodes(
  address: string
): Promise<UserInviteCodesResponse> {
  // Try to get from public API first, fallback to admin API if needed
  try {
    return apiGet<UserInviteCodesResponse>(`/invite-codes/user/${address}`);
  } catch (error) {
    // Handle network errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNetworkError = errorMessage.includes('Network error') || 
                          errorMessage.includes('Failed to fetch') ||
                          errorMessage.includes('NETWORK_ERROR');
    
    if (isNetworkError) {
      console.warn('API server not available, returning empty invite codes list');
    } else {
      console.warn('getUserInviteCodes API error:', errorMessage);
    }
    
    // Return empty response as fallback
    return { inviteCodeStatus: 'none', ownedInviteCodes: [] };
  }
}

